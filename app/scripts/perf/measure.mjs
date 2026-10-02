import { chromium, devices } from "@playwright/test";
const base = "http://localhost:3000", mail = "http://127.0.0.1:54324", proxy = "http://127.0.0.1:54399";
const userRtt = Number(process.env.USER_RTT || 0);
const email = `perf-${Date.now()}@example.test`;
const browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
const ctx = await browser.newContext({ ...devices["Pixel 7"] });
const page = await ctx.newPage();

// Sign up a fresh user through the real flow.
await page.goto(base + "/sign-in");
await page.getByLabel("Email address").fill(email);
await page.getByRole("button", { name: "Email me a sign-in link" }).click();
await page.getByRole("status").waitFor();
let link;
for (let i = 0; i < 40 && !link; i++) {
  const m = await (await fetch(`${mail}/api/v1/search?query=${encodeURIComponent("to:" + email)}`)).json();
  if (m.messages?.length) {
    const d = await (await fetch(`${mail}/api/v1/message/${m.messages[0].ID}`)).json();
    link = `${d.HTML} ${d.Text}`.match(/https?:\/\/[^\s"'<>]+\/auth\/confirm\?[^\s"'<>]+/)?.[0]?.replace(/&amp;/g, "&");
  }
  if (!link) await new Promise((r) => setTimeout(r, 300));
}
await page.goto(link);
await page.getByLabel("Business name").fill("Perf Co");
await page.getByRole("button", { name: "Continue" }).click();
await page.getByTestId("business-name").waitFor();
await page.waitForTimeout(1500); // let prefetching settle, like a user looking at the page

if (userRtt > 0) {
  // Simulate the distance between the phone and the server.
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: userRtt, downloadThroughput: -1, uploadThroughput: -1 });
}

let pending = [];
page.on("request", (r) => {
  if (["document", "fetch", "script", "xhr"].includes(r.resourceType())) {
    const u = new URL(r.url());
    pending.push(r.resourceType()[0] + ":" + u.pathname.replace("/_next/static/chunks/", "~/").slice(0, 44) + (u.search.includes("_rsc") ? "?_rsc" : ""));
  }
});

// "Reacted" = a loading skeleton is showing, or the destination's real content is.
const HEADINGS = { Business: "Business profile", Customers: "Customers" };
// Runs in the browser, so it must not use anything from this file: the heading comes in as the argument.
const REACTED = (heading) =>
  !!document.querySelector('[data-testid="page-loading"]') ||
  (heading
    ? document.querySelector("main h1")?.textContent === heading
    : !!document.querySelector('[data-testid="business-name"]'));

await fetch(proxy + "/__take");
const rows = [];
for (let i = 0; i < 6; i++) {
  for (const to of ["Customers", "Business", "Home"]) {
    await page.waitForTimeout(900);
    pending = [];
    const t0 = Date.now();
    await page.getByRole("link", { name: to }).click();
    await page.waitForFunction(REACTED, HEADINGS[to] ?? null);
    const feedback = Date.now() - t0;
    if (HEADINGS[to]) await page.getByRole("heading", { name: HEADINGS[to], level: 1 }).waitFor();
    else await page.getByTestId("business-name").waitFor();
    const content = Date.now() - t0;
    const calls = await (await fetch(proxy + "/__take")).json();
    rows.push({ to, feedback, content, calls, reqs: [...pending] });
  }
}
const use = rows.slice(2); // ignore warm-up
const avg = (a) => Math.round(a.reduce((x, y) => x + y, 0) / a.length);
console.log(`   first reaction: avg ${avg(use.map((r) => r.feedback))} ms | content: avg ${avg(use.map((r) => r.content))} ms | Supabase calls per click: ${[...new Set(use.map((r) => r.calls.length))].join("/")}`);
for (const to of ["Customers", "Business", "Home"]) {
  const r = use.filter((x) => x.to === to);
  console.log(`   -> ${to}: reaction ${avg(r.map((x) => x.feedback))} ms, content ${avg(r.map((x) => x.content))} ms | browser requests: ${r[0].reqs.join(" | ") || "(none)"} | DB/auth calls: ${r[0].calls.join(" | ")}`);
}
await browser.close();
