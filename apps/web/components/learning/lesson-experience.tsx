"use client";
import { useMemo, useState, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import {
  lessonById,
  evaluateProblem,
  type Problem,
} from "@/lib/learning/cases";
import {
  initialSession,
  recoverSession,
  transition,
  investigationRecord,
  type Action,
  type Prediction,
} from "@/lib/learning/session";
import { searchWitness, type Certificate } from "@/lib/counterexamples/search";
import {
  modeString,
  permissionString,
  type TraceEvent,
} from "@/lib/impact/engine";
import { useMotionPreference } from "@/lib/use-motion-preference";
import { useLearningProgress, saveActions } from "./progress-store";
import { TutorQuestion } from "./tutor-question";
type Frame = { side: "A" | "B"; event: TraceEvent };
export function LessonExperience({
  id,
  embedded = false,
  sourceCommit = "local",
}: {
  id: string;
  embedded?: boolean;
  sourceCommit?: string;
}) {
  const lesson = lessonById(id),
    store = useLearningProgress();
  const session = useMemo(
    () =>
      store.progress.logs[id]
        ? recoverSession(id, store.progress.logs[id].actions)
        : initialSession(lesson),
    [id, lesson, store.progress],
  );
  const [error, setError] = useState(""),
    [witness, setWitness] = useState<Certificate | null>(null),
    [lens, setLens] = useState(false),
    [step, setStep] = useState(0),
    [playing, setPlaying] = useState(false),
    [speed, setSpeed] = useState(450),
    [selected, setSelected] = useState(
      lesson.problem.fixture.entries.at(-1)!.path,
    ),
    [repair, setRepair] = useState(lesson.problem.a.command),
    [manualInspection, setManualInspection] = useState<number | null>(null);
  const reduce = useMotionPreference();
  const comparison = useMemo(() => evaluateProblem(lesson.problem), [lesson]);
  const frames = useMemo<Frame[]>(
    () => [
      ...comparison.a.events.map((event) => ({ side: "A" as const, event })),
      ...comparison.b.events.map((event) => ({ side: "B" as const, event })),
    ],
    [comparison],
  );
  const isRevealed = ["run", "dissect", "transfer", "complete"].includes(
      session.stage,
    ),
    finished = step >= frames.length - 1;
  useEffect(() => {
    if (!playing || session.stage !== "run" || finished) return;
    const timer = setTimeout(
      () => setStep((s) => Math.min(frames.length - 1, s + 1)),
      speed,
    );
    return () => clearTimeout(timer);
  }, [playing, session.stage, finished, frames.length, speed, step]);
  const active =
    isRevealed && session.stage === "run" ? frames[step] : undefined;
  const inspectPath =
    (manualInspection === step ? selected : active?.event.path) ?? selected;
  const entry =
    lesson.problem.fixture.entries.find((e) => e.path === inspectPath) ??
    lesson.problem.fixture.entries.find((e) => e.path === selected)!;
  function act(action: Action) {
    try {
      const next = transition(lesson, session, action);
      saveActions(id, lesson.revision, next.actions);
      setError("");
      if (action.type === "run") {
        setStep(0);
        setPlaying(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid lesson action.");
    }
  }
  function exportRecord() {
    try {
      const record = investigationRecord(
        lesson,
        session,
        undefined,
        sourceCommit,
      );
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(record, null, 2)], {
          type: "application/json",
        }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `shellforge-${id}-investigation.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(String(e));
    }
  }
  return (
    <div className={`arl-experience arl-${lesson.theme}`}>
      <div className="arl-case-intro">
        {!embedded && (
          <>
            <Link href="/" className="arl-back">
              ← All case files
            </Link>
            <h1>{lesson.title}</h1>
          </>
        )}
        <p>{lesson.intro}</p>
        {lesson.model && (
          <div className="arl-provenance">
            <strong>Saved Evaluation · selected rank-16 Qwen</strong>
            <p>Original request: {lesson.model.instruction}</p>
            <code>Record {lesson.model.id}</code>
            <p>{lesson.model.review}</p>
          </div>
        )}
      </div>
      <ol className="arl-stages" aria-label="Investigation stages">
        {["Observe", "Predict", "Run", "Dissect", "Transfer"].map((name, i) => {
          const stages = ["observe", "predict", "run", "dissect", "transfer"];
          const effective =
            session.stage === "locked"
              ? "predict"
              : session.stage === "complete"
                ? "transfer"
                : session.stage;
          return (
            <li
              key={name}
              aria-current={
                stages.indexOf(effective) === i ? "step" : undefined
              }
            >
              {name}
            </li>
          );
        })}
      </ol>
      {store.warning && (
        <p role="status" className="arl-notice">
          {store.warning}
        </p>
      )}
      <CommandSplit
        a={lesson.problem.a.prepare ?? lesson.problem.a.command}
        b={lesson.problem.b.prepare ?? lesson.problem.b.command}
        enabled={session.stage === "dissect" || session.stage === "complete"}
        focused={lens}
        onFocus={() => setLens((v) => !v)}
      />
      {lens && isRevealed && (
        <motion.section
          layout
          className="arl-lens-insight"
          initial={reduce ? false : { opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <h2>Under the symbol.</h2>
          <p>{lesson.rule}</p>
          <div>
            {[...comparison.difference.onlyA, ...comparison.difference.onlyB]
              .slice(0, 1)
              .map((path) => (
                <div key={path}>
                  <code>{path}</code>
                  {(["a", "b"] as const).map((side) => (
                    <p key={side}>
                      <strong>{side.toUpperCase()}: </strong>
                      {comparison[side].traces[path]
                        ?.map((t) => t.detail)
                        .join(" ") || comparison[side].message}
                    </p>
                  ))}
                </div>
              ))}
          </div>
          {comparison.a.errors.map((e) => (
            <p key={e}>{e}</p>
          ))}
        </motion.section>
      )}
      {(lesson.problem.a.prepare || lesson.problem.b.prepare) && (
        <p className="arl-caption">
          Each branch starts from the same fixture, applies its shown
          preparation, then runs <code>{lesson.problem.a.command}</code>.
          Preparation events are included in the trace.
        </p>
      )}
      {session.stage !== "transfer" && session.stage !== "complete" && (
        <>
          <div className={`arl-scene ${lens ? "lens-focused" : ""}`}>
            <section
              className="arl-evidence-board"
              aria-label="Initial virtual evidence"
            >
              <div className="arl-board-title">
                <span>Initial state · /lab</span>
                <span>student · uid 1000</span>
              </div>
              <div className="arl-file-grid">
                {lesson.problem.fixture.entries
                  .filter((e) => e.path !== "/lab")
                  .map((file, i) => {
                    const seen =
                      session.stage === "dissect"
                        ? frames
                        : session.stage === "run"
                          ? frames.slice(0, step + 1)
                          : [];
                    const fileEvents = seen.filter(
                        (f) => f.event.path === file.path,
                      ),
                      last = fileEvents.at(-1),
                      matched = fileEvents.some(
                        (f) => f.event.stage === "match",
                      );
                    const predicate =
                      last?.event.stage === "predicate"
                        ? /: (pass|fail|skip)\./.exec(last.event.detail)?.[1]
                        : undefined;
                    const change =
                      last?.event.stage === "change"
                        ? comparison[
                            last.side === "A" ? "a" : "b"
                          ].changes.find((c) => c.path === file.path)
                        : undefined;
                    return (
                      <motion.button
                        layout
                        key={file.path}
                        className={`arl-file ${file.kind}`}
                        data-path={file.path}
                        data-computed={last?.event.stage ?? "unvisited"}
                        data-permission={
                          last?.event.stage === "permission"
                            ? last.event.detail.includes("denied")
                              ? "denied"
                              : "granted"
                            : undefined
                        }
                        data-match={matched}
                        data-predicate={predicate}
                        data-change={change?.kind}
                        aria-label={`Inspect ${file.path}`}
                        aria-pressed={entry?.path === file.path}
                        onClick={() => {
                          setSelected(file.path);
                          setManualInspection(step);
                          setPlaying(false);
                        }}
                        animate={{
                          y:
                            active?.event.path === file.path && !reduce
                              ? -8
                              : 0,
                          rotate: reduce ? 0 : [-3, 2, -1, 3][i % 4],
                        }}
                        transition={{
                          type: "spring",
                          stiffness: 240,
                          damping: 25,
                        }}
                      >
                        <span className="arl-file-fold" aria-hidden="true" />
                        <span className="arl-file-kind">
                          {file.kind === "directory"
                            ? "directory"
                            : "evidence file"}
                        </span>
                        <strong>{file.path.split("/").at(-1)}</strong>
                        <code>{file.size.toLocaleString("en-US")} B</code>
                        <span className="arl-file-mode">
                          {modeString(file.mode)} · uid {file.uid}
                        </span>
                        {last && (
                          <span className="arl-event-stamp">
                            {last.side} ·{" "}
                            {predicate ??
                              (change?.kind === "removed"
                                ? "would remove"
                                : last.event.stage)}
                          </span>
                        )}
                      </motion.button>
                    );
                  })}
              </div>
              <p className="arl-caption">
                Synthetic metadata only. Click any object to inspect it. No file
                contents or host commands exist here.
              </p>
            </section>
            <div className="arl-investigation-rail">
              <AnimatePresence mode="wait">
                <motion.aside
                  key={entry?.path}
                  className="arl-inspector"
                  initial={reduce ? false : { opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  aria-label="Evidence inspector"
                >
                  <span className="arl-inspector-title">Under the lens</span>
                  <h2>{entry?.path.split("/").at(-1)}</h2>
                  <code>{entry?.path}</code>
                  <dl>
                    <div>
                      <dt>Logical size</dt>
                      <dd>{entry?.size.toLocaleString("en-US")} bytes</dd>
                    </div>
                    <div>
                      <dt>Type</dt>
                      <dd>{entry?.kind}</dd>
                    </div>
                    <div>
                      <dt>Permission bits</dt>
                      <dd>{entry && permissionString(entry)}</dd>
                    </div>
                    <div>
                      <dt>Mode / owner</dt>
                      <dd>
                        {entry && modeString(entry.mode)} / uid {entry?.uid}
                      </dd>
                    </div>
                  </dl>
                  <Link
                    href={`/lab?command=${encodeURIComponent(lesson.problem.a.command)}`}
                  >
                    Open the free-form lab ↗
                  </Link>
                </motion.aside>
              </AnimatePresence>
              {session.stage === "run" && (
                <section
                  className="arl-trace-loupe"
                  aria-label="Evidence controls beside the files"
                >
                  <div className="arl-loupe-event">
                    <strong>
                      Branch {active?.side} · {active?.event.stage}
                    </strong>
                    <code>{active?.event.path}</code>
                    <p>{active?.event.detail}</p>
                  </div>
                  <div>
                    <button
                      disabled={!step}
                      onClick={() => {
                        setPlaying(false);
                        setStep((s) => s - 1);
                      }}
                    >
                      Back one step
                    </button>
                    <button
                      disabled={finished}
                      onClick={() => {
                        setPlaying(false);
                        setStep((s) => s + 1);
                      }}
                    >
                      Step evidence →
                    </button>
                    <button
                      disabled={finished}
                      onClick={() => setPlaying((v) => !v)}
                    >
                      {playing && !finished
                        ? "Pause beside files"
                        : "Play beside files"}
                    </button>
                  </div>
                  <span>
                    {step + 1} / {frames.length} interpreter events
                  </span>
                </section>
              )}
            </div>
          </div>
          {session.stage === "observe" && (
            <div className="arl-action-bar">
              <p>
                Look closely. The filenames are clues; the metadata is evidence.
              </p>
              <button className="button" onClick={() => act({ type: "begin" })}>
                Make a prediction →
              </button>
            </div>
          )}
          {session.stage === "predict" && (
            <PredictionForm
              animateToTray
              key="first"
              problem={lesson.problem}
              title="Your hypothesis"
              submit="Lock my prediction"
              onSubmit={(prediction) => act({ type: "lock", prediction })}
            />
          )}
          {session.firstPrediction && (
            <Hypothesis
              prediction={session.firstPrediction}
              correct={isRevealed ? session.firstCorrect : null}
            />
          )}
          {session.stage === "locked" && (
            <div className="arl-action-bar">
              <p>
                Your first prediction is locked. It cannot be changed after
                seeing the result.
              </p>
              <button className="button" onClick={() => act({ type: "run" })}>
                Run both virtual commands →
              </button>
            </div>
          )}
          {session.stage === "run" && (
            <section
              className="arl-playback"
              aria-label="Computed teaching timeline"
            >
              <div className="arl-playback-top">
                <h2>Follow the evidence.</h2>
                <span>
                  {step + 1} / {frames.length} actual events
                </span>
              </div>
              <div className="playback-controls">
                <button
                  onClick={() => setPlaying((v) => !v)}
                  disabled={finished}
                >
                  {playing && !finished ? "Pause evidence" : "Play evidence"}
                </button>
                <button
                  disabled={!step}
                  onClick={() => {
                    setPlaying(false);
                    setStep((s) => s - 1);
                  }}
                >
                  Previous event
                </button>
                <button
                  disabled={finished}
                  onClick={() => {
                    setPlaying(false);
                    setStep((s) => s + 1);
                  }}
                >
                  Next event
                </button>
                <button
                  onClick={() => {
                    setStep(0);
                    setPlaying(false);
                  }}
                >
                  Rewind evidence
                </button>
                <label>
                  Speed
                  <select
                    aria-label="Evidence speed"
                    value={speed}
                    onChange={(e) => setSpeed(Number(e.target.value))}
                  >
                    <option value={900}>Slow</option>
                    <option value={450}>Normal</option>
                    <option value={150}>Fast</option>
                  </select>
                </label>
              </div>
              <input
                aria-label="Evidence event"
                type="range"
                min={0}
                max={frames.length - 1}
                value={step}
                onChange={(e) => {
                  setPlaying(false);
                  setStep(Number(e.target.value));
                }}
              />
              <div
                className="arl-current-event"
                aria-live={playing ? "off" : "polite"}
              >
                <strong>
                  Branch {active?.side} · {active?.event.stage}
                </strong>
                <code>{active?.event.path}</code>
                <p>{active?.event.detail}</p>
              </div>
              <button
                className="arl-link-button"
                onClick={() => {
                  setStep(frames.length - 1);
                  setPlaying(false);
                }}
              >
                Show complete computed trace
              </button>
              {finished && (
                <>
                  <Outcome problem={lesson.problem} />
                  <button
                    className="button"
                    onClick={() => act({ type: "dissect" })}
                  >
                    Dissect the discrepancy →
                  </button>
                </>
              )}
            </section>
          )}
          {session.stage === "dissect" && (
            <section className="arl-dissection">
              <h2>Prove what changed.</h2>
              <p>{lesson.rule}</p>
              <Outcome problem={lesson.problem} />
              <div className="arl-action-bar">
                <button
                  className="button"
                  onClick={() => {
                    setWitness(
                      searchWitness(
                        lesson.problem.a,
                        lesson.problem.b,
                        undefined,
                        lesson.problem.constraints,
                      ),
                    );
                    setLens(true);
                  }}
                >
                  Find a counterexample
                </button>
                <span>
                  Both branches replayed against one bounded, constructed
                  fixture.
                </span>
              </div>
              <AnimatePresence>
                {witness && (
                  <motion.div
                    className="arl-witness"
                    initial={reduce ? false : { opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <Witness certificate={witness} />
                  </motion.div>
                )}
              </AnimatePresence>
              <PredictionForm
                key="revised"
                problem={lesson.problem}
                title="Correct your hypothesis"
                submit="Verify revised prediction"
                onSubmit={(prediction) => act({ type: "revise", prediction })}
              />
              {session.attempts.length > 1 && (
                <p role="status" className="arl-verdict">
                  {session.attempts.at(-1)?.correct
                    ? "Revised prediction agrees with the interpreter."
                    : "This revision still differs in the reported paths or final status."}{" "}
                  First prediction remains{" "}
                  {session.firstCorrect
                    ? "correct"
                    : "different from the result"}
                  .
                </p>
              )}
              {lesson.repairCommand && (
                <div className="arl-repair">
                  <label htmlFor={`repair-${id}`}>
                    Repair the model command against the reviewed reference
                    contract
                  </label>
                  <input
                    id={`repair-${id}`}
                    value={repair}
                    onChange={(e) => setRepair(e.target.value)}
                    maxLength={2000}
                  />
                  <button
                    onClick={() => act({ type: "repair", command: repair })}
                  >
                    Verify command repair
                  </button>
                  {session.repair && (
                    <p role="status">
                      {session.repair.accepted
                        ? "Repair meets the explicit parsed reference constraints."
                        : "Repair does not meet the explicit parsed reference constraints. Unsupported syntax cannot succeed."}
                    </p>
                  )}
                </div>
              )}
              <button
                className="button"
                disabled={
                  !session.attempts.at(-1)?.correct ||
                  (!!lesson.repairCommand && !session.repair?.accepted)
                }
                onClick={() => act({ type: "transfer" })}
              >
                Try an unseen boundary →
              </button>
            </section>
          )}
        </>
      )}
      {session.stage === "transfer" && (
        <section className="arl-transfer">
          <h2>A new scene. Same rule?</h2>
          <p>
            This fixture was withheld until the investigation. The follow-up is
            scored once, independently of your first answer.
          </p>
          <ProblemObjects problem={lesson.transfer} />
          <CommandSplit
            a={lesson.transfer.a.command}
            b={lesson.transfer.b.command}
            enabled={false}
            focused={false}
            onFocus={() => {}}
          />
          <PredictionForm
            problem={lesson.transfer}
            title="Transfer your understanding"
            submit="Commit follow-up answer"
            onSubmit={(prediction) =>
              act({ type: "answer-transfer", prediction })
            }
          />
        </section>
      )}
      {session.stage === "complete" && (
        <section className="arl-record">
          <h2>Investigation recorded.</h2>
          <p className="arl-verdict">
            First prediction: {session.firstCorrect ? "agreed" : "differed"} ·
            Follow-up:{" "}
            {session.transfer?.correct
              ? "agreed with the interpreter"
              : "needs another investigation"}
            .
          </p>
          <p>
            This is local practice evidence. A single correct answer is not
            proof of mastery.
          </p>
          <Outcome problem={lesson.transfer} />
          <p>{lesson.rule}</p>
          <div className="playback-controls">
            <button className="button" onClick={exportRecord}>
              Export Investigation Record
            </button>
            <button
              onClick={() => {
                const details =
                  document.querySelector<HTMLDetailsElement>(
                    ".arl-print-record",
                  );
                if (details) details.open = true;
                window.print();
              }}
            >
              Print investigation
            </button>
            <Link href="/beat">Investigate a real model prediction ↗</Link>
          </div>
          <details className="arl-print-record">
            <summary>Inspect the full reproducible record</summary>
            <pre>
              {JSON.stringify(
                investigationRecord(
                  lesson,
                  session,
                  "export-time-assigned-on-download",
                  sourceCommit,
                ),
                null,
                2,
              )}
            </pre>
          </details>
        </section>
      )}
      {session.stage !== "complete" && session.firstPrediction && (
        <TutorQuestion
          id={id}
          prediction={session.firstPrediction}
          onHint={(index) => act({ type: "hint", index })}
        />
      )}
      {session.stage !== "complete" && (
        <Hints
          id={id}
          used={session.hintsUsed}
          onHint={(index) => act({ type: "hint", index })}
        />
      )}
      <div className="arl-sources">
        {lesson.sources.map((source) => (
          <a
            key={source.url}
            href={source.url}
            target="_blank"
            rel="noreferrer"
          >
            {source.label} ↗
          </a>
        ))}
      </div>
      <details className="arl-reset">
        <summary>Start a new investigation</summary>
        <p>
          This clears this case’s local action log and first prediction. Export
          a completed record before resetting if you want to preserve it.
        </p>
        <button
          onClick={() => {
            saveActions(id, lesson.revision, []);
            setStep(0);
            setPlaying(false);
            setWitness(null);
            setLens(false);
          }}
        >
          Reset this case
        </button>
      </details>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
function PredictionForm({
  problem,
  title,
  submit,
  onSubmit,
  animateToTray = false,
}: {
  problem: Problem;
  title: string;
  submit: string;
  animateToTray?: boolean;
  onSubmit: (p: Prediction) => void;
}) {
  const [paths, setPaths] = useState<string[]>([]),
    [status, setStatus] = useState<Prediction["status"] | "">("");
  return (
    <form
      className="arl-prediction"
      onSubmit={(e) => {
        e.preventDefault();
        if (status) onSubmit({ paths, status });
      }}
    >
      <h2>{title}</h2>
      <p>{problem.question}</p>
      <fieldset>
        <legend>
          Select the reported paths · an empty selection means no files
        </legend>
        {problem.fixture.entries
          .filter((e) => e.path !== "/lab")
          .map((e) => (
            <label className="arl-prediction-path" key={e.path}>
              <input
                type="checkbox"
                checked={paths.includes(e.path)}
                onChange={() =>
                  setPaths((current) =>
                    current.includes(e.path)
                      ? current.filter((p) => p !== e.path)
                      : [...current, e.path],
                  )
                }
              />
              <motion.span
                layoutId={
                  animateToTray && paths.includes(e.path)
                    ? `prediction-${e.path}`
                    : undefined
                }
              >
                {e.path}
              </motion.span>
              <code>{e.size.toLocaleString("en-US")} B</code>
            </label>
          ))}
      </fieldset>
      <fieldset className="arl-status-choices">
        <legend>Predict final status</legend>
        {(["ok", "partial", "error"] as const).map((value) => (
          <label key={value}>
            <input
              type="radio"
              name={`${submit}-status`}
              value={value}
              checked={status === value}
              onChange={() => setStatus(value)}
            />
            {value === "ok"
              ? "Completes"
              : value === "partial"
                ? "Partial traversal"
                : "Operation denied / error"}
          </label>
        ))}
      </fieldset>
      <button className="button" disabled={!status}>
        {submit}
      </button>
    </form>
  );
}
function Hypothesis({
  prediction,
  correct,
}: {
  prediction: Prediction;
  correct: boolean | null;
}) {
  return (
    <motion.section
      layout
      className="arl-hypothesis"
      aria-label="Locked first prediction"
    >
      <strong>Locked hypothesis</strong>
      <div>
        {prediction.paths.length ? (
          prediction.paths.map((path) => (
            <motion.code layoutId={`prediction-${path}`} key={path}>
              {path}
            </motion.code>
          ))
        ) : (
          <span>No reported paths</span>
        )}
      </div>
      <span>Predicted status: {prediction.status}</span>
      {correct !== null && (
        <p>
          {correct
            ? "Your first prediction agrees with the computed result."
            : "Your first prediction differs from the computed result. Inspect paths and status below."}
        </p>
      )}
    </motion.section>
  );
}
function Outcome({ problem }: { problem: Problem }) {
  const value = evaluateProblem(problem);
  return (
    <div className="arl-outcomes" aria-label="Independently computed outcomes">
      {(["a", "b"] as const).map((kind) => (
        <article key={kind}>
          <h3>Command {kind.toUpperCase()}</h3>
          <strong>{value[kind].status}</strong>
          <ul>
            {value[kind].matches.length ? (
              value[kind].matches.map((path) => (
                <li key={path}>
                  <code>{path}</code>
                </li>
              ))
            ) : (
              <li>No reported paths</li>
            )}
          </ul>
          {value[kind].errors.map((error) => (
            <p key={error} className="arl-denied">
              {error}
            </p>
          ))}
          {value[kind].changes.map((c) => (
            <p key={c.path}>
              {c.kind}: {c.path}
            </p>
          ))}
        </article>
      ))}
      {value.difference.changedPaths.length > 0 && (
        <dl className="arl-state-diffs">
          {value.difference.changedPaths.map((path) => (
            <div key={path}>
              <dt>
                Final metadata · <code>{path}</code>
              </dt>
              {(["a", "b"] as const).map((side) => {
                const entry = value[side].after.entries.find(
                  (e) => e.path === path,
                );
                return (
                  <dd key={side}>
                    <strong>{side.toUpperCase()}</strong>{" "}
                    {entry
                      ? `${entry.kind} · ${modeString(entry.mode)} · uid ${entry.uid} · modified ${entry.modified}`
                      : "absent"}
                  </dd>
                );
              })}
            </div>
          ))}
        </dl>
      )}
      <p className="arl-difference">
        Symmetric path difference:{" "}
        {[...value.difference.onlyA, ...value.difference.onlyB].join(", ") ||
          "none"}
        . Final-state differences:{" "}
        {value.difference.changedPaths.join(", ") || "none"}.
      </p>
    </div>
  );
}
function CommandSplit({
  a,
  b,
  enabled,
  focused,
  onFocus,
}: {
  a: string;
  b: string;
  enabled: boolean;
  focused: boolean;
  onFocus: () => void;
}) {
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let end = 0;
  while (
    end < a.length - start &&
    end < b.length - start &&
    a[a.length - 1 - end] === b[b.length - 1 - end]
  )
    end++;
  const prefix = a.slice(0, start),
    suffix = end ? a.slice(-end) : "";
  return (
    <section
      className={`arl-command-split ${focused ? "focused" : ""}`}
      aria-label="Compare the command characters"
    >
      <div>
        <span>A</span>
        <code>
          {prefix}
          <mark aria-label={a.slice(start, a.length - end) || "No modifier"}>
            <button
              className="arl-symbol-button"
              aria-label="Examine command A modifier"
              disabled={!enabled}
              aria-pressed={focused}
              onClick={onFocus}
            >
              {a.slice(start, a.length - end) || (
                <span className="arl-absent-symbol" aria-hidden="true" />
              )}
            </button>
          </mark>
          {suffix}
        </code>
      </div>
      <button
        aria-label="Focus the changed character"
        disabled={!enabled}
        aria-pressed={focused}
        onClick={onFocus}
      >
        <span aria-hidden="true">⌕</span>
        <span>
          {enabled ? "Examine the difference" : "One small difference"}
        </span>
      </button>
      <div>
        <span>B</span>
        <code>
          {prefix}
          <mark aria-label={b.slice(start, b.length - end) || "No modifier"}>
            <button
              className="arl-symbol-button"
              aria-label="Examine command B modifier"
              disabled={!enabled}
              aria-pressed={focused}
              onClick={onFocus}
            >
              {b.slice(start, b.length - end) || (
                <span className="arl-absent-symbol" aria-hidden="true" />
              )}
            </button>
          </mark>
          {suffix}
        </code>
      </div>
      <svg viewBox="0 0 600 40" preserveAspectRatio="none" aria-hidden="true">
        <path d="M300 0C300 28 120 10 120 40M300 0C300 28 480 10 480 40" />
      </svg>
    </section>
  );
}
function ProblemObjects({
  problem,
  activePath,
}: {
  problem: Problem;
  activePath?: string;
}) {
  return (
    <div className="arl-transfer-objects">
      {problem.fixture.entries
        .filter((e) => e.path !== "/lab")
        .map((e) => (
          <div key={e.path} data-active={e.path === activePath}>
            <strong>{e.path}</strong>
            <span>{e.kind}</span>
            <code>{e.size.toLocaleString("en-US")} B</code>
            <span>
              {modeString(e.mode)} · uid {e.uid}
            </span>
          </div>
        ))}
    </div>
  );
}
function Witness({ certificate: c }: { certificate: Certificate }) {
  const [branch, setBranch] = useState<"a" | "b">("a"),
    [step, setStep] = useState(0);
  const events = c.comparison?.[branch].events ?? [],
    frame = events[step];
  return (
    <section aria-label="Counterexample certificate">
      <h3>
        {c.status === "found"
          ? "A small witness. A real difference."
          : "Search result"}
      </h3>
      <p>{c.message}</p>
      {c.commands.a.command.startsWith("rm ") && (
        <p>
          The new fixture tests a missing operand. It explains where -f changes
          behavior; it does not unlock the original sticky directory.
        </p>
      )}
      <p>
        {c.evaluated} evaluated / {c.candidateCount} constructed candidates ·{" "}
        {c.version}
      </p>
      {c.fixture && (
        <>
          <ProblemObjects
            activePath={frame?.path}
            problem={{
              fixture: c.fixture,
              a: c.commands.a,
              b: c.commands.b,
              question: "",
            }}
          />
          <Outcome
            problem={{
              fixture: c.fixture,
              a: c.commands.a,
              b: c.commands.b,
              question: "",
            }}
          />
        </>
      )}
      {events.length > 0 && (
        <section
          className="arl-witness-replay"
          aria-label="Replay counterexample evidence"
        >
          <h4>Replay this witness.</h4>
          <div className="playback-controls">
            {(["a", "b"] as const).map((side) => (
              <button
                key={side}
                aria-pressed={branch === side}
                onClick={() => {
                  setBranch(side);
                  setStep(0);
                }}
              >
                Witness branch {side.toUpperCase()}
              </button>
            ))}
            <button disabled={!step} onClick={() => setStep((s) => s - 1)}>
              Previous witness event
            </button>
            <button
              disabled={step >= events.length - 1}
              onClick={() => setStep((s) => s + 1)}
            >
              Next witness event
            </button>
          </div>
          <input
            aria-label="Counterexample event"
            type="range"
            min={0}
            max={events.length - 1}
            value={step}
            onChange={(e) => setStep(Number(e.target.value))}
          />
          <div aria-live="polite">
            <strong>
              {step + 1}/{events.length} · {frame?.stage}
            </strong>
            <code>{frame?.path}</code>
            <p>{frame?.detail}</p>
          </div>
        </section>
      )}
      <details>
        <summary>Search bounds and minimality certificate</summary>
        <p>{c.domain}</p>
        <p>{c.minimality}</p>
        <p>Observable definition: {c.observables}</p>
        <code>{JSON.stringify(c.bounds)}</code>
      </details>
    </section>
  );
}
function Hints({
  id,
  used,
  onHint,
}: {
  id: string;
  used: number[];
  onHint: (n: number) => void;
}) {
  const lesson = lessonById(id);
  return (
    <aside className="arl-hints">
      <h3>A nudge, not a verdict.</h3>
      <div>
        {lesson.hints.map((text, i) => (
          <div key={i}>
            <button disabled={used.includes(i)} onClick={() => onHint(i)}>
              Clue {i + 1}
              {used.includes(i) ? " · opened" : " +"}
            </button>
            {used.includes(i) && (
              <motion.p
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {text}
              </motion.p>
            )}
          </div>
        ))}
      </div>
      <p className="arl-caption">
        Curated deterministic hints always work. Hints used are included in your
        record.
      </p>
    </aside>
  );
}
