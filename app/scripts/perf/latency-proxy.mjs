// Adds a fixed delay to every request to the local Supabase API and counts the requests.
import http from "node:http";
const DELAY = Number(process.env.DELAY_MS || 0);
const TARGET = "http://127.0.0.1:54321";
let log = [];
http.createServer(async (req, res) => {
  if (req.url === "/__take") {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(log)); log = []; return;
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  await new Promise((r) => setTimeout(r, DELAY));
  const headers = { ...req.headers }; delete headers.host;
  const r = await fetch(TARGET + req.url, {
    method: req.method, headers, redirect: "manual",
    body: chunks.length ? Buffer.concat(chunks) : undefined,
  });
  const buf = Buffer.from(await r.arrayBuffer());
  const out = {};
  r.headers.forEach((v, k) => { if (!["content-encoding", "content-length", "transfer-encoding", "set-cookie"].includes(k)) out[k] = v; });
  out["content-length"] = String(buf.length);
  const cookies = r.headers.getSetCookie();
  if (cookies.length) out["set-cookie"] = cookies;
  res.writeHead(r.status, out); res.end(buf);
  log.push(req.method + " " + req.url.split("?")[0]);
}).listen(54399, () => console.log("proxy up, delay", DELAY));
