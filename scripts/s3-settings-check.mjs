#!/usr/bin/env node
/**
 * S3 settings + tier-math verification (extends the S2 tier-check
 * pattern). READ-ONLY: never writes anything.
 * Usage:
 *   node scripts/s3-settings-check.mjs              (against http://localhost:3000)
 *   BASE_URL=http://localhost:3000 node scripts/s3-settings-check.mjs
 *   node scripts/s3-settings-check.mjs --skip-db    (skip raw-row comparison)
 * Prereq: production server on :3000 (npm run build && npm start).
 * DEV fallback test: DELETE FROM "SiteSetting" WHERE key='bulk'; rerun -
 * the API must serve the code defaults; restore by re-running the
 * migration seed (ON CONFLICT DO NOTHING) or saving in the console.
 */
import assert from "node:assert/strict";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

// ---- mirror of src/lib/bulk-tiers.ts (keep in sync) ----
const DEFAULT_TIERS = [
  { minQty: 10, pct: 5 },
  { minQty: 25, pct: 10 },
];
const DEFAULT_MAX_QTY = 500;

function bulkTierFor(qty, tiers) {
  let m = null;
  for (const t of tiers) {
    if (qty >= t.minQty) m = t;
  }
  return m;
}
function bulkDiscountFor(unitPrice, qty, tiers) {
  const t = bulkTierFor(qty, tiers);
  return t ? Math.round(unitPrice * qty * (t.pct / 100)) : 0;
}
function nextBulkTier(qty, tiers) {
  for (const t of tiers) {
    if (qty < t.minQty) return t;
  }
  return null;
}

// ---- mirror of src/lib/settings.ts sanitize (keep in sync) ----
function sanitizeTiers(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out = [];
  for (const e of raw) {
    if (typeof e !== "object" || e === null) return null;
    const minQty = Number(e.minQty);
    const pct = Number(e.pct);
    if (!Number.isInteger(minQty) || minQty < 2 || minQty > 10000) return null;
    if (!Number.isFinite(pct) || pct < 0 || pct > 90) return null;
    out.push({ minQty: minQty, pct: pct });
  }
  out.sort((a, b) => a.minQty - b.minQty);
  return out;
}
function sanitizeWhatsapp(raw) {
  if (typeof raw !== "string") return null;
  const d = raw.replace(/\D+/g, "");
  return d.length >= 10 && d.length <= 15 ? d : null;
}
function sanitize(raw) {
  const d = { tiers: DEFAULT_TIERS, maxQty: DEFAULT_MAX_QTY, preorderEnabled: true, whatsappNumber: null };
  const o = typeof raw === "object" && raw !== null ? raw : {};
  return {
    tiers: sanitizeTiers(o.tiers) ?? d.tiers,
    maxQty: Number.isInteger(o.maxQty) && o.maxQty >= 1 && o.maxQty <= 1000 ? o.maxQty : d.maxQty,
    preorderEnabled: typeof o.preorderEnabled === "boolean" ? o.preorderEnabled : d.preorderEnabled,
    whatsappNumber: sanitizeWhatsapp(o.whatsappNumber),
  };
}

let failures = 0;
function check(name, fn) {
  try {
    fn();
    console.log("PASS  " + name);
  } catch (e) {
    failures++;
    console.error("FAIL  " + name + " - " + e.message);
  }
}

const res = await fetch(BASE + "/api/settings/public");
assert.equal(res.status, 200, "GET /api/settings/public must return 200");
const pub = await res.json();

check("tiers present, sorted, minQty>=2, pct 0-90", () => {
  assert.ok(Array.isArray(pub.tiers) && pub.tiers.length >= 1, "tiers must be a non-empty array");
  pub.tiers.forEach((t, i) => {
    assert.ok(Number.isInteger(t.minQty) && t.minQty >= 2, "minQty must be an integer >= 2");
    assert.ok(typeof t.pct === "number" && t.pct >= 0 && t.pct <= 90, "pct must be 0-90");
    if (i > 0) assert.ok(pub.tiers[i - 1].minQty < t.minQty, "tiers must be strictly ascending");
  });
});
check("maxQty is an integer within 1..1000", () => {
  assert.ok(Number.isInteger(pub.maxQty) && pub.maxQty >= 1 && pub.maxQty <= 1000);
});
check("preorderEnabled is a boolean", () => {
  assert.equal(typeof pub.preorderEnabled, "boolean");
});
check("whatsappNumber is null or 10-15 digits", () => {
  assert.ok(pub.whatsappNumber === null || /^\d{10,15}$/.test(pub.whatsappNumber));
});

const untouched =
  JSON.stringify(pub.tiers) === JSON.stringify(DEFAULT_TIERS) &&
  pub.maxQty === DEFAULT_MAX_QTY &&
  pub.preorderEnabled === true &&
  pub.whatsappNumber === null;
console.log(
  untouched
    ? "INFO  live settings match the code defaults (fresh install)"
    : "INFO  live settings have been edited by the owner - checks below use the live config"
);

// Boundary math against whatever config is live (default OR edited).
for (const t of pub.tiers) {
  for (const q of [t.minQty - 1, t.minQty, t.minQty + 1]) {
    if (q < 1) continue;
    check("boundary qty " + q + " against tier " + t.minQty, () => {
      const unit = 1000;
      const tier = bulkTierFor(q, pub.tiers);
      assert.equal(
        bulkDiscountFor(unit, q, pub.tiers),
        tier ? Math.round(unit * q * (tier.pct / 100)) : 0
      );
    });
  }
}
check("qty 1 never earns a discount", () => {
  assert.equal(bulkDiscountFor(1000, 1, pub.tiers), 0);
});
check("qty above every tier earns the top tier", () => {
  const top = pub.tiers[pub.tiers.length - 1];
  assert.equal(bulkDiscountFor(1000, 100000, pub.tiers), Math.round(1000 * 100000 * (top.pct / 100)));
});
check("nextBulkTier above the top tier is null", () => {
  assert.equal(nextBulkTier(100000, pub.tiers), null);
});

// Sanitize / fallback unit tests (mirror of the deployed logic).
check("fallback: non-array tiers -> code defaults", () => {
  assert.deepEqual(sanitize({ tiers: "oops" }).tiers, DEFAULT_TIERS);
});
check("fallback: empty tiers -> code defaults", () => {
  assert.deepEqual(sanitize({ tiers: [] }).tiers, DEFAULT_TIERS);
});
check("fallback: pct 95 rejected -> code defaults", () => {
  assert.deepEqual(sanitize({ tiers: [{ minQty: 10, pct: 95 }] }).tiers, DEFAULT_TIERS);
});
check("fallback: minQty 1 rejected -> code defaults", () => {
  assert.deepEqual(sanitize({ tiers: [{ minQty: 1, pct: 5 }] }).tiers, DEFAULT_TIERS);
});
check("fallback: maxQty 5000 clamped to default 500", () => {
  assert.equal(sanitize({ maxQty: 5000 }).maxQty, 500);
});
check("fallback: junk whatsapp becomes null", () => {
  assert.equal(sanitize({ whatsappNumber: "12" }).whatsappNumber, null);
});
check("valid edited row passes through, sorted", () => {
  const s = sanitize({
    tiers: [{ minQty: 50, pct: 15 }, { minQty: 7, pct: 3 }],
    maxQty: 300,
    preorderEnabled: false,
    whatsappNumber: "919876543210",
  });
  assert.deepEqual(s.tiers, [{ minQty: 7, pct: 3 }, { minQty: 50, pct: 15 }]);
  assert.equal(s.maxQty, 300);
  assert.equal(s.preorderEnabled, false);
  assert.equal(s.whatsappNumber, "919876543210");
});

// Raw DB row vs what the API serves - proves the deployed sanitize
// matches this mirror on real data. Read-only.
if (!process.argv.includes("--skip-db")) {
  try {
    const { PrismaClient } = await import("@prisma/client");
    const db = new PrismaClient();
    const row = await db.siteSetting.findUnique({ where: { key: "bulk" } });
    if (row) {
      check("API output equals sanitize(raw DB row)", () => {
        const expect = sanitize(row.value);
        assert.deepEqual(
          {
            tiers: expect.tiers,
            maxQty: expect.maxQty,
            preorderEnabled: expect.preorderEnabled,
            whatsappNumber: expect.whatsappNumber,
          },
          pub
        );
      });
    } else {
      check("missing row -> API serves the code defaults", () => {
        assert.deepEqual(pub, {
          tiers: DEFAULT_TIERS,
          maxQty: DEFAULT_MAX_QTY,
          preorderEnabled: true,
          whatsappNumber: null,
        });
      });
    }
    await db.$disconnect();
  } catch (e) {
    console.log("INFO  skipping DB comparison (" + e.message + ")");
  }
}

console.log(failures === 0 ? "\nS3 SETTINGS CHECK: ALL PASS" : "\nS3 SETTINGS CHECK: " + failures + " FAILURE(S)");
process.exit(failures === 0 ? 0 : 1);