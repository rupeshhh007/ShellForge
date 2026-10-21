import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import ts from "typescript";
import {
  seedFilesystem,
  simulate,
  glob,
  sizeComparison,
  LIMITS,
  permissionString,
  modeString,
} from "./engine.ts";
const seed = seedFilesystem(),
  M = 1048576;
const run = (command, snapshot = seed) => simulate(command, snapshot);
test("fixture has real boundary cases, permissions, ownership, hidden paths and nested files", () => {
  assert.equal(seed.entries.length, 26);
  assert.ok(Object.isFrozen(seed.entries));
  assert.ok(Object.isFrozen(seed.entries[0]));
  assert.equal(
    seed.entries.find((e) => e.path.endsWith("threshold-100.bin")).size,
    100 * M,
  );
  assert.equal(
    permissionString(seed.entries.find((e) => e.path === "/lab/tmp")),
    "drwxrwxrwt",
  );
  assert.equal(modeString(0o644), "0644");
});
for (const [expression, bytes, expected] of [
  ["100M", 99 * M, false],
  ["100M", 99 * M + 1, true],
  ["100M", 100 * M, true],
  ["100M", 100 * M + 1, false],
  ["+100M", 100 * M, false],
  ["+100M", 100 * M + 1, true],
  ["-100M", 99 * M, true],
  ["-100M", 99 * M + 1, false],
  ["104857600c", 100 * M, true],
  ["104857600c", 100 * M + 1, false],
  ["+104857600c", 100 * M + 1, true],
  ["0M", 0, true],
  ["-1M", 0, true],
  ["-1M", 1, false],
  ["1M", 1, true],
  ["1M", M, true],
  ["1", 512, true],
  ["1b", 513, false],
  ["2b", 513, true],
  ["1k", 1024, true],
  ["2w", 3, true],
  ["1G", M * 1024, true],
])
  test(`GNU size ${expression} on ${bytes} bytes → ${expected}`, () =>
    assert.equal(sizeComparison(bytes, expression).passed, expected));
test("every size comparison matches a mathematically independent interval oracle", () => {
  for (const suffix of ["c", "b", "w", "k", "M", "G"])
    for (const n of [0, 1, 2, 99, 100])
      for (const bytes of [
        0,
        1,
        2,
        511,
        512,
        513,
        99 * M,
        99 * M + 1,
        100 * M,
        100 * M + 1,
      ])
        for (const sign of ["", "+", "-"]) {
          const u = { c: 1, b: 512, w: 2, k: 1024, M, G: M * 1024 }[suffix];
          const expected =
            sign === "+"
              ? bytes > n * u
              : sign === "-"
                ? n > 0 && bytes <= (n - 1) * u
                : n === 0
                  ? bytes === 0
                  : bytes > (n - 1) * u && bytes <= n * u;
          assert.equal(
            sizeComparison(bytes, `${sign}${n}${suffix}`).passed,
            expected,
            `${sign}${n}${suffix}, ${bytes}`,
          );
        }
});
test("find starts at depth zero, includes dotfiles and traverses recursively once", () => {
  const r = run("find ./data");
  assert.equal(r.status, "ok");
  assert.equal(r.visited.length, 11);
  assert.equal(new Set(r.visited).size, r.visited.length);
  assert.deepEqual(r.visited, r.matches);
  assert.ok(r.matches.includes("/lab/data/.hidden"));
});
test("all predicates combine with AND and each evaluated entry has an explanatory trace", () => {
  const r = run("find ./data -type f -name '*.bin' -size +100M");
  assert.equal(r.status, "ok");
  assert.deepEqual(r.matches, [
    "/lab/data/nested/large image.bin",
    "/lab/data/threshold-100-plus-one.bin",
  ]);
  assert.equal(
    r.traces["/lab/data/threshold-100.bin"].find((t) => t.label === "size")
      .passed,
    false,
  );
});
test("rounded, greater and exact bytes produce distinct sets without changing the snapshot", () => {
  assert.deepEqual(run("find ./data -type f -size 100M").matches, [
    "/lab/data/threshold-100.bin",
    "/lab/data/threshold-99-plus-one.bin",
  ]);
  assert.equal(run("find ./data -type f -size +100M").matches.length, 3);
  assert.deepEqual(run("find ./data -type f -size 104857600c").matches, [
    "/lab/data/threshold-100.bin",
  ]);
  assert.equal(seed.revision, 0);
  assert.equal(run("find ./data").after, seed);
});
test("minimum and maximum depth change traversal and evaluation independently", () => {
  assert.deepEqual(run("find ./data -maxdepth 0").matches, ["/lab/data"]);
  const r = run("find ./data -mindepth 1 -maxdepth 1 -type d");
  assert.deepEqual(r.matches, ["/lab/data/nested"]);
  assert.ok(!r.visited.includes("/lab/data/nested/small.txt"));
  assert.deepEqual(run("find ./data -mindepth 2 -maxdepth 1").matches, []);
});
test("exact permission predicate is not an effective access test", () => {
  assert.deepEqual(run("find ./data -perm 440").matches, [
    "/lab/data/archive.img",
  ]);
  assert.equal(run("find ./data -perm 644").matches.length, 8);
});
test("empty detects both zero-byte files and empty directories", () => {
  const r = run("find ./home -empty");
  assert.deepEqual(r.matches, ["/lab/home/student/empty-dir"]);
  assert.deepEqual(run("find ./data -empty").matches, ["/lab/data/empty.txt"]);
});
test("unknown path, file-as-directory and outside scope cannot silently succeed", () => {
  assert.equal(run("find ./missing").status, "error");
  assert.equal(run("find ./data/empty.txt/").status, "error");
  assert.equal(run("find ./data/empty.txt/.").status, "error");
  assert.equal(run("find /etc").status, "unsupported");
  assert.equal(run("find ./../lab").status, "unsupported");
});
test("literal files as roots are evaluated at depth zero", () =>
  assert.deepEqual(run("find ./data/empty.txt -type f").matches, [
    "/lab/data/empty.txt",
  ]));
test("inaccessible subtree produces partial results and explicit errors", () => {
  const r = run("find . -type f");
  assert.equal(r.status, "partial");
  assert.ok(r.errors.some((e) => e.includes("/lab/private")));
  assert.ok(!r.visited.includes("/lab/private/secret.txt"));
  assert.ok(r.matches.length > 0);
  assert.equal(run("find ./private/secret.txt").status, "error");
  assert.equal(run("find ./private -maxdepth 0").status, "ok");
});
test("chmod search permissions alter subsequent traversal in the new snapshot only", () => {
  const r = run("chmod 600 ./data");
  assert.equal(r.status, "ok");
  assert.equal(seed.entries.find((e) => e.path === "/lab/data").mode, 0o755);
  assert.equal(run("find ./data -type f", r.after).status, "partial");
  assert.equal(run("find ./data/empty.txt", r.after).status, "error");
});
for (const command of [
  "touch ./tmp/new.txt",
  "mkdir ./tmp/new-dir",
  "chmod 400 ./data/empty.txt",
  "rm ./data/empty.txt",
  "rm -rf ./tmp/cache",
])
  test(`${command} previews immutable state changes`, () => {
    const before = JSON.stringify(seed);
    const r = run(command);
    assert.equal(r.status, "ok");
    assert.ok(r.changes.length > 0);
    assert.equal(r.after.revision, 1);
    assert.equal(JSON.stringify(seed), before);
    assert.ok(Object.isFrozen(r.after.entries));
    assert.equal(r.hostExecuted, false);
  });
test("rm removes directory entries using parent permissions, including read-only files", () => {
  const r = run("rm -r ./tmp/cache");
  assert.equal(r.changes.length, 3);
  assert.ok(!r.after.entries.some((e) => e.path.startsWith("/lab/tmp/cache")));
  assert.equal(run("rm ./data/archive.img").status, "ok");
});
test("rm -f missing is a no-op, never bypasses permissions or recursive requirements", () => {
  assert.equal(run("rm -f ./tmp/missing").changes.length, 0);
  assert.equal(run("rm ./tmp/missing").status, "error");
  assert.equal(run("rm -f ./tmp/cache").status, "error");
  assert.equal(run("rm -rf ./private").status, "error");
});
test("sticky directory and ownership restrictions are enforced", () => {
  assert.equal(run("rm ./tmp/root-owned.tmp").status, "error");
  assert.match(run("rm ./tmp/root-owned.tmp").message, /Sticky/);
  assert.equal(run("chmod 777 ./tmp/root-owned.tmp").status, "error");
  assert.equal(run("touch ./logs/kernel.log").status, "error");
});
test("atomic preflight prevents partial deletion on a denied descendant", () => {
  const r = run("chmod 000 ./tmp/cache");
  const result = run("rm -rf ./tmp/cache", r.after);
  assert.equal(result.status, "error");
  assert.equal(result.changes.length, 0);
  assert.equal(result.after, r.after);
});
test("parent w+x governs creating or removing an entry; file write bit is independent", () => {
  const r = run("chmod 500 ./data");
  for (const command of [
    "touch ./data/new.txt",
    "mkdir ./data/new",
    "rm ./data/empty.txt",
  ])
    assert.equal(run(command, r.after).status, "error");
  assert.equal(run("touch ./data/empty.txt", r.after).status, "ok");
});
test("mkdir needs an existing parent and refuses existing targets", () => {
  assert.equal(run("mkdir ./missing/new").status, "error");
  assert.equal(run("mkdir ./data").status, "error");
});
test("touch changes only logical metadata revision; new files use modeled umask 022", () => {
  const r = run("touch ./tmp/new");
  const e = r.after.entries.find((e) => e.path === "/lab/tmp/new");
  assert.equal(e.mode, 0o644);
  assert.equal(e.size, 0);
  assert.equal(e.modified, 1);
});
test("the virtual root is protected from mutations", () => {
  for (const c of ["rm -rf .", "chmod 777 /lab", "touch /lab", "mkdir /lab"])
    assert.equal(run(c).status, "error");
});
test("spaces, quoted wildcard, shell-looking single-quoted literals remain literal", () => {
  assert.deepEqual(run("find './data/nested/large image.bin'").matches, [
    "/lab/data/nested/large image.bin",
  ]);
  assert.equal(run("touch './tmp/$(echo hi)' ").status, "ok");
  assert.equal(run("find ./data -name '*.bin'").status, "ok");
});
for (const command of [
  "find . | head",
  "find .; rm -rf /",
  "find . && pwd",
  "$(id)",
  'find "$HOME"',
  "find . -exec touch /tmp/nope \\;",
  "find . -delete",
  "find . -o -name x",
  "find . ! -name x",
  "find . ( -type f )",
  "sudo rm -rf ./tmp",
  "find . -name *.bin",
  'find . -name "$(id)"',
  "find . -name '[a-z]*'",
  "find . -size 100MB",
  "find . -size 1e3c",
  "find . -size +1.5M",
  "find . -size -1c -size 2c",
  "find . -type l",
  "find . -maxdepth 17",
  "find . -maxdepth -1",
  "find . -print -type f",
  "find . -size",
  "find './data",
  "find .\nrm -rf ./tmp",
  "find .\0",
  "find . #comment",
  "VAR=x find .",
  "find ~",
  "find . > result",
  "find . `id`",
  "cp ./data/a ./tmp/b",
  "mv ./data ./tmp",
  "rm -ri ./tmp",
  "rm ./tmp/a ./tmp/b",
  "chmod u+x ./data",
  "chmod 4755 ./data",
  "touch -r ./data/a ./tmp/b",
  "mkdir -p ./tmp/a/b",
  'find . -name "a"b',
  "touch ./tmp/../escape",
])
  test(`reject unsupported syntax: ${JSON.stringify(command)}`, () => {
    const r = run(command);
    assert.equal(r.status, "unsupported");
    assert.equal(r.after, seed);
    assert.equal(r.changes.length, 0);
    assert.equal(r.hostExecuted, false);
  });
test("strict limits cover command, token, pattern and virtual node count", () => {
  assert.equal(run("find " + "a".repeat(2001)).status, "unsupported");
  assert.equal(
    run("find . " + Array(100).fill("-print").join(" ")).status,
    "unsupported",
  );
  assert.equal(
    run("find . -name '" + "?".repeat(65) + "'").status,
    "unsupported",
  );
  const entries = [...seed.entries];
  for (let i = entries.length; i < LIMITS.entries; i++)
    entries.push({ ...seed.entries[2], path: `/lab/tmp/limit-${i}` });
  const snapshot = { revision: 0, entries };
  const r = run("touch ./tmp/one-too-many", snapshot);
  assert.equal(r.status, "error");
  assert.equal(r.changes.length, 0);
  assert.equal(r.after, snapshot);
  assert.equal(
    run("find .", { ...snapshot, entries: [...entries, entries[0]] }).status,
    "error",
  );
});
test("malformed snapshots cannot introduce inconsistent or huge trees", () => {
  for (const entries of [
    [],
    [...seed.entries, seed.entries[0]],
    [...seed.entries, { ...seed.entries[2], path: "/lab/missing/file" }],
    [...seed.entries, { ...seed.entries[2], path: "/lab/tmp/bad", size: NaN }],
    [...seed.entries, { ...seed.entries[2], path: "/lab/tmp/bad", mode: -1 }],
  ])
    assert.equal(run("find .", { revision: 0, entries }).status, "error");
});
test("bounded glob handles Unicode code points and adversarial repetitive patterns", () => {
  assert.equal(glob("?.txt", "😀.txt"), true);
  assert.equal(glob("*", ".hidden"), true);
  assert.equal(glob("A*", "abc"), false);
  assert.equal(glob("*a".repeat(30) + "b", "a".repeat(240)), false);
});
test("non-execution: engine imports nothing, exposes no evaluator, and adversarial host path stays absent", () => {
  const source = readFileSync(new URL("./engine.ts", import.meta.url), "utf8");
  const tree = ts.createSourceFile(
    "engine.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  const banned = [];
  const visit = (n) => {
    if (ts.isImportDeclaration(n)) banned.push("import");
    if (
      ts.isCallExpression(n) &&
      (n.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(n.expression) &&
          ["eval", "Function", "fetch", "exec", "spawn", "require"].includes(
            n.expression.text,
          )))
    )
      banned.push(n.getText(tree));
    if (
      ts.isNewExpression(n) &&
      ts.isIdentifier(n.expression) &&
      n.expression.text === "Function"
    )
      banned.push("Function");
    ts.forEachChild(n, visit);
  };
  visit(tree);
  assert.deepEqual(banned, []);
  const marker = "/tmp/shellforge-impact-must-not-exist-2c4a7";
  assert.equal(existsSync(marker), false);
  for (const command of [
    `touch ${marker}`,
    `find . -exec touch ${marker} \\;`,
    `touch '${marker}'; echo hi`,
    `rm -rf /`,
  ]) {
    const r = run(command);
    assert.notEqual(r.status, "ok");
    assert.equal(r.hostExecuted, false);
  }
  assert.equal(existsSync(marker), false);
});

test("implicit AND short circuits; a skipped predicate cannot introduce an extra permission failure", () => {
  const r = run("find ./private -maxdepth 0 -type f -empty");
  assert.equal(r.status, "ok");
  assert.deepEqual(r.matches, []);
  assert.equal(r.traces["/lab/private"][1].passed, null);
});

test("option-like existing paths cannot turn unsupported find syntax into success", () => {
  let state = seed;
  for (const name of ["-L", "!", "("]) {
    const created = run(`touch './${name}'`, state);
    assert.equal(created.status, "ok");
    state = created.after;
    assert.equal(run(`find '${name}'`, state).status, "unsupported");
    assert.equal(run(`find './${name}'`, state).status, "ok");
  }
});
