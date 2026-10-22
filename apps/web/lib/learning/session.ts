import {
  type Lesson,
  lessonById,
  evaluateProblem,
  EVALUATOR,
} from "./cases.ts";
import { searchWitness } from "../counterexamples/search.ts";
import { parse, normalizePath } from "../impact/engine.ts";
export type Prediction = {
  paths: string[];
  status: "ok" | "partial" | "error";
};
export type Action =
  | { type: "begin" }
  | { type: "lock"; prediction: Prediction }
  | { type: "run" }
  | { type: "dissect" }
  | { type: "revise"; prediction: Prediction }
  | { type: "transfer" }
  | { type: "answer-transfer"; prediction: Prediction }
  | { type: "hint"; index: number }
  | { type: "repair"; command: string };
export type Session = {
  caseId: string;
  revision: number;
  stage:
    | "observe"
    | "predict"
    | "locked"
    | "run"
    | "dissect"
    | "transfer"
    | "complete";
  firstPrediction: Prediction | null;
  firstCorrect: boolean | null;
  attempts: { prediction: Prediction; correct: boolean }[];
  hintsUsed: number[];
  transfer: { prediction: Prediction; correct: boolean } | null;
  repair: { command: string; accepted: boolean } | null;
  actions: Action[];
};
export const initialSession = (lesson: Lesson): Session => ({
  caseId: lesson.id,
  revision: lesson.revision,
  stage: "observe",
  firstPrediction: null,
  firstCorrect: null,
  attempts: [],
  hintsUsed: [],
  transfer: null,
  repair: null,
  actions: [],
});
const same = (a: string[], b: string[]) =>
  JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
function validPrediction(
  lesson: Lesson,
  prediction: Prediction,
  transfer = false,
) {
  const problem = transfer ? lesson.transfer : lesson.problem;
  if (
    !prediction ||
    !Array.isArray(prediction.paths) ||
    prediction.paths.length > 12 ||
    new Set(prediction.paths).size !== prediction.paths.length ||
    !["ok", "partial", "error"].includes(prediction.status) ||
    prediction.paths.some(
      (p) => !problem.fixture.entries.some((e) => e.path === p),
    )
  )
    throw Error("Invalid prediction; state unchanged.");
}
export function score(
  lesson: Lesson,
  prediction: Prediction,
  transfer = false,
) {
  validPrediction(lesson, prediction, transfer);
  const result = evaluateProblem(transfer ? lesson.transfer : lesson.problem).a;
  return (
    same(prediction.paths, result.matches) &&
    prediction.status === result.status
  );
}
function repaired(lesson: Lesson, command: string) {
  if (
    !lesson.repairCommand ||
    typeof command !== "string" ||
    command.length > 2000
  )
    return false;
  try {
    const a = parse(command),
      b = parse(lesson.repairCommand);
    return (
      a.utility === b.utility &&
      normalizePath(a.path) === normalizePath(b.path) &&
      a.minDepth === b.minDepth &&
      a.maxDepth === b.maxDepth &&
      JSON.stringify(a.predicates.map((p) => [p.kind, p.value])) ===
        JSON.stringify(b.predicates.map((p) => [p.kind, p.value]))
    );
  } catch {
    return false;
  }
}
export function transition(
  lesson: Lesson,
  session: Session,
  action: Action,
): Session {
  if (
    session.caseId !== lesson.id ||
    session.revision !== lesson.revision ||
    session.actions.length >= 64
  )
    throw Error("Session version or action limit mismatch.");
  const next = { ...session };
  switch (action.type) {
    case "begin":
      if (session.stage !== "observe") throw Error("Observe first.");
      next.stage = "predict";
      break;
    case "lock":
      if (session.stage !== "predict")
        throw Error("Prediction must lock before reveal.");
      validPrediction(lesson, action.prediction);
      next.firstPrediction = structuredClone(action.prediction);
      next.firstCorrect = score(lesson, action.prediction);
      next.attempts = [
        {
          prediction: structuredClone(action.prediction),
          correct: next.firstCorrect,
        },
      ];
      next.stage = "locked";
      break;
    case "run":
      if (session.stage !== "locked")
        throw Error("Lock a prediction before running.");
      next.stage = "run";
      break;
    case "dissect":
      if (session.stage !== "run") throw Error("Run before dissecting.");
      next.stage = "dissect";
      break;
    case "revise":
      if (session.stage !== "dissect" || session.attempts.length >= 12)
        throw Error(
          "Revisions are limited to the dissection stage (12 attempts).",
        );
      validPrediction(lesson, action.prediction);
      next.attempts = [
        ...session.attempts,
        {
          prediction: structuredClone(action.prediction),
          correct: score(lesson, action.prediction),
        },
      ];
      break;
    case "repair":
      if (
        session.stage !== "dissect" ||
        !lesson.repairCommand ||
        typeof action.command !== "string" ||
        action.command.length > 2000
      )
        throw Error("Repair unavailable.");
      next.repair = {
        command: action.command,
        accepted: repaired(lesson, action.command),
      };
      break;
    case "transfer":
      if (
        session.stage !== "dissect" ||
        !session.attempts.at(-1)?.correct ||
        (lesson.repairCommand && !session.repair?.accepted)
      )
        throw Error(
          "Verify the corrected prediction and any required repair before transfer.",
        );
      next.stage = "transfer";
      break;
    case "answer-transfer":
      if (session.stage !== "transfer" || session.transfer)
        throw Error("Transfer is scored once per investigation.");
      validPrediction(lesson, action.prediction, true);
      next.transfer = {
        prediction: structuredClone(action.prediction),
        correct: score(lesson, action.prediction, true),
      };
      next.stage = "complete";
      break;
    case "hint":
      if (
        session.stage === "complete" ||
        !Number.isInteger(action.index) ||
        action.index < 0 ||
        action.index >= lesson.hints.length
      )
        throw Error("Invalid hint.");
      next.hintsUsed = [...new Set([...session.hintsUsed, action.index])];
      break;
    default:
      throw Error("Unknown learning action.");
  }
  next.actions = [...session.actions, structuredClone(action)];
  return next;
}
export function recoverSession(caseId: string, actions: unknown): Session {
  const lesson = lessonById(caseId);
  if (!Array.isArray(actions) || actions.length > 64)
    throw Error("Invalid action log.");
  return actions.reduce(
    (s, a) => transition(lesson, s, a),
    initialSession(lesson),
  );
}
export function investigationRecord(
  lesson: Lesson,
  session: Session,
  createdAt = new Date().toISOString(),
  sourceCommit = "local",
) {
  if (session.stage !== "complete")
    throw Error("Complete the independent transfer case before exporting.");
  const verified = recoverSession(lesson.id, session.actions);
  if (JSON.stringify(verified) !== JSON.stringify(session))
    throw Error("Session disagrees with action replay.");
  return {
    schema: "shellforge-investigation-v1",
    createdAt,
    sourceCommit,
    caseId: lesson.id,
    caseRevision: lesson.revision,
    evaluator: EVALUATOR,
    firstPrediction: session.firstPrediction,
    firstCorrect: session.firstCorrect,
    attempts: session.attempts,
    hintsUsed: session.hintsUsed,
    concepts: lesson.concepts,
    fixture: lesson.problem.fixture,
    commands: { a: lesson.problem.a, b: lesson.problem.b },
    actual: evaluateProblem(lesson.problem),
    counterexample: searchWitness(
      lesson.problem.a,
      lesson.problem.b,
      undefined,
      lesson.problem.constraints,
    ),
    correctedExplanation: lesson.rule,
    transfer: {
      problem: lesson.transfer,
      outcome: session.transfer,
      actual: evaluateProblem(lesson.transfer),
    },
    model: lesson.model ?? null,
    actions: session.actions,
    limitations: [
      "Synthetic metadata; no shell execution.",
      "A bounded witness search does not establish global equivalence.",
      "First and transfer answers are local practice evidence, not measured learning gains.",
    ],
  };
}
export function verifyRecord(record: unknown) {
  try {
    const r = record as ReturnType<typeof investigationRecord>;
    if (r.schema !== "shellforge-investigation-v1" || r.evaluator !== EVALUATOR)
      return false;
    const expected = investigationRecord(
      lessonById(r.caseId),
      recoverSession(r.caseId, r.actions),
      r.createdAt,
      r.sourceCommit,
    );
    return JSON.stringify(expected) === JSON.stringify(record);
  } catch {
    return false;
  }
}
export type Progress = {
  schema: 1;
  logs: Record<string, { revision: number; actions: Action[] }>;
};
export function readProgress(raw: string | null): Progress {
  if (!raw) return { schema: 1, logs: {} };
  if (raw.length > 200000) throw Error("Progress storage limit exceeded.");
  const value = JSON.parse(raw);
  if (
    value.schema !== 1 ||
    !value.logs ||
    typeof value.logs !== "object" ||
    Array.isArray(value.logs) ||
    Object.keys(value.logs).length > 12
  )
    throw Error("Unknown progress schema.");
  const logs: Progress["logs"] = {};
  for (const [id, row] of Object.entries(value.logs)) {
    const lesson = lessonById(id),
      item = row as Progress["logs"][string];
    if (item.revision !== lesson.revision) continue;
    const session = recoverSession(id, item.actions);
    logs[id] = { revision: session.revision, actions: session.actions };
  }
  return { schema: 1, logs };
}
export function conceptEvidence(progress: Progress) {
  const concepts: Record<
    string,
    { investigations: number; firstCorrect: number; transferCorrect: number }
  > = {};
  for (const [id, log] of Object.entries(progress.logs)) {
    const lesson = lessonById(id),
      session = recoverSession(id, log.actions);
    for (const concept of lesson.concepts) {
      const row = (concepts[concept] ??= {
        investigations: 0,
        firstCorrect: 0,
        transferCorrect: 0,
      });
      if (session.firstPrediction) row.investigations++;
      if (session.firstCorrect) row.firstCorrect++;
      if (session.transfer?.correct) row.transferCorrect++;
    }
  }
  return concepts;
}
