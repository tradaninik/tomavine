// ----------------------------------------------------------------
// Demo account registry - mission DEMO-1.
//
// Email/password accounts for role + region walkthroughs: super
// admin, a scoped staff admin, the two S6-A demo nursery owners and
// four buyers. The registry lives in code (not the DB) so the set
// is versioned and exact; /api/auth/demo upserts the rows on first
// sign-in and heals profile drift on every later one.
//
// Gate: the whole surface is OFF unless DEMO_LOGIN=1 is set in the
// environment (Vercel -> Settings -> Environment Variables). Unset,
// the route 404s and the login page never renders the demo tab.
// The password is demo1234 - acceptable for a gated demo, never
// for an ungated production deployment.
//
// Phones: the owner/buyer accounts REUSE the S6-A seed phones
// (+91 90000 001xx / 002xx) so they arrive attached to the seeded
// nurseries, RFQ leads and orders. The admin/staff/extra-buyer
// accounts sit in the +91 000000000x block - regex-valid for the
// OTP plumbing, but not a real allocatable Indian mobile range, so
// nobody can OTP their way into the demo super admin and those
// accounts can never receive a real WhatsApp message.
// ----------------------------------------------------------------

export const DEMO_PASSWORD = "demo1234";

export type DemoRole = "SUPER_ADMIN" | "ADMIN" | "SELLER" | "CUSTOMER";

export type DemoUser = {
  email: string;
  phone: string;
  name: string;
  role: DemoRole;
  note: string;
  city?: string;
  pincode?: string;
  // ADMIN only: the exact scope list written to User.permissions.
  // undefined = never managed (full access) - only the staff demo
  // carries a list, so the permission system itself is on show.
  permissions?: string[];
  // SELLER only: nursery slug this account must own after sign-in
  // (self-healing - reassigned only if the link drifted).
  nurserySlug?: string;
};

export const DEMO_USERS: DemoUser[] = [
  {
    email: "admin@tomavine.dev",
    phone: "+910000000001",
    name: "Demo Super Admin",
    role: "SUPER_ADMIN",
    note: "Super admin - full console, users + permissions",
    city: "Hyderabad",
    pincode: "500081",
  },
  {
    email: "staff@tomavine.dev",
    phone: "+910000000002",
    name: "Demo Staff Admin",
    role: "ADMIN",
    note: "Staff admin - nurseries + orders scopes only",
    city: "Hyderabad",
    pincode: "500081",
    permissions: ["nurseries", "orders"],
  },
  {
    email: "owner1@tomavine.dev",
    phone: "+919000000101",
    name: "Ramesh Reddy (Demo)",
    role: "SELLER",
    note: "Nursery owner - Kaveri Agri Supplies (Demo), Kurnool",
    city: "Kurnool",
    pincode: "518001",
    nurserySlug: "kaveri-agri-demo",
  },
  {
    email: "owner2@tomavine.dev",
    phone: "+919000000102",
    name: "Lakshmi Devi (Demo)",
    role: "SELLER",
    note: "Nursery owner - Godavari Bio Inputs (Demo), Rajahmundry",
    city: "Rajahmundry",
    pincode: "533101",
    nurserySlug: "godavari-bio-demo",
  },
  {
    email: "buyer1@tomavine.dev",
    phone: "+919000000201",
    name: "Green Fields Farm",
    role: "CUSTOMER",
    note: "Farm buyer - Kurnool, AP - seeded orders + RFQs",
    city: "Kurnool",
    pincode: "518001",
  },
  {
    email: "buyer2@tomavine.dev",
    phone: "+919000000202",
    name: "Sri Vidya Plantations",
    role: "CUSTOMER",
    note: "Plantation buyer - Rajahmundry, AP - seeded RFQs",
    city: "Rajahmundry",
    pincode: "533101",
  },
  {
    email: "buyer3@tomavine.dev",
    phone: "+910000000003",
    name: "Demo Buyer Hyderabad",
    role: "CUSTOMER",
    note: "Customer - Hyderabad, TG - clean account",
    city: "Hyderabad",
    pincode: "500081",
  },
  {
    email: "buyer4@tomavine.dev",
    phone: "+910000000004",
    name: "Demo Buyer Bengaluru",
    role: "CUSTOMER",
    note: "Customer - Bengaluru, KN - out-of-region edge case",
    city: "Bengaluru",
    pincode: "560001",
  },
];

// Case-insensitive email lookup (registry emails are lowercase).
export function demoUserByEmail(email: string): DemoUser | undefined {
  const key = email.trim().toLowerCase();
  return DEMO_USERS.find((u) => u.email === key);
}
