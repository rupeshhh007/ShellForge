import test from "node:test";
import fs from "node:fs";
import assert from "node:assert/strict";
import { searchWitness, compare, fixtureCost, BOUNDS } from "./search.ts";
const a = { command: "find . -type f -size 100M" },
  b = { command: "find . -type f -size +100M" };
test("size witness is replayable and boundary-derived, not a stored demonstration", () => {
  const r = searchWitness(a, b);
  assert.equal(r.status, "found");
  assert.equal(r.fixture.entries.length, 2);
  assert.equal(
    r.fixture.entries.find((e) => e.kind === "file").size,
    99 * 1048576 + 1,
  );
  assert.deepEqual(compare(a, b, r.fixture), r.comparison);
  assert.equal(r.comparison.distinct, true);
  assert.match(r.minimality, /finite constructed domain/);
});
for (const [n, u] of [
  [1, 1],
  [7, 1024],
  [4, 1048576],
  [12, 512],
])
  test(`independent inequality witness n=${n},unit=${u}`, () => {
    const suffix = { 1: "c", 1024: "k", 1048576: "M", 512: "b" }[u];
    const r = searchWitness(
      { command: `find . -type f -size ${n}${suffix}` },
      { command: `find . -type f -size +${n}${suffix}` },
    );
    assert.equal(r.status, "found");
    const file = r.fixture.entries.find((e) => e.kind === "file");
    assert.ok(file.size > (n - 1) * u && file.size <= n * u);
    assert.deepEqual(r.cost, fixtureCost(r.fixture));
  });
test("same supported query exhausts finite domain without claiming equivalence", () => {
  const r = searchWitness(a, { command: "find . -size 100M -type f" });
  assert.equal(r.status, "not-found");
  assert.equal(r.exhausted, true);
  assert.equal(r.evaluated, r.candidateCount);
  assert.match(r.message, /within these bounds/);
});
test("permissions distinguish the same find after two supported preparations", () => {
  const r = searchWitness(
    { prepare: "chmod 600 ./room", command: "find ./room -type f" },
    { prepare: "chmod 700 ./room", command: "find ./room -type f" },
    undefined,
    { directories: ["/lab/room"] },
  );
  assert.equal(r.status, "found");
  assert.equal(r.comparison.a.status, "partial");
  assert.equal(r.comparison.b.status, "ok");
});
test("force does not mean permission bypass, but distinguishes a missing operand", () => {
  const r = searchWitness(
    { command: "rm ./drop/item" },
    { command: "rm -f ./drop/item" },
  );
  assert.equal(r.status, "found");
  assert.equal(
    r.fixture.entries.some((e) => e.path === "/lab/drop/item"),
    false,
  );
  assert.equal(r.comparison.a.status, "error");
  assert.equal(r.comparison.b.status, "ok");
});
test("explicit small budget and unsupported syntax never become proof", () => {
  const r = searchWitness(a, a, 1);
  assert.equal(r.evaluated, 1);
  assert.equal(r.exhausted, false);
  assert.equal(r.status, "not-found");
  for (const text of [
    "find . | sh",
    "find . -delete",
    "$(touch /tmp/nope)",
    "find . -exec rm {} ;",
  ])
    assert.equal(searchWitness({ command: text }, b).status, "unsupported");
  for (const n of [0, 4097, NaN, 1.5])
    assert.equal(searchWitness(a, b, n).status, "out-of-domain");
});
test("saved seeded randomized thresholds produce deterministic witnesses under hard limits", () => {
  let seed = 341;
  for (let i = 0; i < 12; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const n = 1 + (seed % 1000);
    const x = { command: `find ./x -size ${n}c` },
      y = { command: `find ./x -size +${n}c` };
    const r = searchWitness(x, y);
    assert.deepEqual(searchWitness(x, y), r);
    assert.ok(
      r.evaluated <= BOUNDS.evaluations && r.candidateCount <= BOUNDS.fixtures,
    );
    assert.ok(r.fixture.entries.length <= 12);
    assert.equal(r.comparison.distinct, true);
  }
});
test("reported minimality holds for the entire evaluated prefix, independently replayable and immutable", () => {
  const r = searchWitness(a, b);
  assert.ok(r.evaluated > 1);
  const prefix = searchWitness(a, b, r.evaluated - 1);
  assert.equal(prefix.status, "not-found");
  assert.equal(prefix.evaluated, r.evaluated - 1);
  const before = structuredClone(r.fixture);
  compare(a, b, r.fixture);
  assert.deepEqual(r.fixture, before);
  assert.deepEqual(searchWitness(a, b), r);
});
test("constraints and adversarial constructs cannot silently become a successful certificate", () => {
  for (const directories of [
    ["/etc/passwd"],
    ["/laboratory"],
    ["/lab/../escape"],
    ["/lab/a/../../escape"],
    ["/lab", "/lab/a", "/lab/b", "/lab/c", "/lab/d"],
  ])
    assert.equal(
      searchWitness(a, b, undefined, { directories }).status,
      "out-of-domain",
    );
  for (const command of [
    "find .; touch /tmp/forge-pwned",
    "find . `whoami`",
    "find . $(id)",
    "find . > /tmp/forge-pwned",
    "find /etc/passwd",
    "find . -name *",
    "sudo find .",
    "find . && rm -rf /",
    "x".repeat(3000),
  ])
    assert.equal(searchWitness({ command }, b).status, "unsupported");
});
test("runtime witness and learning modules contain no process, filesystem, network or dynamic evaluator imports", () => {
  for (const filename of [
    "search.ts",
    "../learning/cases.ts",
    "../learning/session.ts",
  ]) {
    const source = fs.readFileSync(new URL(filename, import.meta.url), "utf8");
    assert.doesNotMatch(
      source,
      /from\s+['"](?:node:|child_process|fs|http|https|net)|(?<![\w.])(?:eval|Function|exec|spawn|fetch)\s*\(/,
    );
  }
});
