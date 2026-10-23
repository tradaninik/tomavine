import { PrismaClient } from "@prisma/client";

// ─────────────────────────────────────────────────────────────
// EDIT THESE THREE PHONE NUMBERS BEFORE RUNNING `npm run seed`
// Format: +91 followed by 10 digits. Use real test numbers.
// ─────────────────────────────────────────────────────────────
const ADMIN_PHONE = "+916281456004";
const SELLER_PHONE = "+919030984021";
const BUYER_PHONE = "+919704699511";
// ─────────────────────────────────────────────────────────────

const prisma = new PrismaClient();

async function main() {
  console.log("Clearing old data…");

  await prisma.quote.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.bulkLead.deleteMany();
  await prisma.review.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderEvent.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.whatsappBinding.deleteMany();
  await prisma.whatsappLog.deleteMany();
  await prisma.plantJournal.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.rescueListing.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.serviceListing.deleteMany();
  await prisma.nursery.deleteMany();
  await prisma.user.deleteMany();
  await prisma.otpCode.deleteMany();

  console.log("Creating users…");

  const admin = await prisma.user.create({
    data: {
      phone: ADMIN_PHONE,
      name: "Tomavine Admin",
      role: "SUPER_ADMIN",
      city: "Bengaluru",
    },
  });

  const seller = await prisma.user.create({
    data: {
      phone: SELLER_PHONE,
      name: "Ravi Kumar",
      role: "SELLER",
      city: "Bengaluru",
      pincode: "560088",
    },
  });

  const buyer = await prisma.user.create({
    data: {
      phone: BUYER_PHONE,
      name: "Meera Test",
      role: "CUSTOMER",
      city: "Bengaluru",
      pincode: "560103",
    },
  });

  console.log("Creating nursery…");

  const nursery = await prisma.nursery.create({
    data: {
      ownerId: seller.id,
      name: "Green Leaf Nurseries",
      slug: "green-leaf",
      phone: SELLER_PHONE,
      gstin: "29ABCDE1234F1Z5",
      city: "Bengaluru",
      area: "Hesaraghatta Road",
      pincode: "560088",
      scope: "RADIUS",
      scopeKm: 15,
      bulkOk: true,
      retailOk: true,
      status: "VERIFIED",
      physVerifiedAt: new Date(),
      growArea: "2 acres of shade houses",
      image: "/photos/nursery-green-leaf.jpg",
      ratingAvg: 4.6,
    },
  });

  console.log("Creating products…");

  const chilli = await prisma.product.create({
    data: {
      nurseryId: nursery.id,
      category: "saplings",
      nameEn: "Chilli Saplings — Guntur Sannam",
      names: { te: "Mirapakaya", kn: "Menasinakayi", hi: "Mirch" },
      botanical: "Capsicum annuum",
      image: "/photos/chilli-saplings.jpg",
      badges: ["farmer-favourite", "tray-packed"],
      care: { sun: "Full sun", water: "Keep trays moist, water daily" },
      agri: {
        season: "Kharif and Rabi",
        spacing: "45 cm x 60 cm",
        plantsPerAcre: 10000,
        traysPerAcre: 96,
        daysToTransplant: 30,
        guidance: "About 96 trays of 104 cells per acre. Harden seedlings for 5 days before transplanting.",
      },
      provenance: { grownAt: "Hesaraghatta shade houses", seedSource: "Local saved seed" },
      priceMin: 5,
      mrp: 1300,
      stock: 480,
      variants: {
        create: [
          { label: "Tray of 104 seedlings", price: 260, sku: "CHILLI-TRAY-104" },
          { label: "Pack of 520 (5 trays)", price: 1200, sku: "CHILLI-PACK-520" },
          { label: "Single seedling", price: 5, sku: "CHILLI-SINGLE-1" },
        ],
      },
    },
    include: { variants: true },
  });

  const chilliTray = chilli.variants.find((v) => v.sku === "CHILLI-TRAY-104");

  if (!chilliTray) {
    throw new Error("Chilli tray variant missing — seed failed");
  }

  await prisma.product.create({
    data: {
      nurseryId: nursery.id,
      category: "saplings",
      nameEn: "Tomato Saplings — Arka Abha",
      botanical: "Solanum lycopersicum",
      image: "/photos/tomato-saplings.jpg",
      agri: {
        season: "Rabi",
        spacing: "60 cm x 75 cm",
        plantsPerAcre: 8000,
        traysPerAcre: 77,
        daysToTransplant: 25,
        guidance: "Stake plants three weeks after transplanting.",
      },
      priceMin: 240,
      mrp: 280,
      stock: 180,
      variants: {
        create: [{ label: "Tray of 104 seedlings", price: 240, sku: "TOMATO-TRAY-104" }],
      },
    },
  });

  await prisma.product.create({
    data: {
      nurseryId: nursery.id,
      category: "plants",
      nameEn: "Curry Leaf Plant",
      names: { kn: "Karuveppu", ta: "Karuvempu", hi: "Kadi Patta" },
      botanical: "Murraya koenigii",
      image: "/photos/curry-leaf.jpg",
      care: { sun: "Partial to full sun", water: "Every 2 days", soil: "Well-drained" },
      priceMin: 149,
      mrp: 199,
      stock: 40,
    },
  });

  await prisma.product.create({
    data: {
      nurseryId: nursery.id,
      category: "plants",
      nameEn: "Jade Plant",
      botanical: "Crassula ovata",
      image: "/photos/jade-plant.jpg",
      badges: ["easy-care"],
      care: { sun: "Bright indirect light", water: "Every 7 to 10 days", soil: "Succulent mix" },
      priceMin: 199,
      mrp: 299,
      stock: 25,
      rescue: {
        create: {
          pct: 40,
          expiresAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        },
      },
    },
  });

  await prisma.product.create({
    data: {
      nurseryId: nursery.id,
      category: "plants",
      nameEn: "Areca Palm",
      botanical: "Dypsis lutescens",
      image: "/photos/areca-palm.jpg",
      care: { sun: "Indirect light", water: "Every 3 days", soil: "Loamy, well-drained" },
      priceMin: 399,
      mrp: 499,
      stock: 30,
    },
  });

  const vermicompost = await prisma.product.create({
    data: {
      nurseryId: nursery.id,
      category: "inputs",
      nameEn: "Vermicompost — 10 kg",
      names: { hi: "Kechuwa Khaad" },
      image: "/photos/vermicompost.jpg",
      badges: ["organic"],
      provenance: { madeAt: "Green Leaf worm beds", method: "African nightcrawler earthworms" },
      priceMin: 299,
      mrp: 349,
      stock: 55,
    },
  });

  await prisma.product.create({
    data: {
      nurseryId: nursery.id,
      category: "inputs",
      nameEn: "Jeevamrutam — 5 Litre",
      names: { te: "Jeevamrutam", kn: "Jeevamrutha" },
      image: "/photos/jeevamrutam.jpg",
      badges: ["organic"],
      provenance: { madeAt: "Green Leaf farm", fermentedDays: 7 },
      priceMin: 249,
      mrp: 299,
      stock: 60,
    },
  });

  await prisma.product.create({
    data: {
      nurseryId: nursery.id,
      category: "pots",
      nameEn: "Terracotta Grow Pot — 10 inch",
      image: "/photos/terracotta-pot.jpg",
      priceMin: 219,
      mrp: 260,
      stock: 80,
    },
  });

  await prisma.product.create({
    data: {
      nurseryId: nursery.id,
      category: "tools",
      nameEn: "Garden Hand Tool Set — 5 pieces",
      image: "/photos/tool-set.jpg",
      priceMin: 499,
      mrp: 599,
      stock: 35,
    },
  });

  console.log("Creating bulk lead…");

  await prisma.bulkLead.create({
    data: {
      productId: chilli.id,
      qty: 5000,
      city: "Bengaluru",
      company: "Sunrise Agro Farms",
      notes: "Need 5,000 chilli seedlings for 5 acres near Hosur. Delivery required.",
      status: "new",
    },
  });

  console.log("Creating test order…");

  const order = await prisma.order.create({
    data: {
      code: "NH-2025-1810",
      userId: buyer.id,
      nurseryId: nursery.id,
      status: "PENDING",
      mode: "DELIVERY",
      subtotal: 819,
      deliveryFee: 25,
      tax: 80,
      discount: 0,
      total: 924,
      address: {
        name: "Meera Test",
        phone: BUYER_PHONE,
        line1: "12, 4th Cross, Whitefield",
        city: "Bengaluru",
        pincode: "560103",
      },
      meta: { cod: true },
      items: {
        create: [
          {
            productId: chilli.id,
            variantId: chilliTray.id,
            qty: 2,
            unitPrice: 260,
            nameSnap: "Chilli Saplings — Guntur Sannam",
            vlabel: "Tray of 104 seedlings",
          },
          {
            productId: vermicompost.id,
            variantId: null,
            qty: 1,
            unitPrice: 299,
            nameSnap: "Vermicompost — 10 kg",
          },
        ],
      },
      events: {
        create: [{ status: "PENDING", note: "Order placed (seed data)", actorRole: "CUSTOMER" }],
      },
      payment: {
        create: { provider: "cod", method: "cod", amount: 924, status: "CREATED" },
      },
    },
  });

  await prisma.whatsappBinding.create({
    data: {
      userId: seller.id,
      waId: SELLER_PHONE,
      lastAlertOrderId: order.id,
    },
  });

  console.log("");
  console.log("Seed complete.");
  console.log("");
  console.log("  Seller login phone : " + SELLER_PHONE);
  console.log("  Buyer login phone  : " + BUYER_PHONE);
  console.log("  Super admin login  : " + admin.phone);
  console.log("  Test order         : NH-2025-1810 (COD, PENDING, total ₹924)");
  console.log("");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });