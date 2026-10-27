#!/usr/bin/env node
/**
 * S4 quotation verification (extends the S3 check pattern).
 * READ-ONLY: never writes anything.
 * Usage:
 *   node scripts/s4-quote-check.mjs              (against http://localhost:3000)
 *   BASE_URL=http://localhost:3000 node scripts/s4-quote-check.mjs
 *   node scripts/s4-quote-check.mjs --skip-db    (skip DB invariants)
 * Prereq: production server on :3000 (npm run build && npm start).
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SKIP_DB = process.argv.includes("--skip-db");

let pass = 0;
let fail = 0;

function ok(name) {
  pass++;
  console.log("PASS  " + name);
}

function bad(name, extra) {
  fail++;
  console.log("FAIL  " + name + (extra ? " - " + extra : ""));
}

// ---- mirrors of src/lib/quote.ts (keep in sync) ----

const VALID_DAYS_DEFAULT = 7;

function sanitizeItems(raw) {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 50) return null;
  const out = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) return null;
    const name = typeof entry.name === "string" ? entry.name.trim() : "";
    const qty = Number(entry.qty);
    const unit = Number(entry.unit);
    if (name.length < 1 || name.length > 200) return null;
    if (!Number.isInteger(qty) || qty < 1 || qty > 1000000) return null;
    if (!Number.isInteger(unit) || unit < 0 || unit > 100000000) return null;
    const note =
      typeof entry.note === "string" && entry.note.trim().length > 0
        ? entry.note.trim().slice(0, 500)
        : null;
    out.push({ name: name, qty: qty, unit: unit, note: note });
  }
  return out;
}

function itemsTotal(items) {
  let sum = 0;
  for (const item of items) sum += item.qty * item.unit;
  return sum;
}

function sanitizeTransport(raw) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 100000000) return 0;
  return n;
}

function sanitizeValidDays(raw) {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 30) return VALID_DAYS_DEFAULT;
  return n;
}

function quoteIsExpired(quote) {
  if (quote.validUntil === null) return false;
  if (quote.status === "accepted" || quote.status === "declined") return false;
  return quote.validUntil.getTime() < Date.now();
}

function quoteTotalOf(quote) {
  return quote.total > 0 ? quote.total : quote.amount;
}

// ---- 1. logic mirrors ----
console.log("S4 quotation check - logic mirrors (quote.ts)");

try {
  assert.deepEqual(sanitizeItems([{ name: " Mango sapling ", qty: 50, unit: 120 }]), [
    { name: "Mango sapling", qty: 50, unit: 120, note: null },
  ]);
  ok("sanitizeItems: trims names, fills null note");
} catch (e) {
  bad("sanitizeItems trim", e.message);
}

try {
  assert.equal(sanitizeItems([]), null);
  assert.equal(sanitizeItems("nope"), null);
  assert.equal(sanitizeItems([{ name: "", qty: 1, unit: 1 }]), null);
  assert.equal(sanitizeItems([{ name: "x", qty: 0, unit: 1 }]), null);
  assert.equal(sanitizeItems([{ name: "x", qty: 1, unit: -1 }]), null);
  assert.equal(sanitizeItems([{ name: "x", qty: 1.5, unit: 1 }]), null);
  ok("sanitizeItems: rejects empty / non-array / bad qty / bad unit");
} catch (e) {
  bad("sanitizeItems rejects", e.message);
}

try {
  assert.equal(sanitizeTransport("300"), 300);
  assert.equal(sanitizeTransport(-5), 0);
  assert.equal(sanitizeTransport(1.5), 0);
  assert.equal(sanitizeTransport(999999999), 0);
  assert.equal(sanitizeTransport(0), 0);
  ok("sanitizeTransport: clamps to 0..100000000 ints only");
} catch (e) {
  bad("sanitizeTransport", e.message);
}

try {
  assert.equal(sanitizeValidDays(0), 7);
  assert.equal(sanitizeValidDays(1), 1);
  assert.equal(sanitizeValidDays(30), 30);
  assert.equal(sanitizeValidDays(31), 7);
  assert.equal(sanitizeValidDays("7"), 7);
  ok("sanitizeValidDays: boundaries 1..30, default 7");
} catch (e) {
  bad("sanitizeValidDays", e.message);
}

try {
  assert.equal(itemsTotal([{ qty: 10, unit: 120 }, { qty: 5, unit: 80 }]), 1600);
  ok("itemsTotal: 10x120 + 5x80 = 1600");
} catch (e) {
  bad("itemsTotal", e.message);
}

try {
  assert.equal(quoteIsExpired({ validUntil: null, status: "sent" }), false);
  assert.equal(quoteIsExpired({ validUntil: new Date(Date.now() + 60000), status: "sent" }), false);
  assert.equal(quoteIsExpired({ validUntil: new Date(Date.now() - 60000), status: "sent" }), true);
  assert.equal(quoteIsExpired({ validUntil: new Date(Date.now() - 60000), status: "accepted" }), false);
  ok("quoteIsExpired: null/future ok, past+open expired, answered never");
} catch (e) {
  bad("quoteIsExpired", e.message);
}

try {
  assert.equal(quoteTotalOf({ amount: 1000, total: 0 }), 1000);
  assert.equal(quoteTotalOf({ amount: 500, total: 2000 }), 2000);
  ok("quoteTotalOf: legacy fallback + builder total");
} catch (e) {
  bad("quoteTotalOf", e.message);
}

try {
  const tok = randomBytes(16).toString("hex");
  assert.match(tok, /^[0-9a-f]{32}$/);
  assert.equal(tok.slice(0, 8).toUpperCase().length, 8);
  ok("token: 32 hex chars, 8-char ref");
} catch (e) {
  bad("token format", e.message);
}

// ---- 2. API authorization probes (no cookies) ----
console.log("");
console.log("API probes against " + BASE);

async function probe(name, path, init, expect) {
  try {
    const res = await fetch(BASE + path, init);
    if (res.status === expect) {
      ok(name + " -> " + expect);
    } else {
      bad(name, "expected " + expect + " got " + res.status);
    }
  } catch (e) {
    bad(name, "could not reach server (" + e.message + ")");
  }
}

await probe("builder POST without login", "/api/seller/quotes", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ leadId: "x" }),
}, 401);

await probe("buyer answer unknown token", "/api/quote/" + "0".repeat(32), {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ action: "accept" }),
}, 404);

await probe("buyer page unknown token", "/quote/" + "0".repeat(32), { method: "GET" }, 404);

await probe("landing page sanity", "/", { method: "GET" }, 200);

// ---- 3. DB invariants ----
console.log("");
if (SKIP_DB) {
  console.log("DB invariants skipped (--skip-db)");
} else {
  console.log("DB invariants (read-only)");
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  try {
    const quotes = await prisma.quote.findMany({
      include: { lead: { select: { status: true } } },
    });

    const statuses = new Set(["sent", "viewed", "accepted", "declined"]);
    let badTotal = 0;
    let badToken = 0;
    let badStatus = 0;
    let warnLead = 0;
    const seenTokens = new Set();
    let dupTokens = 0;

    for (const q of quotes) {
      if (!statuses.has(q.status)) badStatus++;
      if (Array.isArray(q.items) && q.items.length > 0) {
        const goods = itemsTotal(q.items.map((it) => ({ qty: Number(it.qty) || 0, unit: Number(it.unit) || 0 })));
        if (q.total !== goods + q.transport || q.amount !== goods) badTotal++;
        if (q.token === null) badToken++;
      }
      if (q.token !== null) {
        if (seenTokens.has(q.token)) dupTokens++;
        seenTokens.add(q.token);
      }
      if (q.status === "accepted" && q.lead.status !== "won") warnLead++;
    }

    if (badStatus === 0) ok("all " + quotes.length + " quote statuses in sent/viewed/accepted/declined");
    else bad("quote statuses", badStatus + " out of set");

    if (badTotal === 0) ok("builder totals == items + transport (and amount == goods)");
    else bad("builder totals", badTotal + " rows mismatch");

    if (badToken === 0) ok("every builder quote carries a public token");
    else bad("builder tokens", badToken + " missing");

    if (dupTokens === 0) ok("tokens unique");
    else bad("tokens unique", dupTokens + " duplicates");

    if (warnLead === 0) ok("accepted quotes -> lead won");
    else console.log("WARN  " + warnLead + " accepted quote(s) whose lead is not 'won' (fine if moved on later)");
  } catch (e) {
    bad("DB read", e.message);
  } finally {
    await prisma.$disconnect();
  }
}

// ---- verdict ----
console.log("");
if (fail === 0) {
  console.log("S4 QUOTE CHECK: ALL PASS (" + pass + " checks)");
} else {
  console.log("S4 QUOTE CHECK: FAILED - " + fail + " failed, " + pass + " passed");
  process.exit(1);
}