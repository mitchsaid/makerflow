// A stand-in for the AI service, for the browser tests only (docs/plans/import-onboarding.md, slice 2). It answers the
// one call the document reader makes: a canned reading, or a failure when the "document" says so. It never runs in
// the product: the app is pointed at it through ANTHROPIC_BASE_URL by playwright.config.ts.
import { createServer } from "node:http";

const READING = {
  business: {
    name: "Sweet Crumbs Bakery",
    ownerName: "Thandi Nkosi",
    phone: "082 555 1234",
    email: "hello@sweetcrumbs.example",
    addressLine1: "12 Long Street",
    addressLine2: "Gardens",
    city: "Cape Town",
    region: "Western Cape",
    postalCode: "8001",
    vatNumber: "4123456789",
  },
  items: [
    { name: "Chocolate cake", unitPrice: "450.00" },
    { name: "Cupcakes (dozen)", unitPrice: "180.00" },
  ],
};

createServer((req, res) => {
  if (req.method !== "POST") {
    res.writeHead(200).end("ok");
    return;
  }
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    let text = "";
    try {
      const sent = JSON.parse(body);
      const source = sent.messages[0].content[0].source;
      text = Buffer.from(source.data, "base64").toString("latin1");
    } catch {
      res.writeHead(400).end("{}");
      return;
    }
    const json = (status, value) => res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(value));
    if (text.includes("BUSY")) return json(429, { error: "busy" });
    if (text.includes("GARBAGE")) return json(200, { content: [{ type: "text", text: "I cannot do that" }] });
    const input = text.includes("NOTHING") ? { business: {}, items: [] } : READING;
    json(200, { content: [{ type: "tool_use", name: "record_document", input }] });
  });
}).listen(4010, "127.0.0.1");
