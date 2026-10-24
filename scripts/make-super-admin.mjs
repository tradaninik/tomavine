import { PrismaClient } from "@prisma/client";
import { loadDbEnv } from "./lib/db-env.mjs";

// Shared loader: .env wins over a stray non-postgres shell
// DATABASE_URL, and prints which database is in effect.
// (Previously: existing process env vars always won, so a stray
// libsql:// URL silently overrode .env.)
loadDbEnv();

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────
// One-time founder promotion — Batch 4a, Wave 4.
//
//   node scripts/make-super-admin.mjs                 → promotes the founder
//   node scripts/make-super-admin.mjs +91XXXXXXXXXX   → promotes that number
//
// Writes the change straight to the database (same Neon DB the
// live site uses) and records an AuditLog entry. The role is
// baked into the login cookie at sign-in, so after running this:
// LOG OUT of the site, then log back in.
//
// From then on, role/scope changes for everyone else happen in
// /admin/users — this script is the one-time bootstrap only.
// ─────────────────────────────────────────────────────────────

const PHONE = process.argv[2] ?? "+916281456004";

if (!/^\+91\d{10}$/.test(PHONE)) {
  console.error("Phone must look like +91XXXXXXXXXX — got: " + PHONE);
  process.exit(1);
}

async function main() {
  const user = await prisma.user.findUnique({ where: { phone: PHONE } });
  if (!user) {
    console.error("No user found with phone " + PHONE + " — nothing changed.");
    process.exit(1);
  }
  if (user.role === "SUPER_ADMIN") {
    console.log((user.name ?? user.phone) + " is already SUPER_ADMIN — nothing to do.");
    return;
  }
  console.log("Found: " + (user.name ?? user.phone) + " · current role: " + user.role);
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { role: "SUPER_ADMIN" },
  });
  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "user.promote",
      entity: "User:" + user.id,
      meta: { phone: PHONE, from: user.role, to: "SUPER_ADMIN", via: "make-super-admin.mjs" },
    },
  });
  console.log("✓ Promoted to SUPER_ADMIN: " + (updated.name ?? updated.phone));
  console.log("");
  console.log("IMPORTANT: the role is baked into your cookie at sign-in.");
  console.log("Log OUT of the site, then log back in — the Users tab");
  console.log("then appears in the admin panel and /admin/users opens for you.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });