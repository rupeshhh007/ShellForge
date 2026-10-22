/** Finite witness construction. Only the existing pure interpreter establishes results. */
import {
  parse,
  normalizePath,
  parent,
  simulate,
  type Entry,
  type Snapshot,
  type Result,
} from "../impact/engine.ts";
export const SEARCH_VERSION = "bounded-witness-v1";
export const BOUNDS = Object.freeze({
  fixtures: 4096,
  evaluations: 4096,
  entries: 12,
  bytes: 1099511627776,
  sizes: 32,
  names: 4,
});
export type Scenario = { command: string; prepare?: string };
export type Difference = {
  onlyA: string[];
  onlyB: string[];
  changedPaths: string[];
  statusDiffers: boolean;
  errorsDiffer: boolean;
};
export type Comparison = {
  a: Result;
  b: Result;
  difference: Difference;
  distinct: boolean;
};
export const OBSERVABLES =
  "status, sorted reported paths, error messages, and final entry metadata (including logical modification counters); traversal order and snapshot revision are excluded";
const canonical = (snapshot: Snapshot) =>
  [...snapshot.entries].sort((a, b) =>
    a.path < b.path ? -1 : a.path > b.path ? 1 : 0,
  );
function run(s: Scenario, fixture: Snapshot): Result {
  if (s.prepare) {
    const preparation = simulate(s.prepare, fixture);
    if (preparation.status !== "ok") return preparation;
    const result = simulate(s.command, preparation.after);
    return {
      ...result,
      events: [
        ...preparation.events.map((event) => ({
          ...event,
          detail: "Preparation: " + event.detail,
        })),
        ...result.events,
      ],
    };
  }
  return simulate(s.command, fixture);
}
export function compare(
  a: Scenario,
  b: Scenario,
  fixture: Snapshot,
): Comparison {
  const x = run(a, fixture),
    y = run(b, fixture);
  const onlyA = x.matches.filter((p) => !y.matches.includes(p)).sort(),
    onlyB = y.matches.filter((p) => !x.matches.includes(p)).sort();
  const paths = [
    ...new Set([...x.after.entries, ...y.after.entries].map((e) => e.path)),
  ].sort();
  const changedPaths = paths.filter(
    (p) =>
      JSON.stringify(x.after.entries.find((e) => e.path === p)) !==
      JSON.stringify(y.after.entries.find((e) => e.path === p)),
  );
  const difference = {
    onlyA,
    onlyB,
    changedPaths,
    statusDiffers: x.status !== y.status,
    errorsDiffer:
      JSON.stringify([...x.errors].sort()) !==
      JSON.stringify([...y.errors].sort()),
  };
  return {
    a: x,
    b: y,
    difference,
    distinct: !!(
      onlyA.length ||
      onlyB.length ||
      difference.statusDiffers ||
      difference.errorsDiffer ||
      JSON.stringify(canonical(x.after)) !== JSON.stringify(canonical(y.after))
    ),
  };
}
const make = (
  path: string,
  kind: Entry["kind"],
  size: number,
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
export const fixtureCost = (s: Snapshot) => [
  s.entries.length,
  s.entries.reduce((n, e) => n + e.path.split("/").length - 2, 0),
  s.entries.reduce(
    (n, e) =>
      n +
      Number(e.uid !== 1000) +
      Number(e.mode !== (e.kind === "file" ? 0o644 : 0o755)),
    0,
  ),
  s.entries.reduce((n, e) => n + e.size, 0),
];
function order(a: Snapshot, b: Snapshot) {
  const x = fixtureCost(a),
    y = fixtureCost(b);
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i];
  const sa = JSON.stringify(canonical(a)),
    sb = JSON.stringify(canonical(b));
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}
export type Certificate = {
  version: string;
  status: "found" | "not-found" | "unsupported" | "out-of-domain";
  message: string;
  commands: { a: Scenario; b: Scenario };
  observables: string;
  bounds: typeof BOUNDS;
  domain: string;
  candidateCount: number;
  evaluated: number;
  exhausted: boolean;
  fixture: Snapshot | null;
  comparison: Comparison | null;
  cost: number[] | null;
  minimality: string;
};
export function searchWitness(
  a: Scenario,
  b: Scenario,
  limit = BOUNDS.evaluations,
  constraints?: { directories: string[] },
): Certificate {
  const base: Certificate = {
    version: SEARCH_VERSION,
    status: "not-found",
    message: "No distinguishing witness found within these bounds.",
    commands: { a, b },
    observables: OBSERVABLES,
    bounds: BOUNDS,
    domain:
      "Required path skeletons, optionally one probe entry; command-derived size boundaries ±1 byte; literal/glob-derived names; file/directory kinds; nine explicit mode/ownership profiles. Construction capped at 4,096 unique fixtures.",
    candidateCount: 0,
    evaluated: 0,
    exhausted: false,
    fixture: null,
    comparison: null,
    cost: null,
    minimality: "No global minimality or command equivalence claim.",
  };
  if (!Number.isInteger(limit) || limit < 1 || limit > BOUNDS.evaluations)
    return {
      ...base,
      status: "out-of-domain",
      message: "Search evaluation limit must be 1–4096.",
    };
  let programs;
  try {
    programs = [a, b].flatMap((s) => {
      const p = parse(s.command);
      if (s.prepare && parse(s.prepare).utility !== "chmod")
        throw Error("Preparation is limited to one modeled chmod operation.");
      return s.prepare ? [p, parse(s.prepare)] : [p];
    });
  } catch (e) {
    return {
      ...base,
      status: "unsupported",
      message: e instanceof Error ? e.message : "Unsupported command pair.",
    };
  }
  const targets = [
    ...new Set(programs.map((p) => normalizePath(p.path))),
  ].sort();
  const ancestors = new Set<string>(["/lab"]);
  for (const target of targets)
    for (let p = parent(target); p.startsWith("/lab"); p = parent(p))
      ancestors.add(p);
  if (ancestors.size + targets.length + 1 > BOUNDS.entries)
    return {
      ...base,
      status: "out-of-domain",
      message: "Required path skeleton exceeds the 12-entry witness domain.",
    };
  const sizes = new Set([0, 1, 511, 512, 1024]);
  const names = new Set(["evidence.bin"]);
  const units: Record<string, number> = {
    c: 1,
    b: 512,
    w: 2,
    k: 1024,
    M: 1048576,
    G: 1073741824,
  };
  for (const p of programs)
    for (const pred of p.predicates) {
      if (pred.kind === "size") {
        const m = /^[+-]?(\d+)([cbwkMG]?)$/.exec(pred.value)!;
        const n = Number(m[1]),
          u = units[m[2] || "b"];
        for (const k of [n - 1, n])
          for (const delta of [-1, 0, 1]) {
            const v = k * u + delta;
            if (Number.isSafeInteger(v) && v >= 0 && v <= BOUNDS.bytes)
              sizes.add(v);
          }
      }
      if (pred.kind === "name") {
        const value = pred.value
          .replaceAll("*", "evidence")
          .replaceAll("?", "x");
        if (value && value.length <= 64) names.add(value);
      }
    }
  const byteDomain = [...sizes].sort((x, y) => x - y).slice(0, BOUNDS.sizes),
    nameDomain = [...names].slice(0, BOUNDS.names);
  const candidates = new Map<string, Snapshot>();
  const add = (entries: Entry[]) => {
    if (entries.length > BOUNDS.entries || candidates.size >= BOUNDS.fixtures)
      return;
    const sorted = canonical({ entries, revision: 0 });
    candidates.set(JSON.stringify(sorted), { entries: sorted, revision: 0 });
  };
  const skeleton = [...ancestors].map((p) => make(p, "directory", 4096));
  add(skeleton);
  const directories = [...new Set([...ancestors, ...targets])].map((p) =>
    make(p, "directory", 4096),
  );
  add(directories);
  // Profiles are general metadata constraints, never precomputed command answers.
  const profiles = [
    [0o755, 1000, 0o644, 1000],
    [0o600, 1000, 0o644, 1000],
    [0o111, 1000, 0o644, 1000],
    [0o700, 0, 0o644, 1000],
    [0o777, 0, 0o444, 1000],
    [0o1777, 0, 0o644, 0],
    [0o1777, 0, 0o444, 1000],
    [0o755, 1000, 0, 1000],
    [0o755, 1000, 0o644, 0],
  ];
  const probes = [
    ...new Set([
      ...targets.filter((p) => p !== "/lab" && !ancestors.has(p)),
      ...targets.flatMap((p) => nameDomain.map((name) => p + "/" + name)),
    ]),
  ].sort();
  for (const path of probes)
    for (const kind of ["file", "directory"] as const)
      for (const size of kind === "file" ? byteDomain : [4096])
        for (const [dirMode, dirUid, fileMode, fileUid] of profiles) {
          const required = new Set<string>(["/lab"]);
          for (let p = parent(path); p.startsWith("/lab"); p = parent(p))
            required.add(p);
          const entries = [...required].map((p) =>
            make(
              p,
              "directory",
              4096,
              p === parent(path) ? dirMode : 0o755,
              p === parent(path) ? dirUid : 1000,
            ),
          );
          entries.push(
            make(
              path,
              kind,
              size,
              kind === "file" ? fileMode : dirMode,
              kind === "file" ? fileUid : dirUid,
            ),
          );
          add(entries);
        }
  try {
    if (
      constraints &&
      (!Array.isArray(constraints.directories) ||
        constraints.directories.length > 4 ||
        constraints.directories.some(
          (p) =>
            typeof p !== "string" ||
            p.length > 240 ||
            !(p === "/lab" || p.startsWith("/lab/")) ||
            p !== normalizePath(p),
        ))
    )
      throw Error("Invalid directory constraints.");
  } catch {
    return {
      ...base,
      status: "out-of-domain",
      message: "Invalid directory constraints.",
    };
  }
  if (constraints)
    base.domain += ` Required directories: ${constraints.directories.join(", ")}.`;
  const ordered = [...candidates.values()]
    .filter(
      (f) =>
        !constraints ||
        constraints.directories.every((p) =>
          f.entries.some((e) => e.path === p && e.kind === "directory"),
        ),
    )
    .sort(order);
  base.candidateCount = ordered.length;
  for (const fixture of ordered.slice(0, limit)) {
    base.evaluated++;
    const comparison = compare(a, b, fixture);
    if (
      comparison.a.status === "unsupported" ||
      comparison.b.status === "unsupported"
    )
      return {
        ...base,
        status: "unsupported",
        message: "An operation cannot be simulated; no witness is certified.",
      };
    if (comparison.distinct)
      return {
        ...base,
        status: "found",
        message:
          "A distinguishing witness was computed and independently replayed for both scenarios.",
        fixture,
        comparison,
        cost: fixtureCost(fixture),
        minimality:
          "First witness in the fully sorted constructed candidate domain: entry count, total path depth, nondefault mode/owner count, total logical bytes, canonical JSON tie-break. Minimal within this finite constructed domain only.",
      };
  }
  return { ...base, exhausted: base.evaluated === ordered.length };
}
