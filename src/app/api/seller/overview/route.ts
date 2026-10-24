import { NextResponse } from "next/server";
import { OrderStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireNursery } from "@/lib/seller";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function startOfTodayIst() {
  const now = new Date();
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - IST_OFFSET_MS);
}

function startOfMonthIst() {
  const now = new Date();
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1) - IST_OFFSET_MS);
}

export async function GET() {
  const auth = await requireNursery();

  if (!auth) {
    return NextResponse.json({ error: "Seller login required" }, { status: 401 });
  }

  const { nursery } = auth;

  const revenueStatuses = [
    OrderStatus.CONFIRMED,
    OrderStatus.PREPARING,
    OrderStatus.OUT_FOR_DELIVERY,
    OrderStatus.DELIVERED,
  ];

  const [todayAgg, monthAgg, pendingCount, subscriptionsCount, lowStock, recentOrders, locationsCount] = await Promise.all([
    db.order.aggregate({
      _sum: { total: true },
      where: {
        nurseryId: nursery.id,
        status: { in: revenueStatuses },
        createdAt: { gte: startOfTodayIst() },
      },
    }),
    db.order.aggregate({
      _sum: { total: true },
      where: {
        nurseryId: nursery.id,
        status: { in: revenueStatuses },
        createdAt: { gte: startOfMonthIst() },
      },
    }),
    db.order.count({
      where: { nurseryId: nursery.id, status: OrderStatus.PENDING },
    }),
    db.subscription.count({
      where: { status: "active", service: { nurseryId: nursery.id } },
    }),
    db.product.findMany({
      where: { nurseryId: nursery.id, hidden: false, stock: { lte: 10 } },
      orderBy: { stock: "asc" },
      take: 5,
      select: { id: true, nameEn: true, stock: true, category: true },
    }),
    db.order.findMany({
      where: { nurseryId: nursery.id },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        code: true,
        status: true,
        total: true,
        createdAt: true,
        user: { select: { name: true, phone: true } },
      },
    }),
    db.nurseryServiceArea.count({ where: { nurseryId: nursery.id } }),
  ]);

  // Mission F: the overview also carries the franchise switchboard
  // state (raw features JSON — readNurseryFeatures on the client) and
  // the service-area count, so the seller console can show the nursery
  // admin exactly what the super admin has enabled for them.
  return NextResponse.json({
    nurseryName: nursery.name,
    todayRevenue: todayAgg._sum.total ?? 0,
    monthRevenue: monthAgg._sum.total ?? 0,
    pendingOrders: pendingCount,
    activeSubscriptions: subscriptionsCount,
    locationsCount: locationsCount,
    features: nursery.features,
    lowStock: lowStock,
    recentOrders: recentOrders,
  });
}