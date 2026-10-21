"use client";

import { useMotionPreference } from "@/lib/use-motion-preference";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  isReceipt,
  readApi,
  type Profile,
  type Receipt,
} from "@/lib/contracts";

type Props = {
  mode: "forge" | "xray";
  initialRequest?: string;
  initialRecipe?: string;
  initialParameters?: Record<string, string>;
};
const examples = [
  "Find files larger than 100 MiB in the current directory",
  'Find files named "*.log" in the current directory',
  "Show disk space",
];

export function Workbench({
  mode,
  initialRequest = "",
  initialRecipe,
  initialParameters = {},
}: Props) {
  const isForge = mode === "forge";
  const reduce = useMotionPreference();
  const [input, setInput] = useState(initialRequest);
  const [profile, setProfile] = useState<Profile>("linux");
  const [recipe, setRecipe] = useState(initialRecipe);
  const [parameters, setParameters] = useState(initialParameters);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(0);
  const [tab, setTab] = useState<"command" | "inspector">("command");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const [split, setSplit] = useState(64);
  const controller = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const serial = useRef(0);
  useEffect(
    () => () => {
      controller.current?.abort();
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );

  function invalidate() {
    serial.current += 1;
    controller.current?.abort();
    setReceipt(null);
    setBusy(false);
    setError("");
    setCopied(false);
    setCopyError("");
    setSelected(0);
    setTab("command");
  }
  function edit(value: string) {
    invalidate();
    setInput(value);
    setRecipe(undefined);
    setParameters({});
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || busy) return;
    invalidate();
    const requestId = serial.current;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    try {
      const result = await readApi(
        `/api/commands/${isForge ? "propose" : "analyze"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.any([abort.signal, AbortSignal.timeout(20000)]),
          body: JSON.stringify(
            isForge
              ? {
                  request: input,
                  profile,
                  ...(recipe ? { recipe_id: recipe, parameters } : {}),
                }
              : { command: input, profile },
          ),
        },
      );
      if (!isReceipt(result))
        throw new Error(
          "The API response did not match the expected contract. Please retry.",
        );
      if (requestId !== serial.current) return;
      setReceipt(result);
      // Move focus to the completed receipt, without forcing the reading position.
      requestAnimationFrame(() =>
        resultRef.current?.focus({ preventScroll: true }),
      );
    } catch (e) {
      if (abort.signal.aborted || requestId !== serial.current) return;
      setError(
        e instanceof Error && e.name === "TimeoutError"
          ? "The API took too long. Please try again."
          : e instanceof Error
            ? e.message
            : "Could not reach the API.",
      );
    } finally {
      if (requestId === serial.current) setBusy(false);
    }
  }

  async function copy() {
    if (!receipt?.command) return;
    setCopyError("");
    try {
      await navigator.clipboard.writeText(receipt.command);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopyError(
        "Clipboard permission is unavailable. Select the command text and copy it manually.",
      );
    }
  }

  const token = receipt?.tokens[selected];
  const syntax = receipt?.safety;
  const policyLabel =
    syntax?.risk === "SAFE"
      ? "Allowlisted"
      : syntax?.risk === "CAUTION"
        ? "Needs caution"
        : "High concern";
  function selectToken(index: number) {
    setSelected(index);
  }
  function tokenKey(e: KeyboardEvent, index: number) {
    const length = receipt?.tokens.length ?? 0;
    let next = index;
    if (e.key === "ArrowRight") next = (index + 1) % length;
    else if (e.key === "ArrowLeft") next = (index - 1 + length) % length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = length - 1;
    else return;
    e.preventDefault();
    selectToken(next);
    e.currentTarget
      .closest('[role="group"]')
      ?.querySelectorAll("button")
      [next]?.focus();
  }

  return (
    <main id="main" className="page-shell workbench-page" data-mode={mode}>
      <div className="workbench-heading">
        <div>
          <span className="section-number mono">
            {isForge
              ? "The Forge / Language → Bash"
              : "Command X-Ray / Bash → Understanding"}
          </span>
          <h1>
            {isForge ? "The Forge" : "Command X-Ray"}
            <span className="workspace-heading-mark" aria-hidden="true">
              {isForge ? " ↗" : " +"}
            </span>
          </h1>
        </div>
        <p>
          {isForge
            ? "Describe the operation. Understand the command."
            : "Read the structure. Inspect the consequences."}
        </p>
      </div>
      <div className="workbench-input-grid">
        <form className="workbench-form" onSubmit={submit}>
          <label className="input-label mono" htmlFor="operation">
            01 /{" "}
            {isForge ? "Describe the operation" : "Paste your Bash command"}
          </label>
          <div className="request-row">
            <textarea
              id="operation"
              ref={inputRef}
              value={input}
              onChange={(e) => edit(e.target.value)}
              placeholder={
                isForge
                  ? "Find files larger than 100 MiB in the current directory"
                  : "find . -type f -size +100M"
              }
              maxLength={isForge ? 2000 : 4000}
              required
              rows={2}
              spellCheck={false}
              aria-describedby="input-help"
            />
            <div className="profile-field">
              <label htmlFor="profile" className="mono">
                Environment
              </label>
              <select
                id="profile"
                value={profile}
                onChange={(e) => {
                  invalidate();
                  setProfile(e.target.value as Profile);
                }}
              >
                <option value="linux">GNU/Linux · Bash</option>
                <option value="macos">macOS · Bash</option>
              </select>
            </div>
            <button
              type="submit"
              className="button submit-button"
              disabled={busy || !input.trim()}
            >
              {busy
                ? isForge
                  ? "Preparing proposal…"
                  : "Inspecting command…"
                : isForge
                  ? "Forge command"
                  : "Inspect command"}
              <span aria-hidden="true">↗</span>
            </button>
          </div>
          <div id="input-help" className="input-help">
            <span>
              {isForge
                ? "Bounded templates first. Unsupported requests ask for clarification."
                : "Bash syntax + static AST policy. No runtime or intent guarantee."}
            </span>
            <span className="mono">
              {input.length} / {isForge ? "2000" : "4000"}
            </span>
          </div>
          {recipe && (
            <div className="recipe-summary">
              <span className="mono">RECIPE / {recipe}</span>
              <span>
                Explicit parameters:{" "}
                {Object.entries(parameters)
                  .map(([k, v]) => `${k} = ${v}`)
                  .join(" · ") || "Recipe defaults"}
                . Editing the request switches to the language grammar.
              </span>
            </div>
          )}
        </form>
        <aside className="input-companion">
          <div className="companion-mark" aria-hidden="true">
            <motion.span
              initial={reduce ? false : { rotate: -90, scale: 0.3, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 110, damping: 14 }}
            >
              {isForge ? "↗" : "+"}
            </motion.span>
          </div>
          <div>
            <h2>
              {isForge ? "Intent, made explicit." : "Every token has a job."}
            </h2>
            <p>
              {isForge
                ? "A bounded proposal you can take apart. Paths, units and assumptions stay visible."
                : "Inspect the parts, then review the whole. Syntax and static policy are separate checks."}
            </p>
          </div>
        </aside>
      </div>
      {isForge && !receipt && !busy && (
        <div className="example-requests">
          <span className="mono">TRY AN OPERATION</span>
          {examples.map((example, i) => (
            <button
              key={example}
              onClick={() => {
                edit(example);
                inputRef.current?.focus();
              }}
            >
              {["Find large files", "Follow a filename", "Check disk space"][i]}{" "}
              <span aria-hidden="true">↗</span>
            </button>
          ))}
          <Link href="/manual">All recipes ↗</Link>
        </div>
      )}
      {error && (
        <div className="api-error" role="alert">
          <span className="mono">CONNECTION NEEDS ATTENTION</span>
          <p>{error}</p>
          <button
            className="text-link"
            onClick={() => inputRef.current?.focus()}
          >
            Return to request ↗
          </button>
        </div>
      )}
      <div aria-live="polite" className="sr-only">
        {busy
          ? "Request sent. Waiting for the API."
          : receipt
            ? receipt.message
            : ""}
      </div>
      <AnimatePresence mode="wait">
        {busy ? (
          <motion.div
            className="processing-state"
            key="busy"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-busy="true"
          >
            <span className="processing-mark" aria-hidden="true">
              ↗
            </span>
            <div>
              <h2>
                {isForge ? "Shaping the proposal." : "Reading the structure."}
              </h2>
              <p>Waiting for the actual API response. No command is running.</p>
            </div>
            <button className="text-link" onClick={invalidate}>
              Cancel request
            </button>
          </motion.div>
        ) : receipt && !receipt.command ? (
          <motion.div
            ref={resultRef}
            tabIndex={-1}
            className="unsupported-state"
            key="unsupported"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <span className="mono">
              {receipt.status === "needs_clarification"
                ? "A CONSTRAINT NEEDS ATTENTION"
                : "OUTSIDE THE CURRENT TOOLSET"}
            </span>
            <h2>
              {receipt.status === "needs_clarification"
                ? "Let’s be more precise."
                : "This needs a different approach."}
            </h2>
            <p>{receipt.message}</p>
            <p>{receipt.clarification}</p>
            <Link href="/manual" className="button">
              Browse supported recipes ↗
            </Link>
            <button
              className="text-link"
              onClick={() => inputRef.current?.focus()}
            >
              Edit your request ↗
            </button>
          </motion.div>
        ) : receipt?.command ? (
          <motion.div
            key="receipt"
            transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
            ref={resultRef}
            tabIndex={-1}
            className="receipt"
            initial={
              reduce
                ? false
                : { opacity: 0, y: 35, clipPath: "inset(0 0 100% 0)" }
            }
            animate={{ opacity: 1, y: 0, clipPath: "inset(0 0 0% 0)" }}
          >
            <div className="receipt-bar mono">
              <span>
                {isForge ? "PROPOSAL RECEIVED" : "ANALYSIS RECEIVED"} /{" "}
                {receipt.backend}
              </span>
              <span>EXECUTED: FALSE</span>
            </div>
            <div
              className="mobile-inspector-tabs"
              role="tablist"
              aria-label="Workbench panels"
              onKeyDown={(e) => {
                if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key))
                  return;
                e.preventDefault();
                const next =
                  e.key === "Home"
                    ? "command"
                    : e.key === "End"
                      ? "inspector"
                      : tab === "command"
                        ? "inspector"
                        : "command";
                setTab(next);
                e.currentTarget
                  .querySelector<HTMLButtonElement>(`#tab-${next}`)
                  ?.focus();
              }}
            >
              <button
                role="tab"
                id="tab-command"
                tabIndex={tab === "command" ? 0 : -1}
                aria-selected={tab === "command"}
                aria-controls="command-panel"
                onClick={() => setTab("command")}
              >
                Command
              </button>
              <button
                role="tab"
                id="tab-inspector"
                tabIndex={tab === "inspector" ? 0 : -1}
                aria-selected={tab === "inspector"}
                aria-controls="inspector-panel"
                onClick={() => setTab("inspector")}
              >
                Inspector
              </button>
            </div>
            <div
              className="editor-layout"
              style={{ "--command-width": `${split}%` } as CSSProperties}
              ref={editorRef}
            >
              <div
                className={`command-panel ${tab === "command" ? "mobile-active" : ""}`}
                id="command-panel"
              >
                <div className="panel-top mono">
                  <span>
                    02 / {isForge ? "Command proposal" : "Inspected command"}
                  </span>
                  <button className="copy-button" onClick={copy}>
                    {copied ? "✓ Copied" : "□ Copy command"}
                  </button>
                </div>
                <div
                  className="command-code"
                  role="group"
                  aria-label="Command tokens. Use left and right arrow keys to inspect tokens."
                >
                  <code>
                    {receipt.tokens.length
                      ? (() => {
                          let end = 0;
                          return (
                            <>
                              {receipt.tokens.map((t, i) => {
                                const space = Array.from(receipt.command!)
                                  .slice(end, t.start)
                                  .join("");
                                end = t.end;
                                return (
                                  <span key={`${t.start}-${t.end}`}>
                                    {space}
                                    <motion.button
                                      initial={
                                        reduce
                                          ? false
                                          : { opacity: 0, y: 35, rotateX: -65 }
                                      }
                                      animate={{ opacity: 1, y: 0, rotateX: 0 }}
                                      transition={{
                                        delay: reduce
                                          ? 0
                                          : Math.min(i * 0.07, 0.6),
                                        duration: 0.6,
                                      }}
                                      className={
                                        selected === i
                                          ? "token selected"
                                          : "token"
                                      }
                                      onClick={() => selectToken(i)}
                                      onKeyDown={(e) => tokenKey(e, i)}
                                      aria-pressed={selected === i}
                                      aria-label={`Inspect ${t.text}: ${t.role}`}
                                      aria-controls="token-explanation"
                                    >
                                      {selected === i && (
                                        <motion.span
                                          className="token-selection"
                                          layoutId={`token-selection-${mode}`}
                                          transition={
                                            reduce
                                              ? { duration: 0 }
                                              : {
                                                  type: "spring",
                                                  stiffness: 330,
                                                  damping: 30,
                                                }
                                          }
                                        />
                                      )}
                                      {t.text}
                                    </motion.button>
                                  </span>
                                );
                              })}
                              {Array.from(receipt.command!).slice(end).join("")}
                            </>
                          );
                        })()
                      : receipt.command}
                  </code>
                </div>
                <p className="token-hint mono">
                  {receipt.tokens.length
                    ? "Select a token to understand its role. ← → to explore."
                    : "No token explanation is available for this syntax."}
                </p>
                <div className="selected-token-mobile">
                  {token && (
                    <button onClick={() => setTab("inspector")}>
                      Inspect <code>{token.text}</code>{" "}
                      <span aria-hidden="true">↗</span>
                    </button>
                  )}
                </div>
                {receipt.tokens.length > 0 && (
                  <div
                    className="token-sequence"
                    aria-label="Token sequence"
                    role="list"
                  >
                    {receipt.tokens.map((part, i) => (
                      <motion.div
                        role="listitem"
                        key={`${part.start}-sequence`}
                        className={`sequence-node ${selected === i ? "active" : ""}`}
                        initial={reduce ? false : { opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          delay: reduce ? 0 : i * 0.055,
                          duration: 0.5,
                        }}
                      >
                        <span>{part.text}</span>
                        <small>{part.role}</small>
                      </motion.div>
                    ))}
                  </div>
                )}
                {receipt.intent ? (
                  <dl className="intent-grid">
                    <div>
                      <dt>Operation</dt>
                      <dd>{receipt.intent.operation}</dd>
                    </div>
                    <div>
                      <dt>Target</dt>
                      <dd>{receipt.intent.target}</dd>
                    </div>
                    <div>
                      <dt>Conditions</dt>
                      <dd>
                        {receipt.intent.conditions.join("; ") ||
                          "No extra conditions"}
                      </dd>
                    </div>
                    <div>
                      <dt>Scope</dt>
                      <dd>{receipt.intent.scope}</dd>
                    </div>
                  </dl>
                ) : (
                  <div className="intent-unavailable">
                    <span className="mono">INTENT NOT VERIFIED</span>
                    <p>
                      {isForge
                        ? "Experimental model output has no verified structured intent."
                        : "X-Ray checks the command you provide. It cannot infer or verify your goal."}
                    </p>
                  </div>
                )}
              </div>
              <div
                className="panel-divider"
                role="separator"
                tabIndex={0}
                aria-label="Resize command panel"
                aria-orientation="vertical"
                aria-valuenow={split}
                aria-valuemin={42}
                aria-valuemax={72}
                onKeyDown={(e) => {
                  if (
                    ["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)
                  ) {
                    e.preventDefault();
                    setSplit((v) =>
                      e.key === "Home"
                        ? 42
                        : e.key === "End"
                          ? 72
                          : Math.max(
                              42,
                              Math.min(
                                72,
                                v + (e.key === "ArrowRight" ? 2 : -2),
                              ),
                            ),
                    );
                  }
                }}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                  if (
                    !e.currentTarget.hasPointerCapture(e.pointerId) ||
                    !editorRef.current
                  )
                    return;
                  const rect = editorRef.current.getBoundingClientRect();
                  setSplit(
                    Math.max(
                      42,
                      Math.min(
                        72,
                        ((e.clientX - rect.left) / rect.width) * 100,
                      ),
                    ),
                  );
                }}
                onPointerUp={(e) => {
                  if (e.currentTarget.hasPointerCapture(e.pointerId))
                    e.currentTarget.releasePointerCapture(e.pointerId);
                }}
              >
                <span />
              </div>
              <aside
                className={`inspector-panel ${tab === "inspector" ? "mobile-active" : ""}`}
                id="inspector-panel"
                aria-label="Command inspector"
              >
                <div className="panel-top mono">03 / Understand & review</div>
                <div
                  id="token-explanation"
                  className="token-explanation"
                  aria-live="polite"
                >
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={selected}
                      initial={
                        reduce
                          ? false
                          : { opacity: 0, x: 24, filter: "blur(4px)" }
                      }
                      animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                      exit={{ opacity: 0, x: -12 }}
                      transition={{ duration: 0.2 }}
                    >
                      {token ? (
                        <>
                          <span className="mono token-role">
                            {token.role}
                            {!token.supported && " / Unverified"}
                          </span>
                          <h2>
                            <code>{token.text}</code>
                          </h2>
                          <p>{token.explanation}</p>
                          <p className="token-implication">
                            {token.implication}
                          </p>
                          {token.constraint && (
                            <span className="token-constraint mono">
                              Intent link / {token.constraint}
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <h2>No token detail.</h2>
                          <p>
                            Fix syntax errors or independently review
                            unsupported constructs.
                          </p>
                        </>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
                {syntax && (
                  <div className="verification-receipt">
                    <div>
                      <span>Bash syntax</span>
                      <strong
                        className={
                          syntax.syntax_valid ? "status-valid" : "status-danger"
                        }
                      >
                        {syntax.syntax_valid ? "Valid" : "Invalid / unverified"}
                      </strong>
                    </div>
                    <div>
                      <span>Static policy</span>
                      <strong className={`risk-${syntax.risk.toLowerCase()}`}>
                        {policyLabel}
                      </strong>
                    </div>
                    <div>
                      <span>Execution</span>
                      <strong>Disabled</strong>
                    </div>
                    <p className="static-label mono">
                      {syntax.risk} / {syntax.policy} · No runtime guarantee
                    </p>
                    {syntax.reasons.length > 0 && (
                      <ul className="policy-findings">
                        {syntax.reasons.map((reason) => (
                          <li key={reason}>{reason}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </aside>
            </div>
            <div className="review-reminder">
              <span aria-hidden="true">ⓘ</span>
              <p>
                {receipt.message}
                <br />
                <strong>
                  Review paths, units and side effects before you run anything.
                </strong>
              </p>
            </div>
            {copyError && (
              <p role="alert" className="copy-error">
                {copyError}
              </p>
            )}
            <span className="sr-only" role="status">
              {copied ? "Command copied to clipboard." : ""}
            </span>
            <details className="assumptions">
              <summary>
                <span className="mono">04 / Assumptions & limitations</span>
                <span aria-hidden="true">+</span>
              </summary>
              <div>
                <ul>
                  {[...receipt.assumptions, ...receipt.limitations].map(
                    (item, i) => (
                      <li key={i}>{item}</li>
                    ),
                  )}
                </ul>
              </div>
            </details>
          </motion.div>
        ) : (
          <motion.div
            className="workbench-empty"
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div
              className="empty-glyph"
              aria-hidden="true"
              initial={reduce ? false : { x: -50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 100, damping: 15 }}
            >
              {isForge ? ">_" : "[ ]"}
            </motion.div>
            <div>
              <span className="mono">YOUR WORKBENCH, READY</span>
              <h2>
                {isForge
                  ? "Start with an intention."
                  : "Every command has a story."}
              </h2>
              <p>
                {isForge
                  ? "Describe a supported operation above, or open a recipe. We’ll make the parameters explicit, then let you inspect the command."
                  : "Paste Bash above to inspect its syntax, static policy findings and curated token explanations. No command will run."}
              </p>
            </div>
            <Link href={isForge ? "/manual" : "/forge"} className="text-link">
              {isForge
                ? "Explore the Field Manual"
                : "Create a proposal in the Forge"}{" "}
              ↗
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
      <button
        className="new-request"
        onClick={() => {
          invalidate();
          setInput("");
          setRecipe(undefined);
          setParameters({});
          inputRef.current?.focus();
        }}
      >
        <span className="mono">
          {receipt ? "05" : "02"} / New {isForge ? "request" : "inspection"}
        </span>
        <span aria-hidden="true">↗</span>
      </button>
      <div className="workspace-footnote">
        <span className="mono">PROPOSAL ONLY / HUMAN REVIEW REQUIRED</span>
        <Link href="/bench">What these checks can tell you ↗</Link>
      </div>
    </main>
  );
}
