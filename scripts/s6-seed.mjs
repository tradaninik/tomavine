// Mission S6-A: demo data for the B2B order rails.
//
//   node scripts/s6-seed.mjs           add / refresh demo data
//   node scripts/s6-seed.mjs --remove  delete ONLY the demo rows
//
// Scope: writes ONLY rows it owns - two demo supplier nurseries,
// their demo products (with moq), four demo phones, demo RFQ leads,
// demo quotes (fixed tokens) and five demo orders covering every
// lifecycle stage. Your real products, nurseries, leads, quotes and
// orders are never touched. Idempotent: every run removes the
// previous demo rows first.
//
// Demo URLs once the local server is up (npm start):
//   http://localhost:3000/quote/demo-quote-bulk-01   <- click Accept!
//   http://localhost:3000/order/demo-order-track-1001 (PENDING)
//   http://localhost:3000/order/demo-order-track-1002 (CONFIRMED)
//   http://localhost:3000/order/demo-order-track-1003 (OUT FOR DELIVERY)
//   http://localhost:3000/order/demo-order-track-1004 (DELIVERED + confirmed)
//   http://localhost:3000/order/demo-order-track-1005 (confirm me!)
//
// NOTE: local dev and production share the same Neon database, so
// these demo rows are also visible on tomavine.in until you run
// --remove. Every demo name carries "(Demo)" so they are obvious.

import { PrismaClient } from "@prisma/client";
import { loadDbEnv } from "./lib/db-env.mjs";

loadDbEnv();
const prisma = new PrismaClient();

const SELLER1 = "+919000000101";
const SELLER2 = "+919000000102";
const BUYER1 = "+919000000201";
const BUYER2 = "+919000000202";
const DEMO_PHONES = [SELLER1, SELLER2, BUYER1, BUYER2];
const NURSERY1 = "kaveri-agri-demo";
const NURSERY2 = "godavari-bio-demo";

const REMOVE = process.argv.includes("--remove");

const now = Date.now();
const day = 24 * 60 * 60 * 1000;
const isoAt = (ms) => new Date(ms).toISOString();
const dateAt = (ms) => new Date(ms).toISOString().slice(0, 10);

async function removeDemo() {
  console.log("Removing previous demo rows (scoped - real data untouched)...");

  // Orders created by the E2E check (accepting demo-quote-bulk-02)
  // carry meta.bulk.quoteId - catch those via the demo quote ids
  // BEFORE the quotes themselves are deleted.
  const demoQuotes = await prisma.quote.findMany({
    where: { token: { startsWith: "demo-quote-" } },
    select: { id: true },
  });
  for (const q of demoQuotes) {
    await prisma.order.deleteMany({
      where: { meta: { path: ["bulk", "quoteId"], equals: q.id } },
    });
    // Orders placed before the meta-shape fix carried quoteId flat at
    // the top level of meta - same cleanup for those, so re-seeding
    // never leaves an orphan NH- order blocking the nursery deletes.
    await prisma.order.deleteMany({
      where: { meta: { path: ["quoteId"], equals: q.id } },
    });
  }

  await prisma.payment.deleteMany({
    where: { order: { code: { startsWith: "BULK-DEMO-" } } },
  });
  await prisma.order.deleteMany({
    where: { code: { startsWith: "BULK-DEMO-" } },
  });
  await prisma.quote.deleteMany({
    where: { token: { startsWith: "demo-quote-" } },
  });
  await prisma.bulkLead.deleteMany({
    where: { phone: { in: DEMO_PHONES } },
  });
  await prisma.product.deleteMany({
    where: { nursery: { slug: { in: [NURSERY1, NURSERY2] } } },
  });
  await prisma.nursery.deleteMany({
    where: { slug: { in: [NURSERY1, NURSERY2] } },
  });
  await prisma.whatsappBinding.deleteMany({
    where: { user: { phone: { in: DEMO_PHONES } } },
  });
  await prisma.auditLog.deleteMany({
    where: { actor: { phone: { in: DEMO_PHONES } } },
  });
  await prisma.user.deleteMany({
    where: { phone: { in: DEMO_PHONES } },
  });

  console.log("Demo rows removed.");
}

async function seedDemo() {
  console.log("Seeding demo users...");

  const mkUser = (phone, name, role, city, pincode) =>
    prisma.user.upsert({
      where: { phone: phone },
      update: { name: name },
      create: { phone: phone, name: name, role: role, city: city, pincode: pincode },
    });

  const seller1 = await mkUser(SELLER1, "Ramesh Reddy (Demo)", "SELLER", "Kurnool", "518001");
  const seller2 = await mkUser(SELLER2, "Lakshmi Devi (Demo)", "SELLER", "Rajahmundry", "533101");
  const buyer1 = await mkUser(BUYER1, "Green Fields Farm", "CUSTOMER", "Kurnool", "518001");
  const buyer2 = await mkUser(BUYER2, "Sri Vidya Plantations", "CUSTOMER", "Rajahmundry", "533101");

  console.log("Seeding demo supplier nurseries...");

  const kaveri = await prisma.nursery.upsert({
    where: { slug: NURSERY1 },
    update: { name: "Kaveri Agri Supplies (Demo)", status: "VERIFIED" },
    create: {
      ownerId: seller1.id,
      name: "Kaveri Agri Supplies (Demo)",
      slug: NURSERY1,
      phone: SELLER1,
      gstin: "37ABCDE1234F1Z5",
      city: "Kurnool",
      area: "Nandikotkur Road",
      pincode: "518001",
      scope: "STATE",
      bulkOk: true,
      retailOk: true,
      status: "VERIFIED",
      physVerifiedAt: new Date(),
      growArea: "12 acres of shade houses and open beds",
      ratingAvg: 4.5,
    },
  });

  const godavari = await prisma.nursery.upsert({
    where: { slug: NURSERY2 },
    update: { name: "Godavari Bio Inputs (Demo)", status: "VERIFIED" },
    create: {
      ownerId: seller2.id,
      name: "Godavari Bio Inputs (Demo)",
      slug: NURSERY2,
      phone: SELLER2,
      gstin: "36ABCDE5678F1Z2",
      city: "Rajahmundry",
      area: "Kadiyam nursery belt",
      pincode: "533101",
      scope: "STATE",
      bulkOk: true,
      retailOk: true,
      status: "VERIFIED",
      physVerifiedAt: new Date(),
      growArea: "Vermy beds and packing shed on 3 acres",
      ratingAvg: 4.4,
    },
  });

  console.log("Seeding demo B2B products (with moq)...");

  const products = [
    // Kaveri - saplings
    {
      n: kaveri, cat: "saplings", sub: "fruit",
      name: "Papaya Sapling - Red Lady (Demo)",
      bot: "Carica papaya", img: "/photos/red-lady-papaya.jpg",
      moq: 100, price: 18, mrp: 25, stock: 5000,
      badges: ["farmer-favourite", "tray-packed"],
      agri: { season: "Kharif and Rabi", daysToHarvest: 240, spacing: "1.8 m x 1.8 m", guidance: "About 340 plants per acre at this spacing. Plant at monsoon onset." },
    },
    {
      n: kaveri, cat: "saplings", sub: "vegetable",
      name: "Tomato Sapling - Arka Abha (Demo)",
      bot: "Solanum lycopersicum", img: "/photos/tomato-saplings.jpg",
      moq: 500, price: 4, mrp: 6, stock: 20000,
      badges: ["tray-packed"],
      agri: { season: "Rabi", daysToHarvest: 75, spacing: "60 cm x 75 cm", traysPerAcre: 77 },
    },
    {
      n: kaveri, cat: "saplings", sub: "fruit",
      name: "Mango Graft - Banganapalli (Demo)",
      bot: "Mangifera indica", img: "/photos/banganapalli-mango.jpg",
      moq: 50, price: 120, mrp: 160, stock: 800,
      badges: ["grafted"],
      agri: { season: "Jun-Jul", daysToHarvest: 1095, spacing: "10 m x 10 m" },
    },
    // Kaveri - inputs
    {
      n: kaveri, cat: "inputs", sub: "compost",
      name: "Vermicompost - 50 kg bag (Demo)",
      bot: null, img: "/photos/vermicompost.jpg",
      moq: 10, price: 280, mrp: 350, stock: 400,
      badges: ["organic"],
      prov: { madeAt: "Kaveri worm beds", method: "African nightcrawler earthworms" },
    },
    {
      n: kaveri, cat: "inputs", sub: "soil",
      name: "Cocopeat - 5 kg block (Demo)",
      bot: null, img: "/photos/cat-inputs.jpg",
      moq: 20, price: 165, mrp: 200, stock: 600,
      badges: ["low-salt"],
    },
    {
      n: kaveri, cat: "inputs", sub: "fertilizer",
      name: "Neem Cake Powder - 50 kg (Demo)",
      bot: null, img: "/photos/neem.jpg",
      moq: 5, price: 950, mrp: 1150, stock: 200,
      badges: ["organic"],
    },
    // Godavari - inputs + irrigation lines
    {
      n: godavari, cat: "inputs", sub: "irrigation",
      name: "Drip Irrigation Starter Kit - 1/4 acre (Demo)",
      bot: null, img: "/photos/cat-inputs.jpg",
      moq: 1, price: 3450, mrp: 4200, stock: 150,
      badges: ["kit"],
      prov: { includes: "Laterals, emitters, filter, fittings, 200 m mainline" },
    },
    {
      n: godavari, cat: "inputs", sub: "irrigation",
      name: "Inline Dripper Lateral - 16 mm x 100 m roll (Demo)",
      bot: null, img: "/photos/cat-inputs.jpg",
      moq: 4, price: 780, mrp: 950, stock: 300,
    },
    {
      n: godavari, cat: "inputs", sub: "compost",
      name: "Organic Manure FYM Blend - 50 kg (Demo)",
      bot: null, img: "/photos/cat-inputs.jpg",
      moq: 20, price: 210, mrp: 260, stock: 500,
      badges: ["organic"],
    },
    {
      n: godavari, cat: "inputs", sub: "pest",
      name: "Trichoderma Viride Bio-Fungicide - 1 kg (Demo)",
      bot: null, img: "/photos/cat-inputs.jpg",
      moq: 5, price: 320, mrp: 400, stock: 250,
      badges: ["bio-control"],
    },
  ];

  for (const p of products) {
    await prisma.product.create({
      data: {
        nurseryId: p.n.id,
        category: p.cat,
        subCategory: p.sub,
        nameEn: p.name,
        botanical: p.bot,
        image: p.img,
        badges: p.badges ?? null,
        agri: p.agri ?? null,
        provenance: p.prov ?? null,
        moq: p.moq,
        priceMin: p.price,
        mrp: p.mrp,
        stock: p.stock,
      },
    });
  }
  console.log("  " + products.length + " products");

  console.log("Seeding demo RFQ leads...");

  const leadA = await prisma.bulkLead.create({
    data: {
      qty: 5000,
      city: "Kurnool",
      company: "Green Fields Farm",
      phone: BUYER1,
      pincode: "518001",
      state: "Andhra Pradesh",
      neededBy: new Date(now + 21 * day),
      type: "RFQ",
      notes: "5,000 Red Lady papaya saplings for 6 acres near Nandikotkur. Delivery required.",
      status: "new",
    },
  });

  const leadB = await prisma.bulkLead.create({
    data: {
      qty: 40,
      city: "Rajahmundry",
      company: "Sri Vidya Plantations",
      phone: BUYER2,
      pincode: "533101",
      state: "Andhra Pradesh",
      neededBy: new Date(now + 14 * day),
      type: "RFQ",
      notes: "40 bags of 50 kg vermicompost for coconut seedling beds.",
      status: "new",
    },
  });

  const leadC = await prisma.bulkLead.create({
    data: {
      qty: 2,
      city: "Rajahmundry",
      company: "Sri Vidya Plantations",
      phone: BUYER2,
      pincode: "533101",
      state: "Andhra Pradesh",
      neededBy: new Date(now + 30 * day),
      type: "RFQ",
      notes: "Drip kit for a 1/4 acre vegetable patch plus spare laterals.",
      status: "quoted",
    },
  });

  const leadD = await prisma.bulkLead.create({
    data: {
      qty: 5000,
      city: "Kurnool",
      company: "Green Fields Farm",
      phone: BUYER1,
      pincode: "518001",
      state: "Andhra Pradesh",
      neededBy: new Date(now + 10 * day),
      type: "RFQ",
      notes: "Papaya saplings plus vermicompost, quoted together.",
      status: "quoted",
    },
  });

  console.log("Seeding demo quotes (fixed tokens)...");

  // Q1 - the one YOU accept by hand on /quote/demo-quote-bulk-01.
  await prisma.quote.create({
    data: {
      leadId: leadD.id,
      nurseryId: kaveri.id,
      amount: 101200,
      items: [
        { name: "Papaya Sapling - Red Lady (6-8 inch)", qty: 5000, unit: 18, note: "tray-packed, hardened" },
        { name: "Vermicompost - 50 kg bag", qty: 40, unit: 280, note: null },
      ],
      transport: 3500,
      total: 104700,
      validUntil: new Date(now + 7 * day),
      token: "demo-quote-bulk-01",
      note: "Rate held for 7 days. Advance 25% by UPI, balance on delivery.",
      status: "sent",
    },
  });

  // Q2 - answered by the check script (E2E proof).
  await prisma.quote.create({
    data: {
      leadId: leadC.id,
      nurseryId: godavari.id,
      amount: 10020,
      items: [
        { name: "Drip Irrigation Starter Kit - 1/4 acre", qty: 2, unit: 3450, note: "includes filter + fittings" },
        { name: "Inline Dripper Lateral - 16 mm x 100 m roll", qty: 4, unit: 780, note: null },
      ],
      transport: 1200,
      total: 11220,
      validUntil: new Date(now + 7 * day),
      token: "demo-quote-bulk-02",
      note: "Free installation guidance over WhatsApp video.",
      status: "sent",
    },
  });

  console.log("Seeding demo orders (every lifecycle stage)...");

  async function demoOrder(opts) {
    const subtotal = opts.items.reduce((s, it) => s + it.qty * it.unit, 0);
    return prisma.order.create({
      data: {
        code: opts.code,
        userId: opts.buyer.id,
        nurseryId: opts.nursery.id,
        status: opts.status,
        mode: "DELIVERY",
        subtotal: subtotal,
        deliveryFee: opts.transport,
        tax: 0,
        discount: 0,
        total: subtotal + opts.transport,
        address: {
          name: opts.buyer.name,
          phone: opts.buyer.phone,
          city: opts.city,
          pincode: opts.pincode,
          state: "Andhra Pradesh",
        },
        trackToken: opts.trackToken,
        deliveryOtp: opts.deliveryOtp ?? null,
        meta: {
          bulk: {
            source: "quote",
            quoteId: null,
            leadId: null,
            items: opts.items,
            quoteNote: opts.quoteNote ?? null,
          },
          ...(opts.metaExtra ?? {}),
        },
        createdAt: opts.createdAt,
        events: { create: opts.events },
      },
    });
  }

  // 1001 - PENDING: order request just placed, awaiting supplier.
  await demoOrder({
    code: "BULK-DEMO-1001",
    trackToken: "demo-order-track-1001",
    buyer: buyer2,
    nursery: kaveri,
    status: "PENDING",
    city: "Rajahmundry",
    pincode: "533101",
    transport: 3000,
    items: [{ name: "Tomato Sapling - Arka Abha", qty: 5000, unit: 4, note: "two staggered batches" }],
    quoteNote: "Split dispatch 2,500 + 2,500 one week apart.",
    createdAt: new Date(now - 6 * 60 * 60 * 1000),
    events: [
      {
        status: "PENDING",
        note: "Order request placed from quotation DEMOQ002",
        actorRole: "CUSTOMER",
        createdAt: new Date(now - 6 * 60 * 60 * 1000),
      },
    ],
  });

  // 1002 - CONFIRMED: supplier accepted with a promised date.
  const t2 = now - 2 * day;
  await demoOrder({
    code: "BULK-DEMO-1002",
    trackToken: "demo-order-track-1002",
    buyer: buyer2,
    nursery: godavari,
    status: "CONFIRMED",
    city: "Rajahmundry",
    pincode: "533101",
    transport: 2800,
    items: [
      { name: "Vermicompost - 50 kg bag", qty: 60, unit: 280, note: null },
      { name: "Cocopeat - 5 kg block", qty: 100, unit: 165, note: "low-salt grade" },
    ],
    quoteNote: "Advance received by UPI. Balance at delivery.",
    createdAt: new Date(t2 - 4 * 60 * 60 * 1000),
    metaExtra: { promisedDate: dateAt(t2 + 3 * day), promisedAt: isoAt(t2) },
    events: [
      {
        status: "PENDING",
        note: "Order request placed from quotation DEMOQ003",
        actorRole: "CUSTOMER",
        createdAt: new Date(t2 - 4 * 60 * 60 * 1000),
      },
      {
        status: "CONFIRMED",
        note: "Order accepted by seller",
        actorRole: "SELLER",
        createdAt: new Date(t2),
      },
    ],
  });

  // 1003 - OUT FOR DELIVERY: truck on the road, PIN issued.
  const t3 = now - 4 * day;
  await demoOrder({
    code: "BULK-DEMO-1003",
    trackToken: "demo-order-track-1003",
    buyer: buyer1,
    nursery: kaveri,
    status: "OUT_FOR_DELIVERY",
    city: "Kurnool",
    pincode: "518001",
    transport: 2200,
    deliveryOtp: "4821",
    items: [{ name: "Mango Graft - Banganapalli", qty: 200, unit: 120, note: "balled and burlapped" }],
    quoteNote: "Grafts dispatched in a ventilated tempo.",
    createdAt: new Date(t3 - 2 * day),
    metaExtra: { promisedDate: dateAt(t3 + 2 * day), promisedAt: isoAt(t3 - 2 * day + 3 * 60 * 60 * 1000) },
    events: [
      {
        status: "PENDING",
        note: "Order request placed from quotation DEMOQ004",
        actorRole: "CUSTOMER",
        createdAt: new Date(t3 - 2 * day),
      },
      {
        status: "CONFIRMED",
        note: "Order accepted by seller",
        actorRole: "SELLER",
        createdAt: new Date(t3 - 2 * day + 3 * 60 * 60 * 1000),
      },
      {
        status: "PREPARING",
        note: "Being prepared",
        actorRole: "SELLER",
        createdAt: new Date(t3 - 1 * day),
      },
      {
        status: "OUT_FOR_DELIVERY",
        note: "Truck AP 16 TV 2345 loaded - driver Suresh +91 90000 12345, ETA 2 days",
        actorRole: "SELLER",
        createdAt: new Date(t3),
      },
    ],
  });

  // 1004 - DELIVERED + buyer confirmed: the completed happy path.
  const t4 = now - 6 * day;
  await demoOrder({
    code: "BULK-DEMO-1004",
    trackToken: "demo-order-track-1004",
    buyer: buyer2,
    nursery: kaveri,
    status: "DELIVERED",
    city: "Rajahmundry",
    pincode: "533101",
    transport: 4000,
    items: [
      { name: "Papaya Sapling - Red Lady", qty: 3000, unit: 18, note: null },
      { name: "Neem Cake Powder - 50 kg", qty: 20, unit: 950, note: null },
    ],
    quoteNote: "Delivered in one trip, unloaded with buyer's labour.",
    createdAt: new Date(t4),
    metaExtra: {
      promisedDate: dateAt(t4 + 3 * day),
      promisedAt: isoAt(t4 + 3 * 60 * 60 * 1000),
      deliveredAt: isoAt(t4 + 3 * day - 2 * 60 * 60 * 1000),
      onTime: true,
      buyerConfirmedAt: isoAt(t4 + 3 * day),
    },
    events: [
      { status: "PENDING", note: "Order request placed from quotation DEMOQ005", actorRole: "CUSTOMER", createdAt: new Date(t4) },
      { status: "CONFIRMED", note: "Order accepted by seller", actorRole: "SELLER", createdAt: new Date(t4 + 3 * 60 * 60 * 1000) },
      { status: "PREPARING", note: "Being prepared", actorRole: "SELLER", createdAt: new Date(t4 + 1 * day) },
      { status: "OUT_FOR_DELIVERY", note: "Truck AP 21 BX 7788 dispatched - driver Naresh +91 90000 54321", actorRole: "SELLER", createdAt: new Date(t4 + 2 * day) },
      { status: "DELIVERED", note: "Delivered", actorRole: "SELLER", createdAt: new Date(t4 + 3 * day - 2 * 60 * 60 * 1000) },
      { status: "DELIVERED", note: "Buyer confirmed receipt on the platform", actorRole: "CUSTOMER", createdAt: new Date(t4 + 3 * day) },
    ],
  });

  // 1005 - OUT FOR DELIVERY, deliberately unconfirmed: the check
  // script (and you) press "I have received this order" on it.
  const t5 = now - 1 * day;
  await demoOrder({
    code: "BULK-DEMO-1005",
    trackToken: "demo-order-track-1005",
    buyer: buyer1,
    nursery: godavari,
    status: "OUT_FOR_DELIVERY",
    city: "Kurnool",
    pincode: "518001",
    transport: 1500,
    deliveryOtp: "7309",
    items: [{ name: "Organic Manure FYM Blend - 50 kg", qty: 40, unit: 210, note: null }],
    quoteNote: null,
    createdAt: new Date(t5 - 6 * 60 * 60 * 1000),
    metaExtra: { promisedDate: dateAt(t5 + 1 * day), promisedAt: isoAt(t5 - 6 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000) },
    events: [
      { status: "PENDING", note: "Order request placed from quotation DEMOQ006", actorRole: "CUSTOMER", createdAt: new Date(t5 - 6 * 60 * 60 * 1000) },
      { status: "CONFIRMED", note: "Order accepted by seller", actorRole: "SELLER", createdAt: new Date(t5 - 4 * 60 * 60 * 1000) },
      { status: "OUT_FOR_DELIVERY", note: "Tempo AP 28 CV 1122 loaded - driver Kiran +91 90000 99887", actorRole: "SELLER", createdAt: new Date(t5) },
    ],
  });

  console.log("");
  console.log("Demo data seeded. Try these (server must be running):");
  console.log("  /quote/demo-quote-bulk-01      <- open and click ACCEPT (places a real order request)");
  console.log("  /order/demo-order-track-1001   <- PENDING order request");
  console.log("  /order/demo-order-track-1002   <- CONFIRMED with promised date");
  console.log("  /order/demo-order-track-1003   <- OUT FOR DELIVERY, truck note + PIN");
  console.log("  /order/demo-order-track-1004   <- DELIVERED + buyer confirmed");
  console.log("  /order/demo-order-track-1005   <- OUT FOR DELIVERY, press 'I have received this order'");
  console.log("");
  console.log("Seller console: log in as " + SELLER1 + " (OTP) - the demo orders appear");
  console.log("under Orders with their lines, timeline and tracking link.");
  console.log("");
  console.log("Remove everything later: node scripts/s6-seed.mjs --remove");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

async function main() {
  await removeDemo();
  if (!REMOVE) {
    await seedDemo();
  }
}