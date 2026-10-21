# Command Impact Lab

## Review of PR #2 at e54c44b

1. Forge had twelve bounded templates and no configured model provider. The optional
   provider interface did not connect the final trained adapter to the product.
2. Forge and X-Ray shared most of their presentation, but neither demonstrated an
   operation's effects on filesystem state. Token explanations were disconnected
   from observable data.
3. The latest Render deployment matched e54c44b. Vercel's production metadata still
   named c8a4fc9 with gitDirty=1, so its content could not be reconciled to a clean PR
   revision. Vercel protection was configured, so public access needed an explicit check.
4. Only the historical 32-case pilot's paired raw predictions are present in this
   repository. Final full-data metrics must not be attached to these pilot outputs.

## Interpreter boundary

`apps/web/lib/impact/engine.ts` is pure TypeScript with no imports or runtime OS,
network, subprocess, evaluator or shell capabilities. It reads immutable synthetic
metadata and returns a new snapshot plus explicit differences. It never invokes
Bash, including for simulation. The separate existing Python analyzer retains its
syntax-only `bash -n` check; user commands are never executed.

Fixture: 26 entries under `/lab`, directories, logical file sizes (including exact
99/100 MiB boundaries), hidden files, nested entries, owner/group/modes, an
inaccessible root-owned directory and a sticky world-writable temporary directory.
The identity is always student uid/gid 1000. The fixture viewer is omniscient; the
interpreter enforces permissions independently. No host filesystem is mounted.

## Supported grammar

```
find PATH [-type f|d] [-name 'PATTERN'] [-size [+|-]N[cbwkMG]]
          [-perm OCTAL] [-empty] [-mindepth N] [-maxdepth N] [-print]
rm [-r|-f|-rf|-fr] [--] PATH
chmod OCTAL [--] PATH
mkdir [--] PATH
touch [--] PATH
```

One starting path/operand; predicates combine by implicit AND, short-circuiting
left to right. Predicate traces label skipped tests. Depth is relative to the
starting entry (zero), and files can be starting entries. Directory traversal needs
read/search; accessing descendants needs search on every ancestor. Errors produce
explicit partial/error results, never a complete-success label. Hidden names are
included. `-name` uses bounded Unicode-code-point `*`/`?` matching, with no regex
backtracking or shell expansion. Exact octal `-perm` tests metadata bits, not access.

[GNU find size semantics](https://www.gnu.org/software/findutils/manual/html_node/find_html/Size.html):
compare `ceil(logical bytes / unit)` to N. No sign means equality, + greater than,
- less than. Units: c=1, w=2, b/default=512, k=1024, M=1048576, G=1073741824.
Thus 100M includes sizes >99 MiB through 100 MiB; +100M excludes exactly 100 MiB;
104857600c matches exactly those bytes. Zero and strict negative bounds are tested.

All unsupported constructs fail before mutation: pipelines, redirection, variable
or command expansion, quoting concatenation/escapes, multiple commands, comments,
OR/NOT/grouping, `-exec`, `-delete`, unknown options, links, parent traversal,
out-of-scope paths and extra operands. Quoted shell-looking data remains literal.
Invalid syntax is not repaired or silently dropped.

## Virtual mutations

- rm checks parent write/search permissions, recursive read/search, and sticky
  ownership. Read-only file mode does not by itself prevent removal from a writable
  directory. -f only ignores absence; it does not bypass permissions.
- chmod replaces exact mode bits and requires virtual ownership. No privilege
  elevation, setuid or setgid is modeled.
- mkdir requires an existing writable/searchable parent; no implicit -p.
- touch creates a zero-byte entry (mode 0644) or updates a logical metadata revision
  with owner/write checks. This is not real timestamp/contents emulation.

All mutations preflight atomically, unlike real rm partial failures. The synthetic
root is protected. Creating entries uses fixed umask 022. Parent timestamps, ACLs,
links, inode lifetimes, file contents, allocation, mounts, processes and root
identity are outside the model. Directory logical size is fixed at 4096 bytes,
not aggregate usage. Apply is explicit; previews never alter the current snapshot.
Undo retains at most twelve snapshots. The root React session preserves state while
moving between routes; page reload resets it. Nothing is uploaded or persisted.

Limits: 2000 command characters, 96 tokens, 256 entries, depth 16, basename patterns
64 characters. Snapshots are validated for unique canonical paths, directory parents,
numeric bounds and root integrity before every evaluation.

## Research evidence

`export_product_research.py` joins and verifies both preserved 32-case artifacts
by ID/instruction/reference. It exports raw predictions and metadata with source
SHA-256 hashes. The Bench interface shows all 32 pairs, explicitly historical
rank-8 pilot: base 3/32 versus tuned 2/32. It performs no inference and makes no
semantic-success claim. The final rank-16 6.87% remains a separate result; that
model is not connected. Unit tests verify every exported field against source bytes.

## Demonstration sequence for an OS lab

1. Open `/lab`, compare 100M (two matches), +100M (three), and 104857600c (one).
   Select threshold-99-plus-one.bin and threshold-100-plus-one.bin to read the exact
   byte calculation. Each trace is pass/fail/skip and points back to its command token.
2. Set max depth 1 and observe nested files become unvisited rather than nonmatching.
3. Preview chmod 600 ./data/nested, apply, then find ./data/nested -type f. Observe
   read/search failure. Undo restores traversal.
4. Preview rm -rf ./tmp/cache. Switch Before/Preview after, inspect all three removed
   entries, ask the independent static analyzer (DANGEROUS), then apply and undo.
5. Try rm ./tmp/root-owned.tmp to demonstrate sticky directory ownership. Try a pipe
   or -delete to show an explicit unsupported result and disabled Apply.
6. Create a file or directory, inspect its mode/owner, move through X-Ray and back.
   The synthetic snapshot survives navigation. Reset restores the original fixture.
7. On Bench, choose pilot case 11 to see a saved base exact match and tuned failure.
   This is real historical evidence, not a newly generated response.

## Verification

- 96 Node tests: strict parser/traversal, unit and interval-oracle size semantics,
  permissions/sticky bits, immutable atomic changes, all unsupported syntax,
  bounds, non-execution, and byte/hash-verified research export.
- 82 Python API/safety tests, including deployment revision reporting.
- 27 Playwright production browser tests: all prior product flows plus 11 lab
  scenarios, normal/reduced motion, real API integration, errors/cancel, desktop
  and mobile. Production build, strict TypeScript, ESLint, focused Ruff and Python
  compilation pass. Browser plugin was not available; the existing Playwright
  Chromium suite was used. No assertions were removed to obtain passing results.
- Browser QA caught a pre-hydration select change loss. Controls now remain disabled
  until hydration. File tree entries render initially visible; animations reflect
  match, collapse and snapshot changes rather than a decorative opening sequence.
- A final parser review added rejection of option-like starting paths even when
  identically named virtual files exist; explicit ./ paths remain supported.

Screenshots: `docs/visual-qa/impact/`, find and mutation-preview states at 390×844
and 1440×1000. Existing five-route viewport captures were refreshed by regression
QA. Historical datasets, training, source safety policy and result artifacts were
not modified. Model inference remains disconnected.
