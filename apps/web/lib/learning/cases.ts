import {
  type Snapshot,
  type Entry,
  simulate,
  parse,
} from "../impact/engine.ts";
import { type Scenario, compare } from "../counterexamples/search.ts";
import modelEvidence from "./model-evidence.json" with { type: "json" };
export const EVALUATOR = "shellforge-learning-v1";
const MiB = 1048576;
const entry = (
  path: string,
  size: number,
  kind: Entry["kind"] = "file",
  mode = kind === "file" ? 0o644 : 0o755,
  uid = 1000,
): Entry => ({
  path,
  kind,
  size,
  mode,
  uid,
  gid: uid === 0 ? 0 : 1000,
  modified: 0,
});
const root = () => entry("/lab", 4096, "directory");
const snapshot = (entries: Entry[]): Snapshot => ({
  revision: 0,
  entries: [root(), ...entries],
});
export type Problem = {
  fixture: Snapshot;
  a: Scenario;
  b: Scenario;
  question: string;
  constraints?: { directories: string[] };
};
export type Lesson = {
  id: string;
  revision: number;
  title: string;
  shortTitle: string;
  concepts: string[];
  intro: string;
  theme: "size" | "permissions" | "sticky" | "model";
  problem: Problem;
  transfer: Problem;
  hints: string[];
  rule: string;
  sources: { label: string; url: string }[];
  model?: typeof modelEvidence;
  repairCommand?: string;
};
const findSource = {
  label: "GNU find: size and upward rounding",
  url: "https://www.gnu.org/software/findutils/manual/html_node/find_html/Size.html",
};
const sizeProblem = (n: number): Problem => ({
  fixture: snapshot([
    entry("/lab/evidence", 4096, "directory"),
    entry("/lab/evidence/almost.bin", (n - 1) * MiB + 1),
    entry("/lab/evidence/exact.bin", n * MiB),
    entry("/lab/evidence/over.bin", n * MiB + 1),
    entry("/lab/evidence/tiny.bin", 0),
  ]),
  a: { command: `find ./evidence -type f -size ${n}M` },
  b: { command: `find ./evidence -type f -size +${n}M` },
  question:
    "Which files does command A report, and does it complete without an error?",
});
export const CASES: readonly Lesson[] = [
  {
    id: "missing-100",
    revision: 1,
    title: "The Case of the Missing 100 MiB",
    shortTitle: "The 100 MiB mistake",
    concepts: ["GNU size rounding", "predicate inequalities"],
    theme: "size",
    intro:
      "Two commands differ by one character. Which files disappear from the result?",
    problem: sizeProblem(100),
    transfer: {
      fixture: snapshot([
        entry("/lab/evidence", 4096, "directory"),
        entry("/lab/evidence/grain.bin", 1),
        entry("/lab/evidence/edge.bin", MiB),
        entry("/lab/evidence/overflow.bin", MiB + 1),
      ]),
      a: { command: "find ./evidence -type f -size 1M" },
      b: { command: "find ./evidence -type f -size 1048576c" },
      question:
        "New boundary: which files match command A, the 1M rounded bucket?",
    },
    hints: [
      "M means 1,048,576 bytes in GNU find. Inspect exact logical bytes, not the filename.",
      "GNU find rounds bytes upward to whole units before comparison. What happens to 99 MiB + 1 byte?",
      "Compare ceil(bytes / 1,048,576) with 100. A has equality; B has a greater-than comparison.",
    ],
    rule: "-size NM tests ceil(bytes / 1,048,576) = N. +NM tests a rounded count greater than N. A c suffix uses exact one-byte units. A positive-byte file smaller than 1 MiB can still match 1M.",
    sources: [findSource],
  },
  {
    id: "locked-room",
    revision: 1,
    title: "The Locked Room",
    shortTitle: "The locked room",
    concepts: ["directory search", "ownership"],
    theme: "permissions",
    intro: "You can read a directory’s names. Can you actually walk into it?",
    problem: {
      constraints: { directories: ["/lab/room"] },
      fixture: snapshot([
        entry("/lab/room", 4096, "directory", 0o600),
        entry("/lab/room/clue.txt", 512),
      ]),
      a: { prepare: "chmod 600 ./room", command: "find ./room -type f" },
      b: { prepare: "chmod 700 ./room", command: "find ./room -type f" },
      question:
        "After the shown chmod preparation, what does command A report?",
    },
    transfer: {
      fixture: snapshot([
        entry("/lab/room", 4096, "directory", 0o111),
        entry("/lab/room/new-clue.txt", 512),
      ]),
      a: { command: "find ./room -type f" },
      b: { command: "find ./room/new-clue.txt -type f" },
      question:
        "A room has x but no r for its owner (0111). Does command A enumerate its children?",
    },
    hints: [
      "For a directory, x is search permission; it does not mean “run a program”.",
      "The fixed student owns this room. Compare owner rw- with rwx.",
      "This bounded walker requires r+x to descend. A known child can be resolved with ancestor x, but enumerating names needs r.",
    ],
    rule: "Directory search (x) and reading names (r) are distinct. This bounded walker requires both to descend. chmod requires ownership; no root elevation or ACLs are modeled.",
    sources: [
      {
        label: "Linux pathname resolution",
        url: "https://man7.org/linux/man-pages/man7/path_resolution.7.html",
      },
    ],
  },
  {
    id: "sticky-file",
    revision: 1,
    title: "The File That Wouldn’t Delete",
    shortTitle: "The stubborn file",
    concepts: ["unlink permissions", "sticky ownership"],
    theme: "sticky",
    intro:
      "The file is writable. The directory is writable. Deletion still fails.",
    problem: {
      fixture: snapshot([
        entry("/lab/drop", 4096, "directory", 0o1777, 0),
        entry("/lab/drop/report.txt", 256, "file", 0o666, 0),
      ]),
      a: { command: "rm ./drop/report.txt" },
      b: { command: "rm -f ./drop/report.txt" },
      question:
        "Which entries does command A remove? Predict its final status.",
    },
    transfer: {
      fixture: snapshot([
        entry("/lab/drop", 4096, "directory", 0o1777, 0),
        entry("/lab/drop/my-note.txt", 256, "file", 0o444, 1000),
      ]),
      a: { command: "rm ./drop/my-note.txt" },
      b: { command: "rm -f ./drop/my-note.txt" },
      question:
        "New owner, read-only file: student owns my-note.txt. Does command A remove it?",
    },
    hints: [
      "Deleting a name checks its parent directory, not the file’s write bit.",
      "1777 includes the sticky bit. Inspect both directory owner and file owner.",
      "The student owns neither the root-owned directory nor report.txt. -f ignores a missing operand; it does not bypass this ownership restriction.",
    ],
    rule: "Unlink needs parent w+x. In this sticky model the student must own the entry or the directory. A read-only student-owned file can be removed from a writable/searchable sticky directory. -f does not bypass permissions.",
    sources: [
      {
        label: "Linux unlink errors and sticky protection",
        url: "https://man7.org/linux/man-pages/man2/unlink.2.html",
      },
    ],
  },
  {
    id: "beat-model",
    revision: 1,
    title: "The AI Was Almost Right",
    shortTitle: "Beat the Model",
    concepts: ["model verification", "GNU size rounding"],
    theme: "model",
    intro:
      "This command came from the actual selected rank-16 model. Find the predicate mismatch against its saved reference contract.",
    problem: {
      fixture: snapshot([
        entry("/lab/almost.bin", 9 * MiB + 1),
        entry("/lab/exact.bin", 10 * MiB),
        entry("/lab/over.bin", 10 * MiB + 1),
      ]),
      a: { command: modelEvidence.tuned.prediction },
      b: { command: modelEvidence.reference },
      question:
        "Predict what the saved model command A actually selects. Its reference is command B.",
    },
    transfer: {
      fixture: snapshot([
        entry("/lab/new-boundary.bin", 9 * MiB + 512),
        entry("/lab/new-over.bin", 10 * MiB + 512),
      ]),
      a: { command: "find . -size 10M" },
      b: { command: "find . -size +10M" },
      question:
        "On this unseen fixture, which files match the repaired rounded-bucket command A?",
    },
    hints: [
      "Saved Evaluation: this is a genuine preserved output, not live generation.",
      "The source request uses “10MB”, which is ambiguous. This reviewed challenge explicitly checks the saved GNU-find 10M reference contract.",
      "A syntactically valid command can apply the wrong predicate. Remove the greater-than modifier to match the declared bucket contract.",
    ],
    rule: "The displayed prediction and reference have a deterministically demonstrable size-predicate difference. This challenge checks the explicit saved-reference contract; it does not adjudicate every interpretation of the original ambiguous MB wording, nor label every nonexact model output semantically wrong.",
    sources: [
      findSource,
      {
        label: "Actual final evaluation export",
        url: "https://github.com/rupeshhh007/ShellForge/blob/feat/shellforge-product-v2/reports/metrics/full-data-v1/tuned/generation_examples.jsonl",
      },
    ],
    model: modelEvidence,
    repairCommand: modelEvidence.reference,
  },
];
export function lessonById(id: string) {
  const lesson = CASES.find((c) => c.id === id);
  if (!lesson) throw Error("Unknown case ID");
  return lesson;
}
export function validateLesson(lesson: Lesson) {
  const text = (value: unknown, max = 2000) =>
    typeof value === "string" && value.trim().length > 0 && value.length <= max;
  const texts = (value: unknown, maxItems: number) =>
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= maxItems &&
    value.every((v) => text(v));
  if (
    !lesson ||
    !text(lesson.id, 40) ||
    !/^[a-z0-9-]+$/.test(lesson.id) ||
    !Number.isSafeInteger(lesson.revision) ||
    lesson.revision < 1 ||
    !text(lesson.title, 200) ||
    !text(lesson.shortTitle, 100) ||
    !text(lesson.intro) ||
    !text(lesson.rule) ||
    !texts(lesson.concepts, 8) ||
    !texts(lesson.hints, 3) ||
    !["size", "permissions", "sticky", "model"].includes(lesson.theme) ||
    !Array.isArray(lesson.sources) ||
    lesson.sources.length < 1 ||
    lesson.sources.some(
      (source) =>
        !text(source.label, 200) ||
        !text(source.url, 1000) ||
        !source.url.startsWith("https://"),
    )
  )
    throw Error("Invalid lesson schema");
  for (const problem of [lesson.problem, lesson.transfer]) {
    if (
      !problem ||
      !text(problem.question) ||
      !problem.fixture ||
      !Array.isArray(problem.fixture.entries) ||
      problem.fixture.entries.length > 12
    )
      throw Error("Invalid problem bounds");
    for (const scenario of [problem.a, problem.b]) {
      if (
        !scenario ||
        !text(scenario.command) ||
        (scenario.prepare !== undefined &&
          (!text(scenario.prepare) ||
            parse(scenario.prepare).utility !== "chmod"))
      )
        throw Error("Invalid lesson scenario");
    }
    if (
      problem.constraints &&
      (!Array.isArray(problem.constraints.directories) ||
        problem.constraints.directories.some(
          (path) =>
            !problem.fixture.entries.some(
              (e) => e.path === path && e.kind === "directory",
            ),
        ))
    )
      throw Error("Invalid lesson directory constraint");
    const result = compare(problem.a, problem.b, problem.fixture);
    if (
      [result.a, result.b].some(
        (r) => r.status === "unsupported" || r.program === null,
      )
    )
      throw Error("Lesson operation must be supported");
  }
  if (
    lesson.repairCommand !== undefined &&
    (!text(lesson.repairCommand) ||
      simulate(lesson.repairCommand, lesson.problem.fixture).status ===
        "unsupported")
  )
    throw Error("Invalid repair contract");
  return lesson;
}
if (new Set(CASES.map((c) => c.id)).size !== CASES.length)
  throw Error("Duplicate lesson ID");
for (const lesson of CASES) validateLesson(lesson);
export function evaluateProblem(problem: Problem) {
  return compare(problem.a, problem.b, problem.fixture);
}
export function simulateRepair(lesson: Lesson, command: string) {
  return simulate(command, lesson.problem.fixture);
}
