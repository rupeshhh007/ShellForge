"use client";
import { useEffect, useState, useRef, useMemo } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { commandDiff } from "@/lib/impact/command-diff";
import smoke from "@/lib/model-smoke.json";
import pilot from "@/lib/research-pilot.json";
import { readApi, isReceipt, type Receipt } from "@/lib/contracts";
import { simulate, seedFilesystem } from "@/lib/impact/engine";
import { FocusPanel } from "./focus-panel";
type Prediction = {
  prediction: string;
  exact_match: boolean;
  syntax_valid: boolean;
  risk: string;
  backend: string;
  failure_category?: string;
};
type Pair = {
  id: string;
  instruction: string;
  reference: string;
  base: Prediction;
  tuned: Prediction;
};
type Evidence = {
  experiment: string;
  sources: { path: string; sha256: string }[];
  pairs: Pair[];
  adapter_sha256?: string;
};
type Live = {
  command: string;
  raw_output: string;
  model: string;
  mode: string;
  identity: { model_id: string; revision: string; adapter_sha256: string };
  elapsed_seconds: number;
  settings: Record<string, unknown>;
  safety: { risk: string; syntax_valid: boolean };
  complete: boolean;
};
export function ModelStudio() {
  const [data, setData] = useState<Evidence | null>(null),
    [dataset, setDataset] = useState("final"),
    [index, setIndex] = useState(0),
    [mode, setMode] = useState("saved"),
    [request, setRequest] = useState(""),
    [model, setModel] = useState("tuned"),
    [status, setStatus] = useState({
      reachable: false,
      reason: "Checking runtime availability…",
    }),
    [live, setLive] = useState<Live | null>(null),
    [receipt, setReceipt] = useState<Receipt | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null);
  useEffect(() => {
    const c = new AbortController();
    fetch("/research/final.json", { signal: c.signal })
      .then((r) => {
        if (!r.ok) throw Error("Saved artifact unavailable");
        return r.json();
      })
      .then(setData)
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    readApi("/api/model/status", {
      signal: AbortSignal.any([c.signal, AbortSignal.timeout(60000)]),
    })
      .then((v) => {
        const s = v as { reachable: boolean; reason?: string };
        setStatus({
          reachable: s.reachable === true,
          reason: s.reason ?? "Experimental runtime is reachable.",
        });
      })
      .catch(() => {
        if (!c.signal.aborted)
          setStatus({
            reachable: false,
            reason:
              "Runtime status could not be checked. Saved evaluation remains available.",
          });
      });
    return () => {
      c.abort();
      abort.current?.abort();
    };
  }, []);
  const evidence: Evidence | null = dataset === "pilot" ? pilot : data,
    pair = evidence?.pairs[index],
    supported = pair
      ? simulate(pair[model as "base" | "tuned"].prediction, seedFilesystem())
          .status !== "unsupported"
      : false;
  function invalidate() {
    abort.current?.abort();
    setBusy(false);
    setLive(null);
    setReceipt(null);
    setError("");
  }
  async function generate() {
    invalidate();
    const c = new AbortController();
    abort.current = c;
    setBusy(true);
    try {
      const value = await readApi(
        mode === "template" ? "/api/commands/propose" : "/api/model/generate",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            mode === "template"
              ? { request, profile: "linux" }
              : { request, model },
          ),
          signal: AbortSignal.any([c.signal, AbortSignal.timeout(60000)]),
        },
      );
      if (c.signal.aborted) return;
      if (mode === "template") {
        if (!isReceipt(value)) throw Error("Invalid template response");
        setReceipt(value);
      } else {
        const output = value as Live;
        if (
          output.mode !== "live" ||
          !output.complete ||
          typeof output.command !== "string"
        )
          throw Error("Incomplete live result");
        setLive(output);
      }
    } catch (e) {
      if (!c.signal.aborted)
        setError(e instanceof Error ? e.message : "Inference failed");
    } finally {
      if (!c.signal.aborted) setBusy(false);
    }
  }
  return (
    <main id="main" className="model-studio page-shell">
      <div className="studio-intro">
        <h1>
          A better model.
          <br />
          Still an <em>experiment.</em>
        </h1>
        <p>
          Follow the evidence from a pinned base model to a selected LoRA
          adapter. Inspect the misses as closely as the matches.
        </p>
      </div>
      <div
        className="accuracy-study"
        aria-label="Primary held-out strict exact match"
      >
        <h2>Improvement, in perspective.</h2>
        {[
          ["Base", 28, "2.29"],
          ["Tuned · rank 16", 84, "6.87"],
        ].map(([name, count, pct]) => (
          <div className="accuracy-row" key={name}>
            <span>{name}</span>
            <div className="accuracy-track">
              <span style={{ width: `${pct}%` }} />
            </div>
            <strong>
              {count} / 1,222 · {pct}%
            </strong>
          </div>
        ))}
        <p>
          Full 0–100% scale. Strict exact match is not semantic correctness.
          Most predictions still miss the reference. Better models, retrieval,
          structured intent and verification remain necessary.
        </p>
      </div>
      <div className="studio-mode" role="group" aria-label="Model Studio mode">
        {[
          ["saved", "Saved Evaluation"],
          ["live", "Live Model"],
          ["template", "Template"],
        ].map(([value, label]) => (
          <button
            key={value}
            aria-pressed={mode === value}
            onClick={() => {
              invalidate();
              setMode(value);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="runtime-status">
        {status.reachable
          ? "Live experimental runtime reachable."
          : status.reason}{" "}
        Saved records are never substituted for live inference.
      </p>
      {mode === "saved" ? (
        <>
          <div className="studio-selects">
            <label>
              Experiment
              <select
                aria-label="Experiment"
                value={dataset}
                onChange={(e) => {
                  invalidate();
                  setDataset(e.target.value);
                  setIndex(0);
                }}
              >
                <option value="final">
                  Final rank-16 · primary test · 1,222 pairs
                </option>
                <option value="pilot">
                  Historical rank-8 CPU pilot · 32 pairs
                </option>
              </select>
            </label>
            <label>
              Saved case
              <select
                aria-label="Saved case"
                value={index}
                onChange={(e) => {
                  invalidate();
                  setIndex(Number(e.target.value));
                }}
              >
                {evidence?.pairs.map((p, i) => (
                  <option key={p.id} value={i}>
                    {i + 1} · {p.instruction}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {pair ? (
            <>
              <p className="saved-request">{pair.instruction}</p>
              <p className="mode-label">
                Saved Evaluation · {evidence?.experiment}
              </p>
              <div className="studio-comparison">
                {(["base", "tuned"] as const).map((kind) => (
                  <PredictionPanel
                    key={`${dataset}-${pair.id}-${kind}`}
                    label={
                      kind === "base"
                        ? "Base model"
                        : dataset === "pilot"
                          ? "Tuned · rank-8 pilot"
                          : "Tuned · selected rank 16"
                    }
                    prediction={pair[kind]}
                    reference={pair.reference}
                    other={pair[kind === "base" ? "tuned" : "base"].prediction}
                  />
                ))}
              </div>
              <div className="saved-reference">
                <strong>Saved reference</strong>
                <code>{pair.reference}</code>
                <p>Record ID: {pair.id}</p>
              </div>
              <div className="playback-controls">
                <label>
                  Prediction to inspect
                  <select
                    aria-label="Prediction to inspect"
                    value={model}
                    onChange={(e) => {
                      invalidate();
                      setModel(e.target.value);
                    }}
                  >
                    <option value="base">Base</option>
                    <option value="tuned">Tuned</option>
                  </select>
                </label>
                <button
                  disabled={busy}
                  onClick={async () => {
                    invalidate();
                    const c = new AbortController();
                    abort.current = c;
                    setBusy(true);
                    try {
                      const v = await readApi("/api/commands/analyze", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          command: pair[model as "base" | "tuned"].prediction,
                          profile: "linux",
                        }),
                        signal: AbortSignal.any([
                          c.signal,
                          AbortSignal.timeout(60000),
                        ]),
                      });
                      if (c.signal.aborted) return;
                      if (isReceipt(v)) setReceipt(v);
                      else throw Error("Invalid analysis");
                    } catch (e) {
                      if (!c.signal.aborted) setError(String(e));
                    } finally {
                      if (!c.signal.aborted) setBusy(false);
                    }
                  }}
                >
                  Inspect with current analyzer
                </button>
                <Link
                  href={`/xray?command=${encodeURIComponent(pair[model as "base" | "tuned"].prediction)}`}
                >
                  Open X-Ray ↗
                </Link>
                <Link
                  href={`/lab?command=${encodeURIComponent(pair[model as "base" | "tuned"].prediction)}`}
                >
                  {supported
                    ? "Open in Impact Lab ↗"
                    : "Show simulation boundary ↗"}
                </Link>
              </div>
              <details className="studio-provenance">
                <summary>Source provenance & hashes</summary>
                <p>
                  {evidence?.adapter_sha256
                    ? `Selected adapter SHA-256: ${evidence.adapter_sha256}`
                    : "Rank-8 pilot; separate from selected final model."}
                </p>
                {evidence?.sources.map((s) => (
                  <p key={s.path}>
                    <a
                      href={`https://github.com/rupeshhh007/ShellForge/blob/feat/shellforge-product-v2/${s.path}`}
                    >
                      {s.path}
                    </a>
                    <br />
                    <code>{s.sha256}</code>
                  </p>
                ))}
              </details>
            </>
          ) : (
            <p>Loading saved prediction artifact…</p>
          )}
        </>
      ) : (
        <section className="studio-generation">
          <label htmlFor="model-request">Natural-language request</label>
          <textarea
            id="model-request"
            value={request}
            onChange={(e) => {
              invalidate();
              setRequest(e.target.value);
            }}
            maxLength={2000}
            rows={3}
            disabled={mode === "live" && !status.reachable}
            placeholder={
              mode === "live" && !status.reachable
                ? "Live requests are unavailable until a real runtime is connected."
                : "Describe the operation…"
            }
          />
          {mode === "live" && (
            <label>
              Model
              <select
                value={model}
                onChange={(e) => {
                  invalidate();
                  setModel(e.target.value);
                }}
              >
                <option value="base">Pinned Qwen base</option>
                <option value="tuned">Selected rank-16 adapter</option>
              </select>
            </label>
          )}
          <button
            className="button"
            onClick={generate}
            disabled={
              busy || !request.trim() || (mode === "live" && !status.reachable)
            }
          >
            {busy
              ? "Waiting for actual response…"
              : mode === "template"
                ? "Render supported template"
                : "Generate with live model"}
          </button>
          {mode === "template" && (
            <p>
              Twelve deterministic recipes with strict parameters. No language
              model is involved.{" "}
              <Link href="/manual">Browse supported requests ↗</Link>
            </p>
          )}
          {live && (
            <div>
              <p>
                Live · {live.model} · {live.elapsed_seconds.toFixed(2)} seconds
              </p>
              <code className="command-display">{live.raw_output}</code>
              <p>
                {live.safety.syntax_valid ? "Syntax valid" : "Syntax invalid"} ·{" "}
                {live.safety.risk} · semantic correctness not verified
              </p>
              <p>
                {live.identity.model_id} @ {live.identity.revision}
              </p>
              <p>Adapter SHA-256 {live.identity.adapter_sha256}</p>
              <code>{JSON.stringify(live.settings)}</code>
              <Link
                className="text-link"
                href={`/lab?command=${encodeURIComponent(live.command)}`}
              >
                Inspect virtual impact ↗
              </Link>
            </div>
          )}
        </section>
      )}
      {receipt && (
        <div className="studio-inspection" role="status">
          <strong>{receipt.backend}</strong>
          <code className="command-display">{receipt.command}</code>
          <p>{receipt.message}</p>
          {receipt.safety && (
            <p>
              Syntax {receipt.safety.syntax_valid ? "valid" : "invalid"} ·{" "}
              {receipt.safety.risk} · {receipt.safety.reasons.join("; ")}
            </p>
          )}
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      <section className="verified-smoke">
        <h2>One genuine inference, preserved.</h2>
        <p>
          Recorded local CPU smoke · {smoke.created_at} · not a held-out score
          or a currently live session.
        </p>
        <p>{smoke.request}</p>
        <div className="studio-comparison">
          {smoke.records.map((record) => (
            <article key={record.model}>
              <h3>
                {record.model === "base"
                  ? "Pinned base"
                  : "Selected rank-16 adapter"}
              </h3>
              <code className="command-display">{record.raw_output}</code>
              <p>
                {record.elapsed_seconds.toFixed(3)} seconds ·{" "}
                {record.generated_tokens} generated tokens · complete:{" "}
                {String(record.complete)} · executed: false
              </p>
              <p>
                Saved inspection: {record.inspection.risk} · syntax{" "}
                {record.inspection.syntax_valid ? "valid" : "invalid"}
              </p>
            </article>
          ))}
        </div>
        <details>
          <summary>Actual generation settings and identity</summary>
          <code className="command-display">
            {JSON.stringify(
              {
                identity: smoke.records[1].identity,
                settings: smoke.records[1].settings,
                device: smoke.records[1].device,
              },
              null,
              2,
            )}
          </code>
        </details>
      </section>
      <section className="model-boundary">
        <h2>What is actually connected?</h2>
        <p>
          The final adapter is validated against its manifest. The website
          supports a separate authenticated inference runtime; its live
          availability is checked above. The 512 MB free API does not load model
          weights. Saved Evaluation reads real exported artifacts. Syntax and
          static safety are independent checks, and neither establishes intent
          correctness.
        </p>
        <Link href="/bench">Read the formal research record ↗</Link>
      </section>
    </main>
  );
}
function PredictionPanel({
  label,
  prediction,
  reference,
  other,
}: {
  label: string;
  prediction: Prediction;
  reference: string;
  other: string;
}) {
  const diff = useMemo(() => commandDiff(prediction.prediction, other), [prediction.prediction, other]);
  const content = (
    <>
      <p>
        Strict exact match:{" "}
        <strong>{prediction.exact_match ? "YES" : "NO"}</strong> · saved syntax:{" "}
        {prediction.syntax_valid ? "valid" : "invalid"} · static risk:{" "}
        {prediction.risk}
      </p>
      <AnimatePresence mode="wait">
        <motion.code
          className="command-display"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
        >
          {diff.left.map((part, i) => (
            <span
              key={i}
              className={
                part.changed ? "diff-token" : ""
              }
            >
              {part.text}
            </span>
          ))}
        </motion.code>
      </AnimatePresence>
      <p>
        {prediction.exact_match
          ? "Literal match to the saved reference. Semantic correctness is still not independently established."
          : (prediction.failure_category ??
            "Text mismatch requires semantic review; a different command may or may not be equivalent.")}
      </p>
      <p className="lab-fixture-note">
        {diff.message}
      </p>
    </>
  );
  return (
    <article className="prediction-panel">
      <h2>{label}</h2>
      {content}
      <FocusPanel
        title={`Inspect ${label}`}
        tone="quiet"
        art={<code>{prediction.prediction}</code>}
      >
        {content}
        <h3>Saved reference</h3>
        <code className="command-display">{reference}</code>
        <p>{prediction.backend}</p>
      </FocusPanel>
    </article>
  );
}
