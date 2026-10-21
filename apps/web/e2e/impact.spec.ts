import { test, expect } from "@playwright/test";
import path from "node:path";
import { mkdir } from "node:fs/promises";
const evidence = process.env.PLAYWRIGHT_EVIDENCE_DIR ?? path.resolve(process.cwd(), "../../docs/visual-qa/impact");
test.beforeAll(() => mkdir(evidence, { recursive: true }));
const commandLabel = "Command · evaluated immediately against virtual data";
test("size predicates update actual matched rows and selected-file calculations", async ({
  page,
}) => {
  await page.goto("/lab");
  await expect(
    page.getByRole("heading", { name: "Command Impact Lab", exact: true }),
  ).toBeVisible();
  await expect(page.locator('.vfs-row[data-match="true"]')).toHaveCount(3);
  await page.getByLabel("Size predicate", { exact: true }).selectOption("100M");
  await expect(page.locator('.vfs-row[data-match="true"]')).toHaveCount(2);
  await expect(
    page.locator('[data-path="/lab/data/threshold-100.bin"]'),
  ).toHaveAttribute("data-match", "true");
  await expect(page.locator(".predicate-traces")).toContainText(
    "ceil(bytes / 1,048,576) = 100",
  );
  await page
    .getByLabel("Size predicate", { exact: true })
    .selectOption("104857600c");
  await expect(page.locator('.vfs-row[data-match="true"]')).toHaveCount(1);
  await expect(page.locator(".predicate-traces")).toContainText("104,857,600");
  await page.getByRole("button", { name: "-size", exact: true }).click();
  await expect(page.locator(".lab-token-detail")).toContainText(
    "rounds logical bytes UP",
  );
});
test("tree expansion, properties and traversal limits are connected", async ({
  page,
}) => {
  await page.goto("/lab");
  await page
    .getByRole("button", { name: "Collapse /lab/data/nested", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Properties /lab/data/nested/small.txt",
      exact: true,
    }),
  ).not.toBeVisible();
  await page
    .getByRole("button", { name: "Expand /lab/data/nested", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Properties /lab/data/nested/small.txt",
      exact: true,
    })
    .click();
  await expect(page.locator(".lab-properties")).toContainText("512");
  await page.getByLabel("Max depth", { exact: true }).selectOption("1");
  await expect(
    page.locator('[data-path="/lab/data/nested/small.txt"]'),
  ).toHaveAttribute("data-visited", "false");
  await expect(page.locator(".lab-properties")).toContainText(
    "Not visited by this command",
  );
});
test("recursive deletion preview, apply, diff and undo never change before state implicitly", async ({
  page,
}) => {
  await page.goto("/lab");
  await page
    .getByLabel("Load an experiment", { exact: true })
    .selectOption("rm -rf ./tmp/cache");
  await expect(page.locator(".lab-differences li")).toHaveCount(3);
  await expect(page.locator('[data-path="/lab/tmp/cache"]')).toBeVisible();
  await page
    .getByRole("button", { name: "Preview after", exact: true })
    .click();
  await expect(page.locator('[data-path="/lab/tmp/cache"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Before", exact: true }).click();
  await expect(page.locator('[data-path="/lab/tmp/cache"]')).toBeVisible();
  await page
    .getByRole("button", { name: "Apply to virtual snapshot", exact: false })
    .click();
  await expect(page.locator(".lab-applied")).toContainText("revision 1");
  await expect(page.locator('[data-path="/lab/tmp/cache"]')).toHaveCount(0);
  await page
    .getByRole("button", { name: "Undo virtual change", exact: true })
    .click();
  await expect(page.locator('[data-path="/lab/tmp/cache"]')).toBeVisible();
  await expect(page.locator(".lab-session")).toContainText("revision 0");
});
test("permission changes alter traversal; sticky restrictions and unsupported syntax cannot apply", async ({
  page,
}) => {
  await page.goto("/lab");
  const input = page.getByLabel(commandLabel, { exact: true });
  await input.fill("chmod 600 ./data/nested");
  await page
    .getByRole("button", { name: "Apply to virtual snapshot", exact: false })
    .click();
  await input.fill("find ./data/nested -type f");
  await expect(page.locator(".lab-summary")).toContainText("Partial result");
  await expect(page.locator(".lab-errors")).toContainText("read + search");
  await input.fill("rm ./tmp/root-owned.tmp");
  await expect(page.locator(".lab-summary")).toContainText("Sticky directory");
  await expect(
    page.getByRole("button", {
      name: "Apply to virtual snapshot",
      exact: false,
    }),
  ).toBeDisabled();
  await input.fill("find ./data -delete");
  await expect(page.locator(".lab-summary")).toContainText("Not simulated");
  await expect(
    page.getByRole("button", {
      name: "Apply to virtual snapshot",
      exact: false,
    }),
  ).toBeDisabled();
  await input.fill("find ./data | sort");
  await expect(page.locator(".lab-summary")).toContainText("Not simulated");
});
test("modeled creation, reset and route handoff preserve synthetic state", async ({
  page,
}) => {
  await page.goto("/lab");
  await page
    .getByLabel(commandLabel, { exact: true })
    .fill("touch ./tmp/created.txt");
  await page
    .getByRole("button", { name: "Apply to virtual snapshot", exact: false })
    .click();
  const current = await page
    .getByLabel(commandLabel, { exact: true })
    .inputValue();
  await page.getByRole("link", { name: "Open in X-Ray", exact: true }).click();
  await expect(page.getByLabel("01 / Paste your Bash command")).toHaveValue(
    current,
  );
  await page
    .getByRole("button", { name: "Inspect command", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Preview in Impact Lab", exact: false })
    .click();
  await expect(page.locator(".lab-session")).toContainText("revision 1");
  await expect(page.locator('[data-path="/lab/tmp/created.txt"]')).toHaveCount(
    1,
  );
  await page
    .getByRole("button", { name: "Reset fixture", exact: true })
    .click();
  await expect(page.locator('[data-path="/lab/tmp/created.txt"]')).toHaveCount(
    0,
  );
});
test("real static API independently flags deletion; unknown simulation can still be analyzed", async ({
  page,
}) => {
  await page.goto("/lab");
  await page
    .getByLabel(commandLabel, { exact: true })
    .fill("rm -rf ./tmp/cache");
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/commands/analyze") &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Inspect with static analyzer", exact: true })
    .click();
  const actual = await (await response).json();
  expect(actual.executed).toBe(false);
  expect(actual.safety.risk).toBe("DANGEROUS");
  await expect(page.locator(".lab-safety")).toContainText("DANGEROUS");
  await page.getByLabel(commandLabel, { exact: true }).fill('echo "unclosed');
  await expect(page.locator(".lab-safety")).not.toContainText("DANGEROUS");
  await expect(page.locator(".lab-summary")).toContainText("Not simulated");
  await page
    .getByRole("button", { name: "Inspect with static analyzer", exact: true })
    .click();
  await expect(page.locator(".lab-safety")).toContainText(
    "invalid / unverified",
  );
});
test("saved research pairs show actual pilot failure and regression without live model claims", async ({
  page,
}) => {
  await page.goto("/bench#saved-predictions");
  const section = page.locator("#saved-predictions");
  await expect(section).toContainText("base 3/32");
  await section.getByRole("combobox").selectOption("10");
  await expect(
    section.locator(".research-predictions article").first(),
  ).toContainText("YES");
  await expect(
    section.locator(".research-predictions article").last(),
  ).toContainText("NO");
  await expect(section).toContainText("not new inference");
  await expect(section.locator(".research-evidence").last()).toContainText(
    "SHA-256",
  );
});
for (const [width, height] of [
  [390, 844],
  [1440, 1000],
])
  test(`Impact Lab browser QA and screenshots ${width}x${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", message => { if(["error", "warning"].includes(message.type()) && !message.text().startsWith("You have Reduced Motion enabled")) errors.push(message.text()); });
    await page.goto("/lab");
    await page
      .getByLabel("Size predicate", { exact: true })
      .selectOption("100M");
    await expect(page.locator('.vfs-row[data-match="true"]')).toHaveCount(2);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    await page.screenshot({
      path: path.join(evidence, `lab-find-${width}x${height}.png`),
      fullPage: true,
    });
    await page
      .getByLabel("Load an experiment", { exact: true })
      .selectOption("rm -rf ./tmp/cache");
    await page
      .getByRole("button", { name: "Preview after", exact: true })
      .click();
    await expect(page.locator('[data-path="/lab/tmp/cache"]')).toHaveCount(0);
    await page.screenshot({
      path: path.join(evidence, `lab-diff-${width}x${height}.png`),
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });

test("normal-motion match transitions follow predicate state; adversarial text stays inert", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/lab");
  const row = page.locator('[data-path="/lab/data/threshold-100.bin"]');
  await expect(row).toHaveAttribute("data-match", "false");
  await page.getByLabel("Size predicate", { exact: true }).selectOption("100M");
  await expect(row).toHaveAttribute("data-match", "true");
  await expect(row).toHaveCSS("background-color", "rgb(41, 55, 27)");
  await page
    .getByLabel(commandLabel, { exact: true })
    .fill("touch './tmp/<img onerror=alert(1)>'");
  await expect(page.locator(".lab-summary")).toContainText(
    "1 virtual metadata change",
  );
  await page
    .getByRole("button", { name: "Preview after", exact: true })
    .click();
  await expect(
    page.locator('[data-path="/lab/tmp/<img onerror=alert(1)>"]'),
  ).toBeVisible();
  await expect(page.locator(".virtual-tree img")).toHaveCount(0);
});

test("analyzer errors and cancellations do not invalidate pure virtual simulation", async ({
  page,
}) => {
  await page.goto("/lab");
  await page.route("**/api/commands/analyze", (route) =>
    route.fulfill({ status: 503, body: "offline" }),
  );
  await page
    .getByRole("button", { name: "Inspect with static analyzer", exact: true })
    .click();
  await expect(page.locator(".lab-safety")).toContainText(
    "virtual simulation still works locally",
  );
  await page.getByLabel("Size predicate", { exact: true }).selectOption("100M");
  await expect(page.locator('.vfs-row[data-match="true"]')).toHaveCount(2);
  await page.unroute("**/api/commands/analyze");
  let release: (() => void) | undefined;
  await page.route("**/api/commands/analyze", async (route) => {
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    await route.abort().catch(() => {});
  });
  await page
    .getByRole("button", { name: "Inspect with static analyzer", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Cancel analysis", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Cancel analysis", exact: true })
    .click();
  release?.();
  await expect(page.locator(".lab-safety")).toContainText(
    "No analyzer result yet",
  );
});
