// Screenshot pass for design review: node scripts/screenshots.mjs  (needs both servers up; output in /tmp/shots)
import { chromium } from "playwright";
const b = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const p = await ctx.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push("pageerror: " + e.message));
p.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 200)); });
const shot = (name, opts = {}) => p.screenshot({ path: `/tmp/shots/${name}.png`, ...opts });

for (const [name, path] of [["ask","/ask"],["insights","/insights"],["explore","/explore"],["guardrails","/guardrails"]]) {
  await p.goto("http://localhost:3000" + path, { waitUntil: "networkidle", timeout: 60000 });
  await p.waitForTimeout(1000);
  await shot(name);
}
await p.emulateMedia({ colorScheme: "dark" });
await p.goto("http://localhost:3000/ask", { waitUntil: "networkidle" });
await p.waitForTimeout(800);
await shot("ask-dark");

// live: the stepper mid-run, then the finished answer
await p.emulateMedia({ colorScheme: "light" });
await p.goto("http://localhost:3000/ask", { waitUntil: "networkidle" });
await p.fill("textarea", "Which payer takes the longest to remit?");
await p.keyboard.press("Enter");
await p.waitForTimeout(4500);
await shot("ask-live");
try { await p.waitForSelector("text=/rows? in /", { timeout: 120000 }); await p.waitForTimeout(7000); } catch { errors.push("answer did not arrive in 120s"); }
await shot("ask-answer", { fullPage: true });

// history: open the previous conversation from the sidebar and check the stepper rebuilds
await p.goto("http://localhost:3000/ask", { waitUntil: "networkidle" });
await p.waitForTimeout(1200);
const rows = p.locator("aside button", { hasText: /waiting longest|remit/i });
if (await rows.count()) { await rows.first().click(); await p.waitForTimeout(2500); await shot("ask-history", { fullPage: true }); }
else errors.push("no history row found in sidebar");

console.log(errors.length ? errors.join("\n") : "no browser errors");
await b.close();
