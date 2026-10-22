import { test, expect, type Locator } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
const evidence =
  process.env.PLAYWRIGHT_EVIDENCE_DIR ??
  "/private/tmp/shellforge-almost-right-qa";
test.beforeAll(() => mkdir(evidence, { recursive: true }));
const cases = [
  {
    id: "missing-100",
    first: ["/lab/evidence/exact.bin"],
    correct: ["/lab/evidence/almost.bin", "/lab/evidence/exact.bin"],
    status: "Completes",
    transfer: ["/lab/evidence/grain.bin", "/lab/evidence/edge.bin"],
    transferStatus: "Completes",
    firstCorrect: false,
  },
  {
    id: "locked-room",
    first: [],
    correct: [],
    status: "Partial traversal",
    transfer: [],
    transferStatus: "Partial traversal",
    firstCorrect: true,
  },
  {
    id: "sticky-file",
    first: [],
    correct: [],
    status: "Operation denied / error",
    transfer: ["/lab/drop/my-note.txt"],
    transferStatus: "Completes",
    firstCorrect: true,
  },
  {
    id: "beat-model",
    first: ["/lab/over.bin"],
    correct: ["/lab/over.bin"],
    status: "Completes",
    transfer: ["/lab/new-boundary.bin"],
    transferStatus: "Completes",
    firstCorrect: true,
  },
];
async function prediction(
  form: Locator,
  paths: string[],
  status: string,
  submit: string,
) {
  for (const file of paths)
    await form
      .locator(".arl-prediction-path")
      .filter({ hasText: file })
      .getByRole("checkbox")
      .check();
  await form.getByRole("radio", { name: status, exact: true }).check();
  await form.getByRole("button", { name: submit, exact: true }).click();
}
for (const c of cases)
  test(`${c.id}: full prediction → evidence → witness → revision → independent transfer → export`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", message=>{if(message.type()==="error")errors.push(message.text());});
    await page.goto(`/cases/${c.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Run both virtual commands →" }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Make a prediction →" }).click();
    await prediction(
      page.locator("form"),
      c.first,
      c.status,
      "Lock my prediction",
    );
    await expect(
      page.getByRole("region", { name: "Locked first prediction" }),
    ).toContainText("Locked hypothesis");
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Run both virtual commands →" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Run both virtual commands →" })
      .click();
    await page.getByRole("button", { name: "Next event", exact: true }).click();
    await expect(
      page.getByRole("slider", { name: "Evidence event" }),
    ).toHaveValue("1");
    await page.getByRole("button", { name: "Rewind evidence" }).click();
    await expect(
      page.getByRole("slider", { name: "Evidence event" }),
    ).toHaveValue("0");
    await page
      .getByRole("button", { name: "Show complete computed trace" })
      .click();
    await expect(
      page.getByRole("region", { name: "Locked first prediction" }),
    ).toContainText(c.firstCorrect ? "agrees" : "differs");
    await page
      .getByRole("button", { name: "Dissect the discrepancy →" })
      .click();
    await page
      .getByRole("button", { name: "Examine command B modifier", exact: true })
      .click();
    await expect(page.locator(".arl-lens-insight")).toBeVisible();
    await page
      .getByRole("button", { name: "Find a counterexample", exact: true })
      .click();
    const certificate = page.getByRole("region", {
      name: "Counterexample certificate",
    });
    await expect(certificate).toContainText(
      "A distinguishing witness was computed",
    );
    await certificate
      .getByRole("button", { name: "Next witness event", exact: true })
      .click();
    await expect(
      certificate.getByRole("slider", { name: "Counterexample event" }),
    ).toHaveValue("1");
    await certificate
      .getByRole("button", { name: "Witness branch B", exact: true })
      .click();
    await expect(
      certificate.getByRole("slider", { name: "Counterexample event" }),
    ).toHaveValue("0");
    await certificate
      .getByText("Search bounds and minimality certificate")
      .click();
    await expect(certificate).toContainText(
      "Minimal within this finite constructed domain only",
    );
    if (c.id === "missing-100") {
      await expect(certificate).toContainText("103,809,025 B");
      await expect(
        certificate.locator(".arl-outcomes article").first(),
      ).toContainText("/lab/evidence");
      await expect(
        certificate.locator(".arl-outcomes article").nth(1),
      ).toContainText("No reported paths");
      await expect(page.locator(".arl-witness")).toHaveCSS("opacity", "1");
      await page.screenshot({
        path: path.join(evidence, "missing-100-witness-desktop.png"),
        fullPage: true,
      });
    }
    await prediction(
      page.locator("form"),
      c.correct,
      c.status,
      "Verify revised prediction",
    );
    await expect(
      page.getByRole("status").filter({ hasText: "Revised prediction agrees" }),
    ).toBeVisible();
    if (c.id === "beat-model") {
      await page
        .getByLabel("Repair the model command")
        .fill("find . -size 10M; echo unsafe");
      await page.getByRole("button", { name: "Verify command repair" }).click();
      await expect(
        page.getByRole("button", { name: "Try an unseen boundary →" }),
      ).toBeDisabled();
      await page
        .getByLabel("Repair the model command")
        .fill("find . -size 10M");
      await page.getByRole("button", { name: "Verify command repair" }).click();
    }
    await page
      .getByRole("button", { name: "Try an unseen boundary →" })
      .click();
    await prediction(
      page.locator("form"),
      c.transfer,
      c.transferStatus,
      "Commit follow-up answer",
    );
    await expect(
      page.getByRole("heading", { name: "Investigation recorded." }),
    ).toBeVisible();
    await expect(page.locator(".arl-record>.arl-verdict")).toContainText(
      "Follow-up: agreed",
    );
    const downloadPromise = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Export Investigation Record" })
      .click();
    const download = await downloadPromise,
      file = path.join(evidence, download.suggestedFilename());
    await download.saveAs(file);
    const record = JSON.parse(await readFile(file, "utf8"));
    expect(record.caseId).toBe(c.id);
    expect(record.firstCorrect).toBe(c.firstCorrect);
    expect(record.transfer.outcome.correct).toBe(true);
    expect(record.actual.a.matches).toEqual(c.correct);
    expect(record.counterexample.status).toBe("found");
    expect(record.actual.a.hostExecuted).toBe(false);
    expect(record.firstPrediction.paths).toEqual(c.first);
    expect(
      record.actions.some(
        (a: { type: string }) => a.type === "answer-transfer",
      ),
    ).toBe(true);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Investigation recorded." }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
test("gallery keyboard expansion, native dialog focus trap and focus restoration", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveTitle("ShellForge — The Almost Right Lab");
  const dossier = page.getByRole("button", { name: /The 100 MiB mistake/ });
  await dossier.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Close The Case of the Missing 100 MiB" }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  expect(
    await page.evaluate(() => !!document.activeElement?.closest("dialog")),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(dossier).toBeFocused();
});
test("mobile reduced-motion case inspection, prediction and real timeline", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("h1")).toBeVisible();
  await page.screenshot({
    path: path.join(evidence, "almost-right-gallery-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "Open the 100 MiB case →" }).click();
  await page
    .getByRole("button", {
      name: "Inspect /lab/evidence/almost.bin",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("complementary", { name: "Evidence inspector" }),
  ).toContainText("103,809,025 bytes");
  await page.getByRole("button", { name: "Make a prediction →" }).click();
  await prediction(
    page.locator("form"),
    cases[0].correct,
    "Completes",
    "Lock my prediction",
  );
  await page
    .getByRole("button", { name: "Run both virtual commands →" })
    .click();
  const slider = page.getByRole("slider", { name: "Evidence event" });
  await slider.focus();
  await page.keyboard.press("End");
  await expect(
    page.getByRole("button", { name: "Dissect the discrepancy →" }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Inspect /lab/evidence/tiny.bin",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("complementary", { name: "Evidence inspector" }),
  ).toContainText("/lab/evidence/tiny.bin");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: path.join(evidence, "missing-100-mobile-playback.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Dissect the discrepancy →" }).click();
  await page
    .getByRole("button", { name: "Find a counterexample", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Counterexample certificate" }),
  ).toContainText("A small witness");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("interpreter events drive pass, fail and skipped artifacts rather than scripted animations", async ({
  page,
}) => {
  await page.goto("/cases/missing-100");
  await page.getByRole("button", { name: "Make a prediction →" }).click();
  await prediction(page.locator("form"), [], "Completes", "Lock my prediction");
  await page
    .getByRole("button", { name: "Run both virtual commands →" })
    .click();
  const slider = page.getByRole("slider", { name: "Evidence event" });
  const max = Number(await slider.getAttribute("max"));
  const found = new Set<string>();
  for (let i = 0; i <= max; i++) {
    await slider.fill(String(i));
    const text = await page.locator(".arl-current-event").innerText();
    for (const state of ["pass", "fail", "skip"])
      if (text.includes(`: ${state}.`)) {
        await expect(
          page.locator(`.arl-file[data-predicate="${state}"]`).first(),
        ).toBeVisible();
        found.add(state);
      }
    if (found.size === 3) break;
  }
  expect([...found].sort()).toEqual(["fail", "pass", "skip"]);
});
test("optional tutor returns a truthful deterministic fallback and records only requested clues", async ({
  page,
}) => {
  await page.goto("/cases/missing-100");
  await page.getByRole("button", { name: "Make a prediction →" }).click();
  await prediction(page.locator("form"), [], "Completes", "Lock my prediction");
  await page
    .getByRole("button", { name: "Ask for a grounded question", exact: true })
    .click();
  await expect(page.locator(".arl-tutor [role=status]")).toContainText(
    "Deterministic question",
  );
  await expect(page.locator(".arl-tutor [role=status]")).toContainText(
    "round 99 MiB",
  );
  await page
    .getByRole("button", { name: "Open the related clue and record its use" })
    .click();
  await expect(
    page.getByRole("button", { name: "Clue 1 · opened" }),
  ).toBeDisabled();
});
