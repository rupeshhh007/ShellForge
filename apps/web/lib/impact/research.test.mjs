import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const saved = JSON.parse(
  readFileSync(new URL("../research-pilot.json", import.meta.url), "utf8"),
);
test("research UI data is byte-traceable to both preserved paired prediction artifacts", () => {
  assert.equal(saved.live_inference, false);
  assert.equal(saved.pairs.length, 32);
  const sourceRows = saved.sources.map((source) => {
    const bytes = readFileSync(
      new URL("../../../../" + source.path, import.meta.url),
    );
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      source.sha256,
    );
    return new Map(
      bytes
        .toString()
        .trim()
        .split("\n")
        .map((line) => {
          const row = JSON.parse(line);
          return [row.id, row];
        }),
    );
  });
  for (const pair of saved.pairs)
    for (const [index, kind] of ["base", "tuned"].entries()) {
      const original = sourceRows[index].get(pair.id);
      assert.equal(pair.instruction, original.instruction);
      assert.equal(pair.reference, original.reference);
      for (const key of [
        "prediction",
        "exact_match",
        "syntax_valid",
        "risk",
        "backend",
      ])
        assert.deepEqual(pair[kind][key], original[key]);
      assert.equal(
        pair[kind].exact_match,
        pair[kind].prediction === pair.reference,
      );
    }
  assert.equal(saved.pairs.filter((p) => p.base.exact_match).length, 3);
  assert.equal(saved.pairs.filter((p) => p.tuned.exact_match).length, 2);
});
