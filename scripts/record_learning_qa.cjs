/** Reproducible real browser evidence; no mocked interpreter, API or model responses. */
const {
  chromium,
  expect,
} = require("../apps/web/node_modules/@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");
(async () => {
  const base = process.env.QA_BASE_URL || "http://127.0.0.1:3006";
  const dir = path.resolve(
    process.env.PLAYWRIGHT_EVIDENCE_DIR ||
      "/private/tmp/shellforge-almost-right-recording",
  );
  await fs.mkdir(dir, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    recordVideo: { dir, size: { width: 1440, height: 1000 } },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", message=>{if(message.type()==="error")errors.push(message.text());});
  await page.goto(base);
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveTitle("ShellForge — The Almost Right Lab");
  await page.screenshot({ path: path.join(dir, "gallery-desktop.png") });
  await page.getByRole("button", { name: /The 100 MiB mistake/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(dir, "expanded-case-desktop.png") });
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "Open the 100 MiB case →" }).click();
  await page
    .getByRole("button", {
      name: "Inspect /lab/evidence/almost.bin",
      exact: true,
    })
    .click();
  await expect(page.locator(".arl-inspector")).toHaveCSS("opacity", "1");
  await page.locator(".arl-scene").scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(dir, "evidence-desktop.png") });
  await page.getByRole("button", { name: "Make a prediction →" }).click();
  await page
    .locator("form")
    .getByRole("checkbox", { name: "/lab/evidence/exact.bin", exact: false })
    .check();
  await page
    .locator("form")
    .getByRole("radio", { name: "Completes", exact: true })
    .check();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Lock my prediction" }).click();
  await page.waitForTimeout(500);
  await page
    .getByRole("button", { name: "Run both virtual commands →" })
    .click();
  await page.getByRole("button", { name: "Play beside files" }).click();
  await page.locator(".arl-scene").scrollIntoViewIfNeeded();
  await page.waitForTimeout(3500);
  await page.getByRole("button", { name: "Pause beside files" }).click();
  for (let i = 0; i < 6; i++) {
    await page
      .getByRole("button", { name: "Step evidence →", exact: true })
      .click();
    await page.waitForTimeout(350);
  }
  await expect(page.locator(".arl-inspector")).toHaveCSS("opacity", "1");
  await page.screenshot({ path: path.join(dir, "trace-desktop.png") });
  await page
    .getByRole("button", { name: "Show complete computed trace" })
    .click();
  await page.waitForTimeout(450);
  await page.getByRole("button", { name: "Dissect the discrepancy →" }).click();
  await page
    .getByRole("button", { name: "Examine command B modifier", exact: true })
    .click();
  await page.locator(".arl-command-split").scrollIntoViewIfNeeded();
  await page.waitForTimeout(450);
  await page.screenshot({ path: path.join(dir, "symbol-focus-desktop.png") });
  await page
    .getByRole("button", { name: "Find a counterexample", exact: true })
    .click();
  await expect(page.locator(".arl-witness")).toHaveCSS("opacity", "1");
  await page.locator(".arl-witness").scrollIntoViewIfNeeded();
  await page
    .getByRole("button", { name: "Next witness event", exact: true })
    .click();
  await page.waitForTimeout(400);
  await page
    .getByRole("button", { name: "Next witness event", exact: true })
    .click();
  await page.screenshot({ path: path.join(dir, "witness-desktop.png") });
  for (const file of ["almost.bin", "exact.bin"])
    await page
      .locator("form")
      .getByRole("checkbox", { name: `/lab/evidence/${file}`, exact: false })
      .check();
  await page
    .locator("form")
    .getByRole("radio", { name: "Completes", exact: true })
    .check();
  await page.getByRole("button", { name: "Verify revised prediction" }).click();
  await page.getByRole("button", { name: "Try an unseen boundary →" }).click();
  for (const file of ["grain.bin", "edge.bin"])
    await page
      .locator("form")
      .getByRole("checkbox", { name: `/lab/evidence/${file}`, exact: false })
      .check();
  await page
    .locator("form")
    .getByRole("radio", { name: "Completes", exact: true })
    .check();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Commit follow-up answer" }).click();
  await expect(page.locator(".arl-record")).toContainText("Follow-up: agreed");
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export Investigation Record" })
    .click();
  const download = await downloading;
  await download.saveAs(path.join(dir, download.suggestedFilename()));
  await page.screenshot({ path: path.join(dir, "record-desktop.png") });
  const video = page.video();
  await context.close();
  await video.saveAs(path.join(dir, "learning-walkthrough.webm"));
  const original = await video.path();
  if (original !== path.join(dir, "learning-walkthrough.webm"))
    await fs.unlink(original);
  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  mobile.on("pageerror", (e) => errors.push(e.message));
  mobile.on("console", message=>{if(message.type()==="error")errors.push(message.text());});
  await mobile.goto(base);
  await mobile.evaluate(() => document.fonts.ready);
  await mobile.screenshot({ path: path.join(dir, "gallery-mobile.png") });
  await mobile.getByRole("link", { name: "Open the 100 MiB case →" }).click();
  await mobile
    .getByRole("button", {
      name: "Inspect /lab/evidence/almost.bin",
      exact: true,
    })
    .click();
  await mobile.locator(".arl-inspector").scrollIntoViewIfNeeded();
  await expect(mobile.locator(".arl-inspector")).toHaveCSS("opacity", "1");
  await mobile.screenshot({ path: path.join(dir, "evidence-mobile.png") });
  if (errors.length) throw Error(errors.join("\n"));
  await fs.writeFile(
    path.join(dir, "browser-evidence.json"),
    JSON.stringify(
      {
        verified_at: new Date().toISOString(),
        baseURL: base,
        title: "ShellForge — The Almost Right Lab",
        viewports: ["1440x1000", "390x844"],
        realInteractions: true,
        consoleErrors: errors,
      },
      null,
      2,
    ) + "\n",
  );
  await browser.close();
  console.log(
    "Recorded the actual prediction, interpreter, witness, transfer and export flow.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
