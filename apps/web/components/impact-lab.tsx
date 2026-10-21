"use client";
import Link from "next/link";
import {
  useMemo,
  useRef,
  useState,
  useEffect,
  useSyncExternalStore,
} from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  simulate,
  seedFilesystem,
  modeString,
  permissionString,
  parent,
  normalizePath,
  LIMITS,
  IDENTITY,
} from "@/lib/impact/engine";
import { readApi, isReceipt, type Receipt } from "@/lib/contracts";
import { useImpactSession } from "./impact-session";
import { VirtualTree } from "./virtual-tree";
import { useMotionPreference } from "@/lib/use-motion-preference";
const subscribeHydration = () => () => {};
const clientReady = () => true;
const serverReady = () => false;
const PRESETS = [
  ["GNU size boundary", "find ./data -type f -size +100M"],
  ["Rounded 100 MiB bucket", "find ./data -type f -size 100M"],
  ["Exact 104,857,600 bytes", "find ./data -type f -size 104857600c"],
  ["Traversal depth", "find ./data -maxdepth 1 -type f"],
  ["Permission denied", "find ./private -type f"],
  ["Recursive deletion", "rm -rf ./tmp/cache"],
  ["Remove directory search permission", "chmod 600 ./data/nested"],
  ["Create directory", "mkdir ./tmp/experiment"],
  ["Create empty file", "touch ./tmp/new.txt"],
  ["Sticky directory protection", "rm ./tmp/root-owned.tmp"],
  ["Unsupported pipeline", "find ./data | sort"],
];
const quote = (value: string) => "'" + value.replaceAll("'", "'\\''") + "'";
export function ImpactLab({ initialCommand }: { initialCommand?: string }) {
  const hydrated = useSyncExternalStore(
    subscribeHydration,
    clientReady,
    serverReady,
  );
  const session = useImpactSession();
  const { snapshot, history, applied } = session;
  const reduce = useMotionPreference();
  const [command, setCommand] = useState(initialCommand ?? session.lastCommand);
  const [selected, setSelected] = useState("/lab/data/threshold-100.bin");
  const [token, setToken] = useState(4);
  const [showAfter, setShowAfter] = useState(false);
  const [analysis, setAnalysis] = useState<Receipt | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [apiError, setApiError] = useState("");
  const abort = useRef<AbortController | null>(null);
  const serial = useRef(0);
  useEffect(() => () => abort.current?.abort(), []);
  const result = useMemo(
    () => simulate(command, snapshot),
    [command, snapshot],
  );
  const p = result.program;
  const selectedToken = p?.tokens[token];
  const effectiveToken = selectedToken ? token : 0;
  const entry =
    (showAfter ? result.after.entries : snapshot.entries).find(
      (e) => e.path === selected,
    ) ?? snapshot.entries.find((e) => e.path === selected);
  const traces = result.traces[selected] ?? [];
  function edit(value: string) {
    serial.current++;
    abort.current?.abort();
    setAnalyzing(false);
    setAnalysis(null);
    setApiError("");
    setCommand(value);
    session.setLastCommand(value);
    setShowAfter(false);
  }
  function build(patch: Record<string, string>) {
    if (!p || p.utility !== "find") return;
    const fields: Record<string, string> = {
      path: p.path,
      type: p.predicates.find((t) => t.kind === "type")?.value ?? "",
      size: p.predicates.find((t) => t.kind === "size")?.value ?? "",
      name: p.predicates.find((t) => t.kind === "name")?.value ?? "",
      perm: p.predicates.find((t) => t.kind === "perm")?.value ?? "",
      empty: p.predicates.some((t) => t.kind === "empty") ? "yes" : "",
      maxdepth: p.tokens.some((t) => t.value === "-maxdepth")
        ? String(p.maxDepth)
        : "",
      mindepth: p.tokens.some((t) => t.value === "-mindepth")
        ? String(p.minDepth)
        : "",
      ...patch,
    };
    let next = `find ${quote(fields.path)}`;
    for (const kind of ["maxdepth", "mindepth", "type", "name", "size", "perm"])
      if (fields[kind]) next += ` -${kind} ${quote(fields[kind])}`;
    if (fields.empty) next += " -empty";
    edit(next);
  }
  async function inspect() {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    const id = ++serial.current;
    setAnalyzing(true);
    setApiError("");
    setAnalysis(null);
    try {
      const value = await readApi("/api/commands/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command, profile: "linux" }),
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(60000),
        ]),
      });
      if (!isReceipt(value)) throw new Error("Unexpected analyzer response.");
      if (id === serial.current) setAnalysis(value);
    } catch (e) {
      if (!controller.signal.aborted && id === serial.current)
        setApiError(e instanceof Error ? e.message : "Analyzer unavailable.");
    } finally {
      if (id === serial.current) setAnalyzing(false);
    }
  }
  function apply() {
    if (result.status !== "ok" || !result.changes.length || !p) return;
    session.setHistory((current) =>
      [...current, snapshot].slice(-LIMITS.history),
    );
    session.setSnapshot(result.after);
    session.setApplied({
      command,
      changes: result.changes,
      revision: result.after.revision,
    });
    setShowAfter(false);
    edit(`find ${quote(parent(normalizePath(p.path)))} -maxdepth 1`);
  }
  function undo() {
    const prior = history.at(-1);
    if (!prior) return;
    session.setSnapshot(prior);
    session.setHistory((current) => current.slice(0, -1));
    session.setApplied(null);
    setShowAfter(false);
  }
  const differences = result.changes.length
    ? result.changes
    : (applied?.changes ?? []);
  return (
    <main id="main" className="impact-page page-shell">
      <fieldset
        className="lab-controls"
        aria-label="Impact Lab controls"
        disabled={!hydrated}
      >
        <div className="impact-heading">
          <div>
            <h1>Command Impact Lab</h1>
            <p>
              Explore traversal, predicates and Unix permissions on a synthetic
              filesystem.
            </p>
          </div>
          <div className="lab-session">
            <span>
              student · uid {IDENTITY.uid} · gid {IDENTITY.gid}
            </span>
            <span>cwd /lab · revision {snapshot.revision}</span>
            <button
              onClick={() => {
                session.setSnapshot(seedFilesystem());
                session.setHistory([]);
                session.setApplied(null);
                edit(PRESETS[0][1]);
                setSelected("/lab/data/threshold-100.bin");
              }}
            >
              Reset fixture
            </button>
            <button disabled={!history.length} onClick={undo}>
              Undo virtual change
            </button>
          </div>
        </div>
        <p className="lab-boundary">
          In-memory simulation only. No shell execution, host filesystem,
          uploads or model inference. Snapshots survive navigation in this tab;
          reloading resets them.
        </p>
        <section
          className="lab-command-section"
          aria-label="Construct and inspect a virtual command"
        >
          <div className="lab-command-top">
            <label>
              Load an experiment
              <select
                aria-label="Load an experiment"
                value=""
                onChange={(e) => edit(e.target.value)}
              >
                <option value="" disabled>
                  Choose a supported or unsupported example
                </option>
                {PRESETS.map(([label, value]) => (
                  <option key={label} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <div className="lab-handoffs">
              <Link
                href={`/forge?request=${encodeURIComponent("Find files larger than 100 MiB in the current directory")}`}
              >
                Describe in Forge
              </Link>
              <Link href={`/xray?command=${encodeURIComponent(command)}`}>
                Open in X-Ray
              </Link>
            </div>
          </div>
          <label className="lab-command-label" htmlFor="lab-command">
            Command · evaluated immediately against virtual data
          </label>
          <textarea
            id="lab-command"
            value={command}
            onChange={(e) => edit(e.target.value)}
            maxLength={LIMITS.command}
            rows={2}
            spellCheck={false}
            aria-describedby="lab-result-summary"
          />
          {p?.utility === "find" && (
            <div className="find-builder" aria-label="Find predicate controls">
              <label>
                Starting path
                <select
                  value={p.path}
                  onChange={(e) => build({ path: e.target.value })}
                  aria-label="Starting path"
                >
                  <option value={p.path}>{p.path}</option>
                  {snapshot.entries
                    .filter((e) => e.kind === "directory" && e.path !== p.path)
                    .map((e) => (
                      <option key={e.path} value={e.path}>
                        {e.path}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Type
                <select
                  aria-label="Type"
                  value={
                    p.predicates.find((t) => t.kind === "type")?.value ?? ""
                  }
                  onChange={(e) => build({ type: e.target.value })}
                >
                  <option value="">All entries</option>
                  <option value="f">Regular files</option>
                  <option value="d">Directories</option>
                </select>
              </label>
              <label>
                Name pattern
                <input
                  aria-label="Name pattern"
                  value={
                    p.predicates.find((t) => t.kind === "name")?.value ?? ""
                  }
                  placeholder="No name filter"
                  onChange={(e) => build({ name: e.target.value })}
                />
              </label>
              <label>
                Size predicate
                <select
                  aria-label="Size predicate"
                  value={
                    ["", "100M", "+100M", "104857600c", "-100M"].includes(
                      p.predicates.find((t) => t.kind === "size")?.value ?? "",
                    )
                      ? (p.predicates.find((t) => t.kind === "size")?.value ??
                        "")
                      : "custom"
                  }
                  onChange={(e) => build({ size: e.target.value })}
                >
                  <option value="">No size filter</option>
                  <option value="100M">100M · rounded bucket</option>
                  <option value="+100M">+100M · greater than</option>
                  <option value="104857600c">104857600c · exact bytes</option>
                  <option value="-100M">-100M · less than</option>
                  <option value="custom" disabled>
                    Custom · edit command
                  </option>
                </select>
              </label>
              <label>
                Max depth
                <select
                  aria-label="Max depth"
                  value={
                    p.tokens.some((t) => t.value === "-maxdepth")
                      ? String(p.maxDepth)
                      : ""
                  }
                  onChange={(e) => build({ maxdepth: e.target.value })}
                >
                  <option value="">Recursive (limit 16)</option>
                  {[0, 1, 2, 3].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                  {p.maxDepth > 3 && p.maxDepth < 16 && (
                    <option value={p.maxDepth}>{p.maxDepth}</option>
                  )}
                </select>
              </label>
            </div>
          )}
          <div
            className="lab-token-strip"
            aria-label="Simulator token explanations"
          >
            {p?.tokens.map((t, i) => (
              <button
                key={`${t.start}-${i}`}
                aria-pressed={effectiveToken === i}
                onClick={() => setToken(i)}
                className={effectiveToken === i ? "active" : ""}
              >
                <code>{t.text}</code>
              </button>
            ))}
          </div>
          {p && (
            <div className="lab-token-detail" aria-live="polite">
              <strong>{p.tokens[effectiveToken]?.role}</strong>
              <p>{p.tokens[effectiveToken]?.explanation}</p>
            </div>
          )}
        </section>
        <section
          className={`lab-summary ${result.status}`}
          id="lab-result-summary"
          aria-live="polite"
        >
          <div>
            <strong>
              {result.status === "unsupported"
                ? "Not simulated"
                : result.status === "error"
                  ? "Cannot simulate"
                  : result.status === "partial"
                    ? "Partial result"
                    : "Virtual result"}
            </strong>
            <p>{result.message}</p>
          </div>
          <div>
            <span>{result.visited.length} visited</span>
            <span>
              {result.matches.length}{" "}
              {p?.utility === "find" ? "matched" : "affected"}
            </span>
            <span>{result.changes.length} changes</span>
          </div>
        </section>
        {result.errors.length > 0 && (
          <ul className="lab-errors" aria-label="Simulation errors">
            {result.errors.map((e, i) => (
              <li key={`${i}-${e}`}>{e}</li>
            ))}
          </ul>
        )}
        <div className="impact-columns">
          <section className="lab-tree-panel" aria-label="Virtual filesystem">
            <div className="lab-panel-title">
              <h2>Synthetic filesystem</h2>
              <span>● matched / affected · ○ visited · · unvisited</span>
            </div>
            <div className="lab-view-controls">
              <span>
                {snapshot.entries.length} entries ·{" "}
                {snapshot.entries.filter((e) => e.kind === "file").length} files
              </span>
              {result.changes.length > 0 && (
                <div role="group" aria-label="Virtual state preview">
                  <button
                    aria-pressed={!showAfter}
                    onClick={() => setShowAfter(false)}
                  >
                    Before
                  </button>
                  <button
                    aria-pressed={showAfter}
                    onClick={() => setShowAfter(true)}
                  >
                    Preview after
                  </button>
                </div>
              )}
            </div>
            <VirtualTree
              snapshot={snapshot}
              result={result}
              selected={selected}
              onSelect={setSelected}
              token={effectiveToken}
              showAfter={showAfter}
            />
            <p className="lab-fixture-note">
              Fixture viewer shows the complete synthetic model, including
              root-owned entries. The interpreter separately enforces student
              permissions. Directory sizes are modeled as 4,096 bytes, not
              recursive totals.
            </p>
          </section>
          <aside
            className="lab-properties"
            aria-label="File properties and predicate evaluation"
          >
            <h2>Entry & predicate trace</h2>
            {entry ? (
              <>
                <code className="lab-selected-path">{entry.path}</code>
                <dl>
                  <div>
                    <dt>Kind</dt>
                    <dd>{entry.kind}</dd>
                  </div>
                  <div>
                    <dt>Logical bytes</dt>
                    <dd>{entry.size.toLocaleString("en-US")}</dd>
                  </div>
                  <div>
                    <dt>Mode</dt>
                    <dd>
                      {modeString(entry.mode)}{" "}
                      <code>{permissionString(entry)}</code>
                    </dd>
                  </div>
                  <div>
                    <dt>Owner / group</dt>
                    <dd>
                      {entry.uid === 1000 ? "student" : "root"} ({entry.uid}) /{" "}
                      {entry.gid}
                    </dd>
                  </div>
                  <div>
                    <dt>Metadata revision</dt>
                    <dd>{entry.modified} (logical, not wall time)</dd>
                  </div>
                  <div>
                    <dt>Evaluation</dt>
                    <dd>
                      {result.matches.includes(entry.path)
                        ? "Matched / affected"
                        : result.visited.includes(entry.path)
                          ? "Visited, not matched"
                          : "Not visited by this command"}
                    </dd>
                  </div>
                </dl>
                <div className="predicate-traces">
                  {traces.length ? (
                    traces.map((trace, i) => (
                      <motion.button
                        key={`${entry.path}-${trace.token}-${i}`}
                        animate={{
                          backgroundColor:
                            trace.passed === null
                              ? "#1e231b"
                              : trace.passed
                                ? "#24341c"
                                : "#261e18",
                        }}
                        transition={{ duration: reduce ? 0 : 0.25 }}
                        className={
                          trace.token === effectiveToken ||
                          trace.token === effectiveToken - 1
                            ? "focused"
                            : ""
                        }
                        onClick={() => setToken(trace.token)}
                      >
                        <strong>
                          {trace.passed === null
                            ? "SKIP"
                            : trace.passed
                              ? "PASS"
                              : "FAIL"}{" "}
                          · {trace.label}
                        </strong>
                        <span>{trace.detail}</span>
                      </motion.button>
                    ))
                  ) : (
                    <p>
                      {result.visited.includes(entry.path)
                        ? "No predicates: every visited entry at the selected depth matches."
                        : "Select a visited entry to inspect the predicate calculations. An unvisited entry is not a failed match."}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <p>Select an entry from the tree.</p>
            )}
          </aside>
        </div>
        <section
          className="lab-differences"
          aria-label="Virtual filesystem differences"
        >
          <div className="lab-panel-title">
            <h2>Before / after differences</h2>
            <span>
              {result.changes.length
                ? "Pending preview"
                : applied
                  ? `Last applied · revision ${applied.revision}`
                  : "No mutations"}
            </span>
          </div>
          <AnimatePresence initial={false}>
            {differences.length ? (
              <motion.div
                key="diff"
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <ul>
                  {differences.map((change) => (
                    <motion.li
                      layout={!reduce}
                      key={change.path}
                      initial={reduce ? false : { opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                    >
                      <strong className={`change-${change.kind}`}>
                        {change.kind}
                      </strong>
                      <button onClick={() => setSelected(change.path)}>
                        <code>{change.path}</code>
                      </button>
                      <span>
                        {change.before
                          ? `${change.before.kind} · ${modeString(change.before.mode)} · ${change.before.size} B · rev ${change.before.modified}`
                          : "absent"}{" "}
                        →{" "}
                        {change.after
                          ? `${change.after.kind} · ${modeString(change.after.mode)} · ${change.after.size} B · rev ${change.after.modified}`
                          : "absent"}
                      </span>
                    </motion.li>
                  ))}
                </ul>
              </motion.div>
            ) : (
              <p>
                Read-only find leaves the snapshot unchanged. Load rm, chmod,
                mkdir or touch to preview a modeled change.
              </p>
            )}
          </AnimatePresence>
          <button
            className="button lab-apply"
            disabled={result.status !== "ok" || !result.changes.length}
            onClick={apply}
          >
            Apply to virtual snapshot <span aria-hidden="true">→</span>
          </button>
          {applied && (
            <p className="lab-applied" role="status">
              Applied virtual revision {applied.revision}:{" "}
              <code>{applied.command}</code>. Refreshed the parent directory
              view. Undo restores the prior snapshot.
            </p>
          )}
          <p className="lab-fixture-note">
            Mutations are atomic after permission preflight. Unlike real rm,
            this model does not partially delete on failure or ask interactive
            questions. It models entries, mode/ownership and logical size—not
            file contents, inodes, links, ACLs, allocation, mounts or process
            execution. touch updates a logical metadata revision. Creation uses
            fixed umask 022; parent timestamps are not modeled.
          </p>
        </section>
        <section
          className="lab-safety"
          aria-label="Existing static safety analysis"
        >
          <div>
            <h2>Static analyzer · separate evidence</h2>
            <p>
              Simulation support and static risk are independent. A deletion can
              be modeled here and still be dangerous on a real machine.
            </p>
            <button
              className="button"
              onClick={inspect}
              disabled={analyzing || !command.trim()}
            >
              {analyzing
                ? "Waiting for analyzer…"
                : "Inspect with static analyzer"}
            </button>
            {analyzing && (
              <button
                className="text-link"
                onClick={() => {
                  serial.current++;
                  abort.current?.abort();
                  setAnalyzing(false);
                }}
              >
                Cancel analysis
              </button>
            )}
          </div>
          <div aria-live="polite">
            {apiError ? (
              <p role="alert">
                {apiError} The virtual simulation still works locally.
              </p>
            ) : analysis?.safety ? (
              <>
                <h3 className={`risk-${analysis.safety.risk.toLowerCase()}`}>
                  {analysis.safety.risk}
                </h3>
                <p>
                  Bash syntax:{" "}
                  {analysis.safety.syntax_valid
                    ? "valid"
                    : "invalid / unverified"}{" "}
                  · policy {analysis.safety.policy} · executed: false
                </p>
                <ul>
                  {analysis.safety.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
                <p>
                  Static analysis cannot prove intent or real runtime safety.
                </p>
              </>
            ) : (
              <p>
                No analyzer result yet. This sends the command text to the
                existing Python API for syntax-only Bash checking and static AST
                analysis; it does not execute it.
              </p>
            )}
          </div>
        </section>
        <details className="lab-grammar">
          <summary>Supported grammar & limits</summary>
          <pre>{`find PATH [-type f|d] [-name 'GLOB'] [-size [+|-]N[cbwkMG]]\n          [-perm OCTAL] [-empty] [-mindepth N] [-maxdepth N] [-print]\nrm [-r|-f|-rf|-fr] [--] PATH\nchmod OCTAL [--] PATH\nmkdir [--] PATH\ntouch [--] PATH`}</pre>
          <p>
            One literal path per command; implicit AND only. Single/double
            quotes group arguments; no expansions. Name patterns support * and ?
            only. No pipes, redirection, substitution, sudo, -exec, -delete,
            OR/NOT/grouping, links or multi-command input. Unknown constructs
            fail closed; nothing is silently dropped. Limits: {LIMITS.command}{" "}
            characters, {LIMITS.tokens} tokens, {LIMITS.entries} entries, depth{" "}
            {LIMITS.depth}, {LIMITS.history} undo states.
          </p>
          <a
            className="text-link"
            href="https://www.gnu.org/software/findutils/manual/html_node/find_html/Size.html"
          >
            GNU find size semantics ↗
          </a>
        </details>
      </fieldset>
    </main>
  );
}
