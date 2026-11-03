#!/usr/bin/env node
// Takes desktop + mobile screenshots of routes and reports console/network errors.
// Usage: node capture.mjs --out <dir> [--base <url>] [--state <storageState.json>] <route> [<route> ...]
import { chromium } from "playwright";
import { mkdirSync, existsSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const opts = { out: ".captures", base: "http://localhost:5173", state: null };
const routes = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--out") opts.out = args[++i];
  else if (a === "--base") opts.base = args[++i];
  else if (a === "--state") opts.state = args[++i];
  else routes.push(a);
}
if (routes.length === 0) {
  console.error("Usage: capture.mjs --out <dir> [--base <url>] [--state <file>] <route> [<route> ...]");
  process.exit(2);
}
if (opts.state && !existsSync(opts.state)) {
  console.error(`Storage state not found: ${opts.state}`);
  process.exit(2);
}

mkdirSync(opts.out, { recursive: true });
const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

const slug = (r) =>
  r
    .replace(/^#\/?/, "")
    .replace(/^\/+|\/+$/g, "")
    .replace(/[^a-z0-9]+/gi, "-") || "home";

const browser = await chromium.launch();
let failures = 0;

for (const route of routes) {
  for (const vp of viewports) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      ...(opts.state ? { storageState: opts.state } : {}),
    });
    const page = await context.newPage();
    const problems = [];
    page.on("console", (m) => {
      const text = m.text();
      if (
        text.includes("React Router Future Flag Warning") ||
        text.includes("Download the React DevTools")
      ) {
        return;
      }
      if (m.type() === "error") {
        if (route.includes("login") && text.includes("401")) return;
        problems.push(`console: ${text}`);
      }
    });
    page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
    page.on("requestfailed", (r) => {
      const err = r.failure()?.errorText || "";
      if (err === "net::ERR_ABORTED") return;
      problems.push(`request failed: ${r.url()} (${err})`);
    });
    page.on("response", (r) => {
      if (r.status() >= 400) {
        if (route.includes("login") && r.url().includes("/api/seguridad/me") && r.status() === 401) {
          return;
        }
        problems.push(`${r.status()}: ${r.url()}`);
      }
    });

    const targetUrl = route.startsWith("/#")
      ? new URL(route, opts.base).toString()
      : route.startsWith("#")
      ? new URL("/" + route, opts.base).toString()
      : route.startsWith("/")
      ? new URL("/#" + route, opts.base).toString()
      : new URL("/#/" + route, opts.base).toString();

    try {
      await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(600);
    } catch (e) {
      problems.push(`navigation: ${e.message}`);
    }

    const file = path.join(opts.out, `${slug(route)}-${vp.name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(`${route} [${vp.name}] -> ${file}`);
    for (const p of problems) console.log(`  ! ${p}`);
    if (problems.length) failures++;
    await context.close();
  }
}
await browser.close();
process.exit(failures ? 1 : 0);
