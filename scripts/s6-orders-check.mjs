// Mission S6-A verification - run with the LOCAL SERVER UP:
//
//   node scripts/s6-orders-check.mjs                     (localhost:3000)
//   node scripts/s6-orders-check.mjs https://tomavine.vercel.app
//
// Read-only EXCEPT two designed probes that exercise the real
// middle-layer flow on demo rows: it accepts demo-quote-bulk-02
// (placing a genuine order request) and confirms receipt on
// demo-order-track-1005. Re-run the seed first to reset those.
import { PrismaClient } from "@prisma/client";
import { loadDbEnv } from "./lib/db-env.mjs";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";

loadDbEnv();
const prisma = new PrismaClient();

const BASE = process.argv[2] || "http://localhost:3000";
let pass = 0;
let fail = 0;

function ok(name, cond, detail) {
  if (cond) {
    pass += 1;
    console.log("PASS  " + name);
  } else {
    fail += 1;
    console.log("FAIL  " + name + (detail ? "  -> " + detail : ""));
  }
}

function note(name) {
  console.log("NOTE  " + name + " (skipped - run node scripts/s6-seed.mjs to reset)");
}

async function probe(method, path, body) {
  try {
    const res = await fetch(BASE + path, {
      method: method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {}
    return { status: res.status, text: text, json: json };
  } catch (e) {
    return { status: 0, text: String(e), json: null };
  }
}

const root = fileURLToPath(new URL("../", import.meta.url));
function src(rel) {
  return readFileSync(root + rel, "utf8");
}

// ---------------------------------------------------------------
// A. Source checks
// ---------------------------------------------------------------
console.log("--- source checks ---");

ok(
  "quote route places order requests",
  src("src/app/api/quote/[token]/route.ts").includes("placeOrderRequest") &&
    src("src/app/api/quote/[token]/route.ts").includes("Order request placed from quotation"),
);

ok(
  "quote route nests the bulk pack in meta.bulk",
  src("src/app/api/quote/[token]/route.ts").includes("bulk: {") &&
    !src("src/app/api/quote/[token]/route.ts").includes("bulk: true,"),
);

ok(
  "order route confirms receipt",
  src("src/app/api/order/[token]/route.ts").includes("buyerConfirmedAt") &&
    src("src/app/api/order/[token]/route.ts").includes("Buyer confirmed receipt on the platform"),
);

ok("notify appends tracking link", src("src/lib/notify.ts").includes("/order/"));

ok(
  "seller console renders bulk lines",
  src("src/app/seller/orders/page.tsx").includes("orderRowsOf") &&
    src("src/app/seller/orders/page.tsx").includes("copyTrackLink"),
);

ok("packing slip renders bulk lines", src("src/app/seller/orders/[id]/slip/page.tsx").includes("slipRows"));

const i18nSrc = src("src/lib/i18n.tsx");
const spreadCount = (i18nSrc.match(/\.\.\.DICT_S6\./g) || []).length;
ok("i18n wires DICT_S6 into all 6 languages", i18nSrc.includes('import { DICT_S6 } from "./i18n-s6"') && spreadCount === 6, "spreads found: " + spreadCount);

if (existsSync(root + "src/lib/i18n-s6.ts")) {
  const d6 = src("src/lib/i18n-s6.ts");
  const keyCount = (d6.match(/s6_track_title/g) || []).length;
  ok("i18n-s6.ts has 6 language blocks", keyCount === 6, "s6_track_title occurrences: " + keyCount);
} else {
  ok("i18n-s6.ts present", false, "file missing - save it from the chat via Notepad (UTF-8)");
}

ok(
  "schema carries moq + trackToken",
  src("prisma/schema.prisma").includes("moq          Int?") &&
    src("prisma/schema.prisma").includes("trackToken  String?  @unique"),
);

ok("trust meta preserves nested pack", src("src/lib/trust.ts").includes("Object.assign(base, existing"));

ok("catalog API returns moq", src("src/app/api/catalog/products/[id]/route.ts").includes("moq: product.moq"));

ok("product detail shows moq", src("src/components/product-detail.tsx").includes("s6_moq_line"));

// ---------------------------------------------------------------
// B. HTTP probes
// ---------------------------------------------------------------
console.log("--- http probes (" + BASE + ") ---");

const p1002 = await probe("GET", "/order/demo-order-track-1002");
ok("public order page 1002 renders", p1002.status === 200 && p1002.text.includes("BULK-DEMO-1002"), "status " + p1002.status);

const p1004 = await probe("GET", "/order/demo-order-track-1004");
ok("public order page 1004 renders (completed)", p1004.status === 200 && p1004.text.includes("BULK-DEMO-1004"), "status " + p1004.status);

const p1003 = await probe("GET", "/order/demo-order-track-1003");
ok(
  "timeline shows the truck note",
  p1003.status === 200 && p1003.text.includes("AP 16 TV 2345"),
  "status " + p1003.status,
);

const p404 = await probe("GET", "/order/demo-order-track-9999");
ok("unknown tracking token is a 404", p404.status === 404, "status " + p404.status);

const c409 = await probe("POST", "/api/order/demo-order-track-1004", { action: "confirm" });
ok("already-confirmed order refuses a second confirm (409)", c409.status === 409, "status " + c409.status);

const c400 = await probe("POST", "/api/order/demo-order-track-1002", { action: "confirm" });
ok("confirm refused while still CONFIRMED (400)", c400.status === 400, "status " + c400.status);

const q404 = await probe("POST", "/api/quote/unknown-token-x", { action: "accept" });
ok("unknown quote token is a 404", q404.status === 404, "status " + q404.status);

const q400 = await probe("POST", "/api/quote/demo-quote-bulk-01", { action: "nope" });
ok("bad quote action is a 400", q400.status === 400, "status " + q400.status);

// The two LIVE probes. Detect if the demo rows were already consumed
// by an earlier run and skip gracefully (re-seed to reset).
const q2 = await prisma.quote.findUnique({ where: { token: "demo-quote-bulk-02" } });
let e2eTrackToken = null;

if (q2 === null) {
  note("demo-quote-bulk-02 missing - accept E2E probe skipped");
} else if (q2.status !== "sent") {
  note("demo-quote-bulk-02 already " + q2.status + " - accept E2E probe skipped");
} else {
  const acc = await probe("POST", "/api/quote/demo-quote-bulk-02", { action: "accept" });
  const order = acc.json && acc.json.order ? acc.json.order : null;
  ok(
    "accepting a quote places an order request",
    acc.status === 200 && acc.json.ok === true && order !== null && typeof order.trackToken === "string" && order.trackToken.length >= 16 && typeof order.code === "string" && order.code.startsWith("NH-"),
    "status " + acc.status,
  );
  if (order !== null) {
    e2eTrackToken = order.trackToken;
    const live = await probe("GET", "/order/" + e2eTrackToken);
    ok(
      "the fresh order request is instantly trackable",
      live.status === 200 && live.text.includes(order.code),
      "status " + live.status,
    );
  }
}

const o1005 = await prisma.order.findUnique({ where: { trackToken: "demo-order-track-1005" } });
if (o1005 === null) {
  note("demo-order-track-1005 missing - confirm probe skipped");
} else {
  const meta1005 = (o1005.meta ?? {});
  const alreadyConfirmed =
    meta1005 !== null && typeof meta1005 === "object" && typeof meta1005.buyerConfirmedAt === "string";

  if (alreadyConfirmed) {
    note("1005 already confirmed - confirm probe skipped");
  } else {
    const cf = await probe("POST", "/api/order/demo-order-track-1005", { action: "confirm" });
    ok("buyer confirm lands (200 + ok)", cf.status === 200 && cf.json && cf.json.ok === true, "status " + cf.status);

    const cf2 = await probe("POST", "/api/order/demo-order-track-1005", { action: "confirm" });
    ok("second confirm refused (409)", cf2.status === 409, "status " + cf2.status);

    const after = await probe("GET", "/order/demo-order-track-1005");
    ok("confirmed order page still renders", after.status === 200 && after.text.includes("BULK-DEMO-1005"), "status " + after.status);
  }
}

// ---------------------------------------------------------------
// C. DB invariants
// ---------------------------------------------------------------
console.log("--- db invariants ---");

const demoOrders = await prisma.order.findMany({
  where: { code: { startsWith: "BULK-DEMO-" } },
  include: { events: { orderBy: { createdAt: "asc" } } },
});
ok("five demo orders exist", demoOrders.length === 5, "found " + demoOrders.length);

let packsOk = true;
for (const o of demoOrders) {
  const m = o.meta !== null && typeof o.meta === "object" ? o.meta : {};
  const bulk = m.bulk;
  const items =
    bulk !== null && typeof bulk === "object" && Array.isArray(bulk.items)
      ? bulk.items
      : null;
  const good = Array.isArray(items) && items.length > 0;
  ok("order " + o.code + " carries meta.bulk.items", good, good ? "" : "missing items pack");
  if (!good) {
    packsOk = false;
  }
}
ok("all demo orders carry their meta.bulk items pack", packsOk, packsOk ? "" : "one or more item packs missing");

const o1004row = demoOrders.find((o) => o.code === "BULK-DEMO-1004");
if (o1004row) {
  const m = o1004row.meta !== null && typeof o1004row.meta === "object" ? o1004row.meta : {};
  const last = o1004row.events[o1004row.events.length - 1];
  ok(
    "1004 completed the full happy path",
    o1004row.status === "DELIVERED" &&
      o1004row.events.length === 6 &&
      typeof m.buyerConfirmedAt === "string" &&
      m.onTime === true &&
      last.actorRole === "CUSTOMER" &&
      (last.note ?? "").includes("Buyer confirmed"),
    "events " + o1004row.events.length,
  );
} else {
  ok("1004 present for invariant check", false, "not found");
}

const o1003row = demoOrders.find((o) => o.code === "BULK-DEMO-1003");
if (o1003row) {
  ok(
    "1003 is out for delivery with PIN + 4 events",
    o1003row.status === "OUT_FOR_DELIVERY" && o1003row.deliveryOtp === "4821" && o1003row.events.length === 4,
    "status " + o1003row.status + " events " + o1003row.events.length,
  );
} else {
  ok("1003 present for invariant check", false, "not found");
}

// Re-fetch: q2 was read BEFORE the accept probe flipped it, so its
// status is stale here - the E2E invariants below must see it as
// accepted to actually run.
const q2now = q2 !== null ? await prisma.quote.findUnique({ where: { token: "demo-quote-bulk-02" } }) : null;
if (q2now !== null && q2now.status === "accepted" && e2eTrackToken !== null) {
  const e2eOrder = await prisma.order.findUnique({
    where: { trackToken: e2eTrackToken },
    include: { events: true },
  });
  ok(
    "E2E order mirrors the quote",
    e2eOrder !== null &&
      e2eOrder.status === "PENDING" &&
      e2eOrder.total === q2.total &&
      e2eOrder.nurseryId === q2.nurseryId &&
      e2eOrder.deliveryFee === q2.transport &&
      e2eOrder.events.length === 1 &&
      e2eOrder.events[0].actorRole === "CUSTOMER",
    e2eOrder === null ? "order not found" : "total " + e2eOrder.total + " vs " + q2.total,
  );

  const leadC = await prisma.bulkLead.findUnique({ where: { id: q2.leadId } });
  ok("the quoted lead moved to won", leadC !== null && leadC.status === "won", "status " + (leadC ? leadC.status : "null"));
} else {
  note("E2E DB invariants skipped (probe was skipped above)");
}

const q1 = await prisma.quote.findUnique({ where: { token: "demo-quote-bulk-01" } });
ok(
  "demo-quote-bulk-01 still awaits YOUR click (status sent)",
  q1 !== null && q1.status === "sent",
  "status " + (q1 ? q1.status : "null"),
);

const moqCount = await prisma.product.count({
  where: { nursery: { slug: { in: ["kaveri-agri-demo", "godavari-bio-demo"] } }, moq: { not: null } },
});
ok("demo products carry moq values", moqCount === 10, "found " + moqCount);

// ---------------------------------------------------------------
console.log("");
console.log("RESULT: " + pass + " passed, " + fail + " failed");
if (fail > 0) {
  process.exit(1);
}
console.log("ALL PASS");

await prisma.$disconnect();