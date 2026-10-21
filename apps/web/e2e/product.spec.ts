import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const evidence = path.resolve(
  process.cwd(),
  "../../docs/visual-qa/screenshots",
);
const request = "Find files larger than 100 MiB in the current directory";
const command = "find . -type f -size +100M";

test.beforeAll(async () => {
  await mkdir(evidence, { recursive: true });
});

test("landing → actual API proposal → anatomy → copy → reset", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await expect(page).toHaveTitle("ShellForge — The Command Workshop");
  await page
    .getByRole("link", { name: "Enter the Forge", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/forge$/);
  const input = page.getByLabel("01 / Describe the operation");
  await input.fill(request);
  const responsePromise = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/commands/propose") &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Forge command", exact: true })
    .click();
  const response = await responsePromise;
  expect(response.ok()).toBe(true);
  const receipt = await response.json();
  expect(receipt.command).toBe(command);
  expect(receipt.executed).toBe(false);
  await expect(page.locator(".command-code")).toHaveText(command);
  await page
    .getByRole("button", {
      name: "Inspect +100M: Size constraint",
      exact: true,
    })
    .click();
  await expect(page.locator("#token-explanation")).toContainText(
    "more than 100 MiB",
  );
  await expect(page.locator(".verification-receipt")).toContainText(
    receipt.safety.risk,
  );
  await page.getByRole("button", { name: "Copy command" }).click();
  await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    command,
  );
  await page.getByRole("button", { name: "New request" }).click();
  await expect(input).toHaveValue("");
  await expect(input).toBeFocused();
  await expect(page.locator(".workbench-empty")).toBeVisible();
});

test("unsupported, unit clarification and platform constraints are honest", async ({
  page,
}) => {
  await page.goto("/forge");
  const input = page.getByLabel("01 / Describe the operation");
  await input.fill("Compress my home directory and upload it");
  await page
    .getByRole("button", { name: "Forge command", exact: true })
    .click();
  await expect(page.locator(".unsupported-state")).toContainText(
    "No model provider is configured",
  );
  await input.fill("Find files larger than 100 MB in the current directory");
  await page
    .getByRole("button", { name: "Forge command", exact: true })
    .click();
  await expect(page.locator(".unsupported-state")).toContainText(
    "Please use MiB",
  );
  await input.fill(request);
  await page.getByLabel("Environment", { exact: true }).selectOption("macos");
  await page
    .getByRole("button", { name: "Forge command", exact: true })
    .click();
  await expect(page.locator(".unsupported-state")).toContainText(
    "requires GNU/Linux",
  );
});

test("X-Ray shows real syntax errors and deterministic destructive findings", async ({
  page,
}) => {
  await page.goto("/xray");
  const input = page.getByLabel("01 / Paste your Bash command");
  await input.fill("rm -rf /tmp/cache");
  await page
    .getByRole("button", { name: "Inspect command", exact: true })
    .click();
  await expect(page.locator(".verification-receipt")).toContainText(
    "Recursive deletion",
  );
  await expect(page.locator(".verification-receipt")).toContainText(
    "DANGEROUS",
  );
  await input.fill('echo "unclosed');
  await page
    .getByRole("button", { name: "Inspect command", exact: true })
    .click();
  await expect(page.locator(".verification-receipt")).toContainText(
    "Invalid / unverified",
  );
});

test("untrusted command text is inert and Unicode offsets remain correct", async ({
  page,
}) => {
  await page.goto("/xray");
  const text = `echo '😀' '<img src=x onerror=alert(1)>'`;
  await page.getByLabel("01 / Paste your Bash command").fill(text);
  await page
    .getByRole("button", { name: "Inspect command", exact: true })
    .click();
  await expect(page.locator(".command-code")).toHaveText(text);
  await expect(page.locator(".command-code img")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Inspect '😀'/ }),
  ).toBeVisible();
});

test("API errors, cancellation and stale responses never become success", async ({
  page,
}) => {
  await page.goto("/forge");
  await page.route("**/api/commands/propose", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: '{"detail":"offline"}',
    }),
  );
  await page.getByLabel("01 / Describe the operation").fill("Show disk space");
  await page
    .getByRole("button", { name: "Forge command", exact: true })
    .click();
  await expect(page.locator(".api-error")).toContainText(
    "API could not complete",
  );
  await page.unroute("**/api/commands/propose");
  let release: (() => void) | undefined;
  await page.route("**/api/commands/propose", async (route) => {
    await new Promise<void>((resolve) => {
      release = resolve;
    });
    await route.abort().catch(() => {});
  });
  await page
    .getByRole("button", { name: "Forge command", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Cancel request" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel request" }).click();
  await expect(page.locator(".workbench-empty")).toBeVisible();
  release?.();
  await expect(page.locator(".receipt")).toHaveCount(0);
});

test("manual search, filter and editable parameters reach the actual template", async ({
  page,
}) => {
  await page.goto("/manual");
  await expect(page.locator(".recipe-row")).toHaveCount(12);
  await page.getByRole("searchbox").fill("space takers");
  await expect(page.locator(".recipe-row")).toHaveCount(1);
  await page.locator(".recipe-row summary").click();
  await page.getByLabel("Threshold (MiB)").fill("250");
  await page.getByLabel("Starting directory").fill("/tmp/my files");
  await page.getByRole("link", { name: "Open in the Forge" }).click();
  await expect(page.locator(".recipe-summary")).toContainText("size = 250");
  await page
    .getByRole("button", { name: "Forge command", exact: true })
    .click();
  await expect(page.locator(".command-code")).toHaveText(
    "find '/tmp/my files' -type f -size +250M",
  );
  await page.getByRole("link", { name: "Field Manual", exact: true }).click();
  await page.getByRole("combobox").selectOption("Disk & storage");
  await expect(page.locator(".recipe-row")).toHaveCount(2);
  await page.getByRole("searchbox").fill("no such recipe");
  await expect(page.getByText("No operation matches yet.")).toBeVisible();
});

test("keyboard-only core, token arrows and panel resizing", async ({
  page,
}) => {
  await page.goto("/forge");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  for (let i = 0; i < 10; i++) {
    if (
      await page
        .getByLabel("01 / Describe the operation")
        .evaluate((el) => el === document.activeElement)
    )
      break;
    await page.keyboard.press("Tab");
  }
  await expect(page.getByLabel("01 / Describe the operation")).toBeFocused();
  await page.keyboard.type("Show disk space");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Forge command", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "Inspect df: Utility", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Tab"); // copy
  await page.keyboard.press("Tab"); // first token
  await expect(
    page.getByRole("button", { name: "Inspect df: Utility", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("button", {
      name: "Inspect -h: Human-readable units",
      exact: true,
    }),
  ).toBeFocused();
  await expect(page.locator("#token-explanation")).toContainText(
    "Scale capacity units",
  );
  await page.getByRole("separator").focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("separator")).toHaveAttribute(
    "aria-valuenow",
    "62",
  );
});

test("mobile navigation, inspector tabs and reduced motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Menu +" }).click();
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "The Forge", exact: true }).click();
  await expect(page.getByRole("button", { name: "Menu +" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await page.getByLabel("01 / Describe the operation").fill(request);
  await page
    .getByRole("button", { name: "Forge command", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Inspect +100M: Size constraint",
      exact: true,
    })
    .click();
  await page.getByRole("tab", { name: "Inspector", exact: true }).click();
  await expect(page.locator("#token-explanation")).toContainText(
    "more than 100 MiB",
  );
  await expect(page.locator("#command-panel")).not.toBeVisible();
  expect(
    await page.evaluate(
      () => getComputedStyle(document.documentElement).scrollBehavior,
    ),
  ).toBe("auto");
  await page.screenshot({
    path: path.join(evidence, "mobile-inspector-390x844.png"),
    fullPage: true,
  });
});

test("research claims remain separated and actual landing example works", async ({
  page,
}) => {
  await page.goto("/bench");
  await expect(page.locator(".bench-lead")).toContainText("84 / 1,222");
  await expect(page.locator(".bench-lead")).toContainText(
    "not semantic correctness",
  );
  await expect(page.locator(".safety-study")).toContainText(
    "not the language model",
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Rounded size", exact: true }).click();
  await expect(page.locator(".comparison-explanation")).toContainText(
    "larger than 99 MiB",
  );
  await page.getByRole("button", { name: "Try the real example" }).click();
  await expect(page.locator(".demo-output code")).toHaveText(command);
});

for (const [width, height] of [
  [390, 844],
  [768, 1024],
  [1024, 768],
  [1440, 900],
  [1920, 1080],
]) {
  test(`responsive pixels and overflow ${width}×${height}`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning")
        if (!message.text().startsWith("You have Reduced Motion enabled"))
          errors.push(message.text());
    });
    for (const [route, name] of [
      ["/", "landing"],
      ["/forge", "forge"],
      ["/xray", "xray"],
      ["/manual", "manual"],
      ["/bench", "bench"],
    ]) {
      await page.goto(route);
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator("h1")).toBeVisible();
      if (name === "landing") {
        await expect(page.locator(".hero-art img")).toBeVisible();
        await page.locator("#invitation").scrollIntoViewIfNeeded();
        await page.evaluate(() => window.scrollTo(0, 0));
      }
      if (name === "forge") {
        await page.getByLabel("01 / Describe the operation").fill(request);
        await page
          .getByRole("button", { name: "Forge command", exact: true })
          .click();
        await expect(
          page.getByRole("button", {
            name: "Inspect +100M: Size constraint",
            exact: true,
          }),
        ).toBeVisible();
        await page
          .getByRole("button", {
            name: "Inspect +100M: Size constraint",
            exact: true,
          })
          .click();
      }
      if (name === "xray") {
        await page
          .getByLabel("01 / Paste your Bash command")
          .fill("rm -rf /tmp/cache");
        await page
          .getByRole("button", { name: "Inspect command", exact: true })
          .click();
        await expect(page.locator(".receipt")).toBeVisible();
      }
      if (name === "manual")
        await expect(page.locator(".recipe-row")).toHaveCount(12);
      await page.evaluate(() => window.scrollTo(0, 0));
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1,
        ),
        `${name} overflows`,
      ).toBe(true);
      await expect(
        page.locator("nextjs-portal [data-nextjs-dialog-overlay]"),
      ).not.toBeVisible();
      await page.screenshot({
        path: path.join(evidence, `${name}-${width}x${height}.png`),
        fullPage: true,
        animations: "disabled",
      });
    }
    expect(errors).toEqual([]);
  });
}
