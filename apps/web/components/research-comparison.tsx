"use client";
import { useState } from "react";
import Link from "next/link";
import saved from "@/lib/research-pilot.json";
export function ResearchComparison() {
  const [selected, setSelected] = useState(0);
  const pair = saved.pairs[selected];
  return (
    <section id="saved-predictions" className="research-comparison">
      <h2>Saved predictions, side by side.</h2>
      <p>
        Historical CPU pilot: base 3/32 exact matches; rank-8 LoRA 2/32. These
        are the actual saved outputs, including failures. They are not the final
        rank-16 experiment, not new inference, and not evidence that a model is
        connected to this site. The final 6.87% result below refers to a
        separate evaluation.
      </p>
      <label>
        Choose a preserved test case
        <select
          value={selected}
          onChange={(e) => setSelected(Number(e.target.value))}
        >
          {saved.pairs.map((row, i) => (
            <option key={row.id} value={i}>
              {String(i + 1).padStart(2, "0")} · {row.instruction}
            </option>
          ))}
        </select>
      </label>
      <div className="research-record">
        <p>{pair.instruction}</p>
        <div className="research-reference">
          Saved reference: <code>{pair.reference}</code>
        </div>
        <div className="research-predictions">
          {(["base", "tuned"] as const).map((kind) => (
            <article key={kind}>
              <h3>{kind === "base" ? "Base model" : "Tuned · rank-8 pilot"}</h3>
              <p>
                Strict exact match:{" "}
                <strong>{pair[kind].exact_match ? "YES" : "NO"}</strong> · saved
                syntax: {pair[kind].syntax_valid ? "valid" : "invalid"} · saved
                risk: {pair[kind].risk}
              </p>
              <code>{pair[kind].prediction}</code>
              <p>{pair[kind].backend}</p>
              <Link
                className="text-link"
                href={`/xray?command=${encodeURIComponent(pair[kind].prediction)}`}
              >
                Inspect the saved output →
              </Link>
            </article>
          ))}
        </div>
        <p className="research-evidence">
          Record ID: {pair.id} · Generated on the historical run; never
          executed.
        </p>
      </div>
      {saved.sources.map((source) => (
        <p className="research-evidence" key={source.path}>
          <a
            href={`https://github.com/rupeshhh007/ShellForge/blob/main/${source.path}`}
          >
            {source.path}
          </a>
          <br />
          SHA-256: {source.sha256}
        </p>
      ))}
    </section>
  );
}
