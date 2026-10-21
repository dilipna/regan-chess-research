import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const base = process.env.QA_BASE_URL || "http://127.0.0.1:3190";
const out = path.resolve(process.env.QA_OUTPUT || "../../../../outputs/chess-preview/qa");
await mkdir(out, { recursive: true });
const manifest = JSON.parse(await readFile(".next/prerender-manifest.json", "utf8"));
const routes = Object.keys(manifest.routes).filter((r) => !r.startsWith("/_") && !/\.(txt|xml|svg|ico|png|jpg)$/.test(r));
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
const page = await context.newPage();
const errors = [], failures = [], internal = new Set();
page.on("pageerror", (error) => errors.push({ route: new URL(page.url()).pathname, message: error.message }));
const report = { base, sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), buildId: (await readFile(".next/BUILD_ID", "utf8")).trim(), browserVersion: browser.version(), routes: [], internalLinks: [], viewports: [], accessibility: [], interactions: [], errors, failures };
try {
  for (const route of routes) {
    const response = await page.goto(base + route, { waitUntil: "networkidle" });
    const row = { route, status: response.status(), title: await page.title(), h1: await page.locator("h1").count() };
    report.routes.push(row);
    if (row.status !== 200 || !row.title || row.h1 !== 1) failures.push({ kind: "route", ...row });
    for (const href of await page.locator('a[href^="/"]').evaluateAll((items) => items.map((a) => a.getAttribute("href")))) internal.add(href);
  }
  for (const href of internal) {
    const response = await context.request.get(base + href);
    report.internalLinks.push({ href, status: response.status() });
    if (!response.ok()) failures.push({ kind: "link", href, status: response.status() });
  }
  await page.goto(base + "/latent/demo", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Next →", exact: true }).click();
  await page.waitForFunction(() => document.querySelector("h1")?.textContent.startsWith("Step 2"));
  await page.keyboard.press("ArrowLeft");
  await page.waitForFunction(() => document.querySelector("h1")?.textContent.startsWith("Step 1"));
  report.interactions.push("Demo next button and keyboard previous step");
  await page.goto(base + "/latent/recall", { waitUntil: "networkidle" });
  const passage = page.getByRole("radiogroup", { name: "Passage" }).getByRole("radio").nth(1);
  await passage.click();
  assert.equal(await passage.getAttribute("aria-checked"), "true");
  const token = page.getByRole("button", { name: /^position / }).first();
  await token.click();
  assert.equal(await token.getAttribute("aria-pressed"), "true");
  await page.getByRole("region", { name: "Recall summary table" }).focus();
  assert.equal(await page.locator(":focus").getAttribute("aria-label"), "Recall summary table");
  report.interactions.push("Recall passage/token selection and keyboard-focusable summary");
  for (const file of ["maia-verification.json", "hybrid-verification.json"]) {
    const response = await context.request.get(base + "/data/engineering/" + file);
    assert.equal(response.status(), 200);
    assert.deepEqual(await response.body(), await readFile("public/data/engineering/" + file));
  }
  report.interactions.push("Published verification downloads are byte-identical to the checked snapshots");
  const samples = ["/", "/chess", "/engineering", "/compare", "/latent", "/latent/recall", "/latent/glassbox", "/latent/security/labs", "/latent/mastery"];
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of samples) {
      await page.goto(base + route, { waitUntil: "networkidle" });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      report.viewports.push({ route, width, overflow });
      if (overflow) failures.push({ kind: "overflow", route, width });
      if (width === 390 || width === 1440) {
        await page.screenshot({ path: path.join(out, `${route.replaceAll("/", "_") || "home"}-${width}.png`), fullPage: true });
      }
      if (["/", "/chess", "/engineering", "/latent/recall", "/latent/glassbox"].includes(route) && [390, 1440].includes(width)) {
        const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
        const violations = result.violations.map((v) => ({ id: v.id, impact: v.impact, description: v.description, nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })) }));
        report.accessibility.push({ route, width, violations });
        if (violations.length) failures.push({ kind: "accessibility", route, width, count: violations.length });
      }
    }
  }
} catch (error) {
  failures.push({ kind: "runner", message: error.stack });
} finally {
  await browser.close();
  report.status = failures.length || errors.length ? "FAIL" : "PASS";
  await writeFile(path.join(out, "browser-report.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ status: report.status, routes: report.routes.length, links: report.internalLinks.length, viewports: report.viewports.length, accessibility: report.accessibility.length, errors: errors.length, failures }, null, 2));
}
if (report.status !== "PASS") process.exitCode = 1;
