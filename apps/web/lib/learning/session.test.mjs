import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { CASES, evaluateProblem, validateLesson } from "./cases.ts";
import {
  initialSession,
  transition,
  recoverSession,
  readProgress,
  investigationRecord,
  verifyRecord,
  conceptEvidence,
} from "./session.ts";
const answer = (lesson, transfer = false) => {
  const r = evaluateProblem(transfer ? lesson.transfer : lesson.problem).a;
  return { paths: r.matches, status: r.status };
};
function complete(lesson) {
  let s = initialSession(lesson);
  for (const action of [
    { type: "begin" },
    { type: "lock", prediction: answer(lesson) },
    { type: "run" },
    { type: "dissect" },
    ...(lesson.repairCommand
      ? [{ type: "repair", command: lesson.repairCommand }]
      : []),
    { type: "transfer" },
    { type: "answer-transfer", prediction: answer(lesson, true) },
  ])
    s = transition(lesson, s, action);
  return s;
}
for (const lesson of CASES)
  test(`${lesson.id} schema, full teaching loop and record replay`, () => {
    assert.equal(validateLesson(lesson), lesson);
    const s = complete(lesson);
    assert.equal(s.firstCorrect, true);
    assert.equal(s.transfer.correct, true);
    assert.deepEqual(recoverSession(lesson.id, s.actions), s);
    const record = investigationRecord(lesson, s, "2026-10-22T00:00:00Z");
    assert.equal(verifyRecord(record), true);
    record.actual.a.matches.push("/fake");
    assert.equal(verifyRecord(record), false);
  });
test("independent expected answers for three OS cases and transfers", () => {
  assert.deepEqual(answer(CASES[0]).paths, [
    "/lab/evidence/almost.bin",
    "/lab/evidence/exact.bin",
  ]);
  assert.equal(answer(CASES[1]).status, "partial");
  assert.deepEqual(answer(CASES[1]).paths, []);
  assert.equal(answer(CASES[1], true).status, "partial");
  assert.deepEqual(answer(CASES[1], true).paths, []);
  assert.deepEqual(evaluateProblem(CASES[1].transfer).b.matches, [
    "/lab/room/new-clue.txt",
  ]);
  assert.equal(answer(CASES[2]).status, "error");
  assert.equal(answer(CASES[2], true).status, "ok");
  assert.deepEqual(answer(CASES[2], true).paths, ["/lab/drop/my-note.txt"]);
  assert.deepEqual(answer(CASES[0], true).paths, [
    "/lab/evidence/edge.bin",
    "/lab/evidence/grain.bin",
  ]);
});
test("cannot reveal before lock, change first prediction, or skip transfer prerequisites", () => {
  const l = CASES[0];
  let s = initialSession(l);
  assert.throws(() => transition(l, s, { type: "run" }));
  s = transition(l, s, { type: "begin" });
  s = transition(l, s, {
    type: "lock",
    prediction: { paths: [], status: "ok" },
  });
  assert.throws(() =>
    transition(l, s, { type: "lock", prediction: answer(l) }),
  );
  s = transition(l, s, { type: "run" });
  s = transition(l, s, { type: "dissect" });
  assert.throws(() => transition(l, s, { type: "transfer" }));
  s = transition(l, s, { type: "revise", prediction: answer(l) });
  assert.equal(s.firstCorrect, false);
  assert.equal(s.attempts.at(-1).correct, true);
  assert.deepEqual(s.firstPrediction, { paths: [], status: "ok" });
  assert.throws(() =>
    transition(l, s, {
      type: "revise",
      prediction: { paths: ["/fake"], status: "ok" },
    }),
  );
  assert.equal(s.attempts.length, 2);
});
test("local recovery validates schema, bounds and actions instead of trusting stored scores", () => {
  const l = CASES[0],
    s = complete(l);
  const raw = JSON.stringify({
    schema: 1,
    logs: { [l.id]: { revision: 1, actions: s.actions, firstCorrect: false } },
  });
  const p = readProgress(raw);
  assert.equal(recoverSession(l.id, p.logs[l.id].actions).firstCorrect, true);
  assert.equal(conceptEvidence(p)["GNU size rounding"].transferCorrect, 1);
  for (const raw of [
    "{",
    "{}",
    JSON.stringify({ schema: 2, logs: {} }),
    JSON.stringify({ schema: 1, logs: { fake: { revision: 1, actions: [] } } }),
  ])
    assert.throws(() => readProgress(raw));
  assert.deepEqual(
    readProgress(
      JSON.stringify({
        schema: 1,
        logs: { [l.id]: { revision: 999, actions: [] } },
      }),
    ).logs,
    {},
  );
});
test("hints recorded once; follow-up is independently scored once", () => {
  const l = CASES[0];
  let s = initialSession(l);
  s = transition(l, s, { type: "hint", index: 0 });
  s = transition(l, s, { type: "hint", index: 0 });
  assert.deepEqual(s.hintsUsed, [0]);
  assert.throws(() => transition(l, s, { type: "hint", index: 9 }));
  for (const action of [
    { type: "begin" },
    { type: "lock", prediction: answer(l) },
    { type: "run" },
    { type: "dissect" },
    { type: "transfer" },
    { type: "answer-transfer", prediction: { paths: [], status: "ok" } },
  ])
    s = transition(l, s, action);
  assert.equal(s.firstCorrect, true);
  assert.equal(s.transfer.correct, false);
  assert.throws(() =>
    transition(l, s, { type: "answer-transfer", prediction: answer(l, true) }),
  );
});
test("Beat the Model excerpt is identical to genuine primary artifact and has explicit adjudication scope", () => {
  const p = JSON.parse(
    fs.readFileSync(
      new URL("../../public/research/final.json", import.meta.url),
    ),
  );
  const model = CASES[3].model,
    row = p.pairs.find((r) => r.id === model.id);
  assert.deepEqual(model.tuned, row.tuned);
  assert.equal(model.reference, row.reference);
  assert.equal(model.mode, "Saved Evaluation");
  assert.match(model.review, /ambiguous/);
  assert.equal(CASES[3].problem.a.command, "find . -size +10M");
});
test("runtime lesson schema rejects malformed, unsupported and ambiguous authoring contracts", () => {
  for (const mutate of [
    (l) => (l.title = 123),
    (l) => (l.theme = "unknown"),
    (l) => (l.hints = []),
    (l) => (l.problem.a.command = "find . | sh"),
    (l) => (l.problem.a.prepare = "rm ./evidence"),
    (l) => l.problem.fixture.entries.push({ ...l.problem.fixture.entries[0] }),
    (l) => (l.problem.constraints = { directories: ["/unknown"] }),
    (l) => (l.repairCommand = "find . -exec sh {} ;"),
  ]) {
    const l = structuredClone(CASES[0]);
    mutate(l);
    assert.throws(() => validateLesson(l));
  }
});
