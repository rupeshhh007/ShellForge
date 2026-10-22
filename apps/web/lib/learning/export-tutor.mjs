/** Run with Node 22+: node --experimental-strip-types lib/learning/export-tutor.mjs [--check]. */
import fs from "node:fs";
import { CASES, EVALUATOR, evaluateProblem } from "./cases.ts";
const questions = {
  "missing-100": [
    "What happens when you round 99 MiB plus one byte up to whole MiB?",
    "Which interval of byte sizes rounds to exactly 100 units?",
    "Does adding + change the unit size, or the comparison operator?",
  ],
  "locked-room": [
    "Which owner bit is missing from mode 0600 when the object is a directory?",
    "How does reading a directory’s names differ from searching for a known child?",
    "Why can an execute-only directory allow a known pathname but prevent enumeration?",
  ],
  "sticky-file": [
    "Who owns the parent directory, and who owns the entry you want to unlink?",
    "Which permissions belong to the directory rather than the file?",
    "Does -f bypass sticky ownership, or only change the treatment of missing operands?",
  ],
  "beat-model": [
    "Which comparison operator did the saved model add to the reference predicate?",
    "What explicit contract are you checking when the original request says ambiguous MB?",
    "Can a command be syntactically valid and still select a different rounded size bucket?",
  ],
};
export function tutorEvidence() {
  return {
    schema: 1,
    evaluator: EVALUATOR,
    cases: Object.fromEntries(
      CASES.map((l) => {
        const r = evaluateProblem(l.problem);
        return [
          l.id,
          {
            revision: l.revision,
            fixture: l.problem.fixture,
            commands: { a: l.problem.a, b: l.problem.b },
            actual: {
              a: {
                matches: r.a.matches,
                status: r.a.status,
                traces: r.a.traces,
                errors: r.a.errors,
              },
              b: { matches: r.b.matches, status: r.b.status },
            },
            rule: l.rule,
            questions: questions[l.id],
          },
        ];
      }),
    ),
  };
}
const destination = new URL(
  "../../../../services/api/tutor/evidence.json",
  import.meta.url,
);
const serialized = JSON.stringify(tutorEvidence(), null, 2) + "\n";
if (process.argv.includes("--check")) {
  if (fs.readFileSync(destination, "utf8") !== serialized)
    throw Error(
      "Tutor grounding export is stale; regenerate from the evaluator.",
    );
} else if (
  process.argv[1] &&
  new URL("file://" + process.argv[1]).href === import.meta.url
)
  fs.writeFileSync(destination, serialized);
