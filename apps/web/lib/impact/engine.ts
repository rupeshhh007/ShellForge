/** Pure virtual interpreter. No OS, network, filesystem, subprocess or shell APIs. */
export type Entry = Readonly<{
  path: string;
  kind: "file" | "directory";
  size: number;
  mode: number;
  uid: number;
  gid: number;
  modified: number;
}>;
export type Snapshot = Readonly<{
  entries: readonly Entry[];
  revision: number;
}>;
export type LabToken = {
  text: string;
  value: string;
  start: number;
  end: number;
  role: string;
  explanation: string;
};
export type Predicate = {
  kind: "type" | "name" | "size" | "perm" | "empty";
  value: string;
  token: number;
};
export type Program = {
  utility: "find" | "rm" | "chmod" | "mkdir" | "touch";
  path: string;
  predicates: Predicate[];
  minDepth: number;
  maxDepth: number;
  recursive: boolean;
  force: boolean;
  mode?: number;
  tokens: LabToken[];
};
export type Change = {
  path: string;
  kind: "added" | "removed" | "modified";
  before: Entry | null;
  after: Entry | null;
};
export type Trace = {
  token: number;
  label: string;
  passed: boolean | null;
  detail: string;
};
export type Result = {
  status: "ok" | "partial" | "unsupported" | "error";
  message: string;
  program: Program | null;
  matches: string[];
  visited: string[];
  errors: string[];
  traces: Record<string, Trace[]>;
  after: Snapshot;
  changes: Change[];
  hostExecuted: false;
};
export const ROOT = "/lab";
export const LIMITS = Object.freeze({
  command: 2000,
  tokens: 96,
  entries: 256,
  depth: 16,
  pattern: 64,
  history: 12,
});
export const IDENTITY = Object.freeze({
  name: "student",
  uid: 1000,
  gid: 1000,
});
const MiB = 1048576;
const node = (
  path: string,
  kind: Entry["kind"],
  size: number,
  mode = kind === "directory" ? 0o755 : 0o644,
  uid = 1000,
): Entry =>
  Object.freeze({
    path,
    kind,
    size,
    mode,
    uid,
    gid: uid === 0 ? 0 : 1000,
    modified: 0,
  });
export function seedFilesystem(): Snapshot {
  return Object.freeze({
    revision: 0,
    entries: Object.freeze([
      node(ROOT, "directory", 4096),
      node("/lab/data", "directory", 4096),
      node("/lab/data/empty.txt", "file", 0),
      node("/lab/data/threshold-99.bin", "file", 99 * MiB),
      node("/lab/data/threshold-99-plus-one.bin", "file", 99 * MiB + 1),
      node("/lab/data/threshold-100.bin", "file", 100 * MiB),
      node("/lab/data/threshold-100-plus-one.bin", "file", 100 * MiB + 1),
      node("/lab/data/archive.img", "file", 240 * MiB, 0o440),
      node("/lab/data/nested", "directory", 4096),
      node("/lab/data/nested/small.txt", "file", 512),
      node("/lab/data/nested/large image.bin", "file", 120 * MiB),
      node("/lab/data/.hidden", "file", 13),
      node("/lab/logs", "directory", 4096),
      node("/lab/logs/app.log", "file", 1536),
      node("/lab/logs/kernel.log", "file", 8192, 0o640, 0),
      node("/lab/home", "directory", 4096),
      node("/lab/home/student", "directory", 4096, 0o700),
      node("/lab/home/student/notes.txt", "file", 2048, 0o600),
      node("/lab/home/student/empty-dir", "directory", 4096),
      node("/lab/tmp", "directory", 4096, 0o1777, 0),
      node("/lab/tmp/cache", "directory", 4096),
      node("/lab/tmp/cache/a.tmp", "file", 3072),
      node("/lab/tmp/cache/b.tmp", "file", 4096, 0o444),
      node("/lab/tmp/root-owned.tmp", "file", 256, 0o644, 0),
      node("/lab/private", "directory", 4096, 0o700, 0),
      node("/lab/private/secret.txt", "file", MiB, 0o600, 0),
    ]),
  });
}
export function parent(path: string): string {
  return path.slice(0, path.lastIndexOf("/")) || "/";
}
export function basename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}
export function modeString(mode: number): string {
  return mode.toString(8).padStart(4, "0");
}
export function permissionString(entry: Entry): string {
  const bit = (n: number, s: string) => (entry.mode & n ? s : "-");
  return (
    (entry.kind === "directory" ? "d" : "-") +
    bit(0o400, "r") +
    bit(0o200, "w") +
    bit(0o100, "x") +
    bit(0o40, "r") +
    bit(0o20, "w") +
    bit(0o10, "x") +
    bit(0o4, "r") +
    bit(0o2, "w") +
    (entry.mode & 0o1000 ? (entry.mode & 1 ? "t" : "T") : bit(1, "x"))
  );
}
function allowed(e: Entry, mask: number): boolean {
  const shift = e.uid === IDENTITY.uid ? 6 : e.gid === IDENTITY.gid ? 3 : 0;
  return ((e.mode >> shift) & mask) === mask;
}
class Unsupported extends Error {}
function fail(message: string): never {
  throw new Unsupported(message);
}
/** No expansion: quotes group literal arguments. Shell operators are rejected. */
export function lex(command: string): LabToken[] {
  if (!command.trim()) fail("Enter one supported command.");
  if (command.length > LIMITS.command)
    fail(`Command exceeds ${LIMITS.command} characters.`);
  if (/[\x00-\x08\x0a-\x1f\x7f]/.test(command))
    fail("Control characters and multiple lines are not supported.");
  const tokens: LabToken[] = [];
  let i = 0;
  while (i < command.length) {
    if (/\s/.test(command[i])) {
      i++;
      continue;
    }
    const start = i;
    let value = "";
    if (command[i] === "'" || command[i] === '"') {
      const quote = command[i++];
      while (i < command.length && command[i] !== quote) {
        if (quote === '"' && /[$`\\]/.test(command[i]))
          fail(
            "Expansion and escapes inside double quotes are not modeled. Use a single-quoted literal.",
          );
        value += command[i++];
      }
      if (i === command.length) fail("Unclosed quote.");
      i++;
      if (i < command.length && !/\s/.test(command[i]))
        fail("Concatenated quoted words are outside the grammar.");
    } else {
      while (i < command.length && !/\s/.test(command[i])) {
        if (/[|&;()<>$`\\'"*?\[\]{}~#]/.test(command[i]))
          fail(
            "Shell operators, substitutions, expansions, comments and unquoted wildcards are not simulated. Quote literal arguments; use one command only.",
          );
        value += command[i++];
      }
    }
    tokens.push({
      text: command.slice(start, i),
      value,
      start,
      end: i,
      role: "Argument",
      explanation: "A literal argument; no expansion occurs.",
    });
    if (tokens.length > LIMITS.tokens)
      fail(`At most ${LIMITS.tokens} tokens are supported.`);
  }
  return tokens;
}
export function normalizePath(raw: string): string {
  if (!raw || raw.length > 240 || raw.includes("\0"))
    fail("Paths must contain 1–240 characters.");
  const segments = raw.split("/");
  if (segments.includes(".."))
    fail(
      "Parent-directory traversal (..) is not modeled. Choose a path inside /lab.",
    );
  const path =
    (raw.startsWith("/") ? "" : ROOT + "/") +
    segments.filter((s) => s && s !== ".").join("/");
  const normalized = path.startsWith("/") ? path : "/" + path;
  const final = normalized === ROOT + "/" ? ROOT : normalized;
  if (final !== ROOT && !final.startsWith(ROOT + "/"))
    fail("This path is outside the synthetic /lab filesystem.");
  if (final.split("/").length - 2 > LIMITS.depth)
    fail("Path exceeds virtual depth limit.");
  return final;
}
function octal(value: string): number {
  if (!/^[0-7]{3,4}$/.test(value))
    fail(
      "Only exact numeric modes (000–7777) are modeled; no symbolic or +/- modes.",
    );
  const mode = parseInt(value, 8);
  if (mode & 0o6000) fail("Setuid/setgid modes are not modeled.");
  return mode;
}
export function parse(command: string): Program {
  const tokens = lex(command);
  const words = tokens.map((t) => t.value);
  const utility = words[0];
  if (!["find", "rm", "chmod", "mkdir", "touch"].includes(utility))
    fail(
      `Operation '${utility}' is not simulated. Supported: find, rm, chmod, mkdir, touch.`,
    );
  tokens[0].role = "Operation";
  tokens[0].explanation =
    utility === "find"
      ? "Traverse synthetic directory entries and combine predicates with AND."
      : "Preview a modeled change to synthetic metadata only.";
  const p: Program = {
    utility: utility as Program["utility"],
    path: "",
    predicates: [],
    minDepth: 0,
    maxDepth: LIMITS.depth,
    recursive: false,
    force: false,
    tokens,
  };
  let i = 1;
  const argument = (): string => {
    if (i >= words.length)
      fail("An option or operation is missing its argument.");
    return words[i++];
  };
  if (utility === "find") {
    p.path = argument();
    if (p.path.startsWith("-") || ["!", "(", ")"].includes(p.path))
      fail(
        "An option-like starting path requires ./ or an absolute /lab path. Global find options are not modeled.",
      );
    normalizePath(p.path);
    tokens[1].role = "Traversal root";
    tokens[1].explanation =
      "Start here; depth zero is the selected entry itself. Hidden names are included.";
    const seen = new Set<string>();
    while (i < words.length) {
      const token = i;
      const option = argument();
      if (seen.has(option))
        fail(`Repeated ${option} is outside this deliberately strict grammar.`);
      seen.add(option);
      tokens[token].role = "Predicate";
      if (option === "-print") {
        if (i !== words.length) fail("-print must be the final action.");
        tokens[token].role = "Output";
        tokens[token].explanation =
          "List matches; never read their contents or execute them.";
        continue;
      }
      if (option === "-empty") {
        p.predicates.push({ kind: "empty", value: "", token });
        tokens[token].explanation =
          "Match zero-length files or directories containing no entries.";
        continue;
      }
      if (
        ![
          "-type",
          "-name",
          "-size",
          "-perm",
          "-maxdepth",
          "-mindepth",
        ].includes(option)
      )
        fail(
          `Unsupported find expression '${option}'. No -exec, -delete, OR, NOT, grouping, links or implicit shell expansion.`,
        );
      const value = argument();
      tokens[i - 1].role = "Constraint";
      if (option === "-maxdepth" || option === "-mindepth") {
        if (!/^\d{1,2}$/.test(value) || Number(value) > LIMITS.depth)
          fail(`Depth must be 0–${LIMITS.depth}.`);
        if (option === "-maxdepth") p.maxDepth = Number(value);
        else p.minDepth = Number(value);
        tokens[token].role = "Traversal limit";
        tokens[token].explanation =
          "Depth is measured from the starting path; it is not a filename predicate.";
      } else {
        const kind = option.slice(1) as Predicate["kind"];
        if (kind === "type" && !["f", "d"].includes(value))
          fail("Only regular files (f) and directories (d) are modeled.");
        if (
          kind === "size" &&
          (!/^[+-]?\d{1,12}[cbwkMG]?$/.test(value) ||
            !Number.isSafeInteger(Number(value.replace(/[cbwkMG]$/, ""))))
        )
          fail(
            "Size must be [+|-]N followed by c, b, w, k, M or G (or default 512-byte units).",
          );
        if (
          kind === "name" &&
          (value.length > LIMITS.pattern || /[\[\]{}\/]/.test(value))
        )
          fail(
            `Name patterns support literals, * and ? only, up to ${LIMITS.pattern} characters; no slash or character classes.`,
          );
        if (kind === "perm") octal(value);
        p.predicates.push({ kind, value, token });
        const explanation =
          kind === "size"
            ? "GNU find rounds logical bytes UP to whole units before comparing. No sign = equal; + = greater; - = less. c=bytes, M=1,048,576 bytes."
            : kind === "perm"
              ? "Match exact permission bits; this does not test effective access."
              : kind === "type"
                ? "Match file or directory metadata; do not inspect contents."
                : "Match the basename case-sensitively. * includes leading dots in this find model; no shell globbing.";
        tokens[token].explanation = explanation;
        tokens[i - 1].explanation = explanation;
      }
    }
  } else {
    if (utility === "rm" && ["-r", "-f", "-rf", "-fr"].includes(words[i])) {
      const opt = argument();
      p.recursive = opt.includes("r");
      p.force = opt.includes("f");
      tokens[1].role = "Removal flags";
      tokens[1].explanation =
        "-r traverses directories; -f ignores a missing operand. Permissions still apply. The lab never models interactive prompts.";
    }
    if (utility === "chmod") {
      const t = i;
      p.mode = octal(argument());
      tokens[t].role = "Permission mode";
      tokens[t].explanation =
        "Replace the exact mode bits. Only the virtual owner can change them; this is not an access check.";
    }
    if (words[i] === "--") {
      tokens[i].role = "Option boundary";
      i++;
    }
    if (i !== words.length - 1)
      fail(
        "This operation requires exactly one path; additional flags, operands or commands are not modeled.",
      );
    if (words[i].startsWith("-"))
      fail("A dash-prefixed operand requires -- and a path such as ./-name.");
    p.path = argument();
    if (p.path.startsWith("-") || ["!", "(", ")"].includes(p.path))
      fail(
        "An option-like starting path requires ./ or an absolute /lab path. Global find options are not modeled.",
      );
    normalizePath(p.path);
    tokens[i - 1].role = "Target path";
    tokens[i - 1].explanation =
      "Resolve this literal path only inside the synthetic /lab filesystem.";
  }
  return p;
}
/** Linear-space wildcard matcher; bounded input, no regex backtracking. */
export function glob(pattern: string, name: string): boolean {
  const characters = Array.from(name);
  let row = Array(characters.length + 1).fill(false);
  row[0] = true;
  for (const c of Array.from(pattern)) {
    const next = Array(characters.length + 1).fill(false);
    next[0] = c === "*" && row[0];
    for (let j = 1; j <= characters.length; j++)
      next[j] =
        c === "*"
          ? row[j] || next[j - 1]
          : row[j - 1] && (c === "?" || c === characters[j - 1]);
    row = next;
  }
  return row[characters.length];
}
export function sizeComparison(
  bytes: number,
  expression: string,
): { passed: boolean; detail: string } {
  const m = /^([+-]?)(\d+)([cbwkMG]?)$/.exec(expression);
  if (!m) throw new Error("Invalid size expression");
  const units: Record<string, number> = {
    "": 512,
    b: 512,
    c: 1,
    w: 2,
    k: 1024,
    M: MiB,
    G: MiB * 1024,
  };
  const unit = units[m[3]],
    actual = Math.ceil(bytes / unit),
    expected = Number(m[2]);
  return {
    passed:
      m[1] === "+"
        ? actual > expected
        : m[1] === "-"
          ? actual < expected
          : actual === expected,
    detail: `${bytes.toLocaleString("en-US")} bytes → ceil(bytes / ${unit.toLocaleString("en-US")}) = ${actual}; compare ${m[1] === "+" ? ">" : m[1] === "-" ? "<" : "="} ${expected}.`,
  };
}
function validate(snapshot: Snapshot): void {
  if (
    !snapshot ||
    !Array.isArray(snapshot.entries) ||
    !Number.isSafeInteger(snapshot.revision) ||
    snapshot.revision < 0 ||
    snapshot.entries.length > LIMITS.entries
  )
    throw new Error("Invalid snapshot or node limit exceeded.");
  const seen = new Map<string, Entry>();
  for (const e of snapshot.entries) {
    if (
      normalizePath(e.path) !== e.path ||
      seen.has(e.path) ||
      !["file", "directory"].includes(e.kind) ||
      !Number.isSafeInteger(e.size) ||
      e.size < 0 ||
      !Number.isInteger(e.mode) ||
      e.mode < 0 ||
      e.mode > 0o1777 ||
      !Number.isSafeInteger(e.uid) ||
      e.uid < 0 ||
      !Number.isSafeInteger(e.gid) ||
      e.gid < 0 ||
      !Number.isSafeInteger(e.modified) ||
      e.modified < 0
    )
      throw new Error("Invalid or duplicate virtual entry.");
    seen.set(e.path, e);
  }
  if (seen.get(ROOT)?.kind !== "directory")
    throw new Error("The virtual root is missing.");
  for (const e of snapshot.entries)
    if (e.path !== ROOT && seen.get(parent(e.path))?.kind !== "directory")
      throw new Error("Every entry must have a directory parent.");
}
export function simulate(command: string, snapshot: Snapshot): Result {
  const base: Result = {
    status: "ok",
    message: "",
    program: null,
    matches: [],
    visited: [],
    errors: [],
    traces: {},
    after: snapshot,
    changes: [],
    hostExecuted: false,
  };
  let p: Program;
  try {
    validate(snapshot);
    p = parse(command);
    base.program = p;
  } catch (e) {
    return {
      ...base,
      status: e instanceof Unsupported ? "unsupported" : "error",
      message: e instanceof Error ? e.message : "Invalid input.",
    };
  }
  const entries = new Map(snapshot.entries.map((e) => [e.path, e]));
  const target = normalizePath(p.path);
  const accessAncestors = (path: string): string | null => {
    const ancestors: string[] = [];
    for (let dir = parent(path); dir.startsWith(ROOT); dir = parent(dir))
      ancestors.unshift(dir);
    for (const dir of ancestors) {
      const e = entries.get(dir);
      if (!e || e.kind !== "directory")
        return `Not a directory or missing ancestor: ${dir}`;
      if (!allowed(e, 1)) return `Search permission (x) denied: ${dir}`;
    }
    return null;
  };
  const bad = (message: string): Result => ({
    ...base,
    status: "error",
    message,
    errors: [message],
    changes: [],
    matches: [],
    after: snapshot,
  });
  const ancestorError = accessAncestors(target);
  if (ancestorError) return bad(ancestorError);
  const entry = entries.get(target);
  if (entry && /\/(?:\.)?$/.test(p.path) && entry.kind !== "directory")
    return bad("A trailing slash requires a directory.");
  if (p.utility === "find") {
    if (!entry) return bad(`Starting path does not exist: ${target}`);
    const children = new Map<string, Entry[]>();
    for (const e of snapshot.entries)
      if (e.path !== ROOT) {
        const list = children.get(parent(e.path)) ?? [];
        list.push(e);
        children.set(parent(e.path), list);
      }
    for (const list of children.values())
      list.sort((a, b) => a.path.localeCompare(b.path, "en"));
    const walk = (e: Entry, depth: number) => {
      base.visited.push(e.path);
      const traces: Trace[] = [];
      let match = depth >= p.minDepth;
      if (depth < p.minDepth)
        traces.push({
          token: p.tokens.findIndex((t) => t.value === "-mindepth"),
          label: "Minimum depth",
          passed: false,
          detail: `Depth ${depth} is below ${p.minDepth}.`,
        });
      for (const pred of p.predicates) {
        if (!match) {
          traces.push({
            token: pred.token,
            label: pred.kind,
            passed: null,
            detail:
              "Skipped: implicit AND short-circuited after an earlier false predicate or minimum depth exclusion.",
          });
          continue;
        }
        let passed = false,
          detail = "";
        if (pred.kind === "type") {
          passed = e.kind === (pred.value === "f" ? "file" : "directory");
          detail = `Entry is a ${e.kind}.`;
        }
        if (pred.kind === "name") {
          passed = glob(pred.value, basename(e.path));
          detail = `Basename ${basename(e.path)} against ${pred.value}.`;
        }
        if (pred.kind === "size")
          ({ passed, detail } = sizeComparison(e.size, pred.value));
        if (pred.kind === "perm") {
          passed = e.mode === octal(pred.value);
          detail = `Exact mode ${modeString(e.mode)} against ${pred.value}.`;
        }
        if (pred.kind === "empty") {
          passed =
            e.kind === "file"
              ? e.size === 0
              : (children.get(e.path)?.length ?? 0) === 0;
          detail =
            e.kind === "file"
              ? `${e.size} logical bytes.`
              : `${children.get(e.path)?.length ?? 0} immediate entries.`;
          if (e.kind === "directory" && !allowed(e, 4)) {
            passed = false;
            base.errors.push(
              `Read permission (r) denied for -empty: ${e.path}`,
            );
          }
        }
        traces.push({ token: pred.token, label: pred.kind, passed, detail });
        match = match && passed;
      }
      base.traces[e.path] = traces;
      if (match) base.matches.push(e.path);
      if (e.kind === "directory" && depth < p.maxDepth) {
        if (!allowed(e, 5)) {
          base.errors.push(`Traversal requires read + search (r+x): ${e.path}`);
          return;
        }
        for (const child of children.get(e.path) ?? []) walk(child, depth + 1);
      }
    };
    walk(entry, 0);
    base.status = base.errors.length ? "partial" : "ok";
    base.message = `${base.matches.length} match${base.matches.length === 1 ? "" : "es"} among ${base.visited.length} visited entries.${base.errors.length ? " Incomplete traversal; see permission errors." : ""}`;
    return base;
  }
  if (target === ROOT)
    return bad("Changing or removing the synthetic root is not modeled.");
  const directory = entries.get(parent(target));
  if (!directory || directory.kind !== "directory")
    return bad("The destination parent directory does not exist.");
  const canChangeDirectory = (
    path: string,
    child: Entry | undefined,
  ): string | null => {
    const e = entries.get(path);
    if (!e || e.kind !== "directory" || !allowed(e, 3))
      return `Directory write + search (w+x) denied: ${path}`;
    if (
      child &&
      e.mode & 0o1000 &&
      e.uid !== IDENTITY.uid &&
      child.uid !== IDENTITY.uid
    )
      return `Sticky directory forbids removing another owner's entry: ${child.path}`;
    return null;
  };
  const change = (before: Entry | null, after: Entry | null) =>
    base.changes.push({
      path: (after ?? before)!.path,
      kind: !before ? "added" : !after ? "removed" : "modified",
      before,
      after,
    });
  if (p.utility === "rm") {
    if (!entry) {
      if (p.force) {
        base.message = "Missing virtual entry ignored by -f. No changes.";
        return base;
      }
      return bad(`Path does not exist: ${target}`);
    }
    if (entry.kind === "directory" && !p.recursive)
      return bad("Directory removal requires the supported -r or -rf flag.");
    const targets = snapshot.entries.filter(
      (e) => e.path === target || e.path.startsWith(target + "/"),
    );
    // Preflight the entire operation; this model is deliberately atomic, unlike rm.
    for (const e of targets) {
      const denial =
        accessAncestors(e.path) || canChangeDirectory(parent(e.path), e);
      if (denial) return bad(denial);
      if (e.kind === "directory" && !allowed(e, 5))
        return bad(`Recursive removal requires directory r+x: ${e.path}`);
    }
    for (const e of targets) {
      change(e, null);
      entries.delete(e.path);
    }
  } else if (p.utility === "chmod") {
    if (!entry) return bad(`Path does not exist: ${target}`);
    if (entry.uid !== IDENTITY.uid)
      return bad(
        "Only the virtual owner may chmod this entry. No root elevation is modeled.",
      );
    if (entry.mode !== p.mode) {
      const updated = {
        ...entry,
        mode: p.mode!,
        modified: snapshot.revision + 1,
      };
      entries.set(target, updated);
      change(entry, updated);
    }
  } else if (p.utility === "mkdir") {
    if (entry)
      return bad("The target already exists. mkdir -p is not modeled.");
    const denial = canChangeDirectory(parent(target), undefined);
    if (denial) return bad(denial);
    const created = {
      ...node(target, "directory", 4096, 0o755),
      modified: snapshot.revision + 1,
    };
    entries.set(target, created);
    change(null, created);
  } else {
    if (entry) {
      // Modeled no-options touch by the owner; no timestamps supplied by the user.
      if (entry.uid !== IDENTITY.uid && !allowed(entry, 2))
        return bad(
          "touch requires ownership or write permission in this model.",
        );
      const updated = { ...entry, modified: snapshot.revision + 1 };
      entries.set(target, updated);
      change(entry, updated);
    } else {
      const denial = canChangeDirectory(parent(target), undefined);
      if (denial) return bad(denial);
      const created = {
        ...node(target, "file", 0, 0o644),
        modified: snapshot.revision + 1,
      };
      entries.set(target, created);
      change(null, created);
    }
  }
  if (entries.size > LIMITS.entries)
    return bad(
      `Virtual node limit (${LIMITS.entries}) reached. No changes applied.`,
    );
  base.after = Object.freeze({
    revision: snapshot.revision + 1,
    entries: Object.freeze(
      [...entries.values()].map((e) => Object.freeze({ ...e })),
    ),
  });
  base.message = `${base.changes.length} virtual metadata change${base.changes.length === 1 ? "" : "s"} previewed. Apply explicitly to change the in-memory snapshot.`;
  base.matches = base.changes.map((c) => c.path);
  return base;
}
