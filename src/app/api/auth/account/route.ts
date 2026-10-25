import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/security";

// POST /api/auth/account — self-service account deletion (Mission PC,
// the Google Play account-deletion requirement for apps with accounts).
//
// Only CUSTOMER accounts: seller/admin accounts carry nursery and staff
// references that must never be orphaned from a customer-facing button —
// those are offboarded by the super admin instead (403 here).
//
// We ANONYMIZE rather than hard-DELETE: order, review and audit rows
// stay behind for statutory retention (tax/dispute windows — disclosed
// in the privacy policy), but every piece of account PII is wiped:
// name, city, pincode and the WhatsApp binding go now, and the phone
// number is tombstoned to "deleted:<id>" — unique-safe, never matches
// the OTP format, can never receive a login again.
//
// /api/auth/me treats a tombstoned row as logged-out, so a lingering
// JWT dies at the next /me poll; the client also calls logout right
// after this succeeds.
export async function POST() {
  const session = await getSession();
  if (!session || !session.payload.sub) {
    return NextResponse.json({ error: "login_required" }, { status: 401 });
  }
  const userId = session.payload.sub;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
  if (!user) {
    return NextResponse.json({ error: "login_required" }, { status: 401 });
  }
  if (user.role !== "CUSTOMER") {
    return NextResponse.json(
      { error: "Seller and staff accounts are offboarded by Tomavine — contact support." },
      { status: 403 },
    );
  }

  await db.$transaction([
    db.whatsappBinding.deleteMany({ where: { userId } }),
    db.user.update({
      where: { id: userId },
      data: {
        phone: `deleted:${userId}`,
        name: null,
        city: null,
        pincode: null,
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
