import fs from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";

const paths = [
  "src/server.ts",
  "src/db/schema.ts",
  "src/api/cart.ts",
  "src/api/checkout.ts",
  "src/webhooks/stripe.ts",
];
const sources = await Promise.all(paths.map((p) => fs.readFile(p, "utf8")));
for (const s of sources) stripTypeScriptTypes(s);
const [server, schema, cart, checkout, webhook] = sources;

const required = ["products", "variants", "carts", "lineItems", "orders", "payments", "webhookEvents"];
for (const t of required) {
  if (!schema.includes(t)) throw new Error(`schema.ts missing table: ${t}`);
}

if (!checkout.includes("paymentIntent") && !checkout.includes("PaymentIntent")) {
  throw new Error("checkout.ts must use Stripe PaymentIntent flow");
}

if (!webhook.includes("constructEvent") && !webhook.includes("signature")) {
  throw new Error("stripe.ts webhook must verify the signature (stripe.webhooks.constructEvent)");
}

if (!webhook.includes("webhookEvents") && !webhook.includes("idempot")) {
  throw new Error("stripe.ts webhook must be idempotent via webhookEvents table");
}

if (!server.includes('/health')) {
  throw new Error("server.ts missing /health route");
}

JSON.parse(await fs.readFile("package.json", "utf8"));
console.log("commerce starter ok");
