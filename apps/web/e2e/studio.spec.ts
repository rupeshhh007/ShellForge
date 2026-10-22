import { test, expect } from "@playwright/test";
import path from "node:path";
import { mkdir } from "node:fs/promises";
const evidence =
  process.env.PLAYWRIGHT_EVIDENCE_DIR ??
  path.resolve(process.cwd(), "../../docs/visual-qa/studio");
test.beforeAll(() => mkdir(evidence, { recursive: true }));
test("final saved predictions retain primary cohort, provenance, raw failures and separate pilot", async ({
  page,
}) => {
  await page.goto("/studio");
  await expect(page.getByLabel("Saved case").locator("option")).toHaveCount(
    1222,
  );
  await expect(page.locator(".accuracy-study")).toContainText("84 / 1,222");
  await expect(page.locator(".accuracy-study")).toContainText(
    "Full 0–100% scale",
  );
  await page.locator(".studio-provenance summary").click();
  await expect(page.locator(".studio-provenance")).toContainText(
    "afff8a917b26",
  );
  await page.getByLabel("Experiment", { exact: true }).selectOption("pilot");
  await expect(page.getByLabel("Saved case").locator("option")).toHaveCount(32);
  await page.getByLabel("Saved case").selectOption("10");
  await expect(page.locator(".prediction-panel").first()).toContainText("YES");
  await expect(page.locator(".prediction-panel").nth(1)).toContainText("NO");
  await page.getByRole("button", { name: "Live Model", exact: true }).click();
  await expect(page.getByLabel("Natural-language request")).toBeDisabled();
  await page.getByRole("button", { name: "Template", exact: true }).click();
  await page.getByLabel("Natural-language request").fill("Show disk space");
  await page.getByRole("button", { name: "Render supported template" }).click();
  await expect(page.locator(".studio-inspection")).toContainText("df -h");
  await expect(page.locator(".studio-inspection")).toContainText(
    "deterministic-templates",
  );
});
test("permission focus dialog traps keyboard, applies real mode change, undo and restores focus", async ({
  page,
}) => {
  await page.goto("/lab");
  const opener = page.getByRole("button", {
    name: "Permissions, bit by bit. Open experiment",
  });
  await opener.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Close Permissions, bit by bit." }),
  ).toBeFocused();
  await page.getByLabel("Permission entry").selectOption("/lab/data/nested");
  await dialog
    .getByRole("group", { name: "Owner", exact: true })
    .getByRole("checkbox", { name: "search / execute x" })
    .uncheck();
  await expect(dialog.locator(".command-display")).toContainText("chmod 0655");
  await page.getByRole("button", { name: "Apply permission preview" }).click();
  await expect(dialog.getByRole("status")).toContainText(
    "Incomplete traversal",
  );
  await page.getByRole("button", { name: "Undo permission change" }).click();
  await expect(dialog.getByRole("status")).not.toContainText(
    "Incomplete traversal",
  );
  await page.keyboard.press("Shift+Tab");
  expect(
    await page.evaluate(() =>
      document.querySelector("dialog")?.contains(document.activeElement),
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(opener).toBeFocused();
});
test("scheduler responds to workload, policy, actual playback and invalid input", async ({
  page,
}) => {
  await page.goto("/lab");
  await page
    .getByRole("button", { name: "Who gets the CPU? Open experiment" })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".gantt")).toContainText("0–1");
  await page.getByRole("button", { name: "Next tick" }).click();
  await expect(dialog).toContainText("t = 1");
  await expect(dialog.locator(".cpu-queues")).toContainText("B");
  await page.getByLabel("Scheduling policy").selectOption("FCFS");
  await expect(dialog.locator(".gantt")).toContainText("0–5");
  await page.getByLabel("Process 1 burst").fill("0");
  await expect(dialog.getByRole("alert")).toContainText("burst 1–100");
  await expect(dialog.locator(".gantt")).toHaveCount(0);
});
test("interpreter playback follows real path observations and resets after edits", async ({
  page,
}) => {
  await page.goto("/lab");
  await page.getByRole("button", { name: "Step forward", exact: true }).click();
  await expect(page.locator(".trace-event")).toContainText("Resolved ./data");
  await page.getByRole("button", { name: "Step forward", exact: true }).click();
  await expect(page.locator(".trace-event")).toContainText("permission");
  await page.getByLabel("Interpreter event").fill("7");
  await expect(page.locator(".trace-event")).toContainText("Visit depth");
  await page
    .getByLabel("Command · evaluated immediately against virtual data", {
      exact: true,
    })
    .fill("find ./data | sh");
  await expect(page.locator(".trace-event")).toContainText("not simulated");
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeDisabled();
});
for (const [width, height] of [
  [390, 844],
  [1440, 1000],
])
  test(`studio visual QA ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (const route of ["/", "/lab", "/studio"]) {
      await page.goto(route);
      await page.evaluate(() => document.fonts.ready);
      if (route === "/studio")
        await expect(
          page.getByLabel("Saved case").locator("option"),
        ).toHaveCount(1222);
      await expect(page.locator("h1")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      await page.screenshot({
        path: path.join(
          evidence,
          `${route === "/" ? "home" : route.slice(1)}-${width}x${height}.png`,
        ),
        fullPage: true,
      });
    }
    await page.goto("/lab");
    await page
      .getByRole("button", { name: "Who gets the CPU? Open experiment" })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: path.join(evidence, `scheduler-${width}x${height}.png`),
    });
    await page.keyboard.press("Escape");
    expect(errors).toEqual([]);
  });
