import { db } from "@/lib/db";
import { getSession } from "@/lib/security";

export async function requireNursery() {
  const session = await getSession();

  if (!session) {
    return null;
  }

  if (session.payload.role !== "SELLER") {
    return null;
  }

  const userId = session.payload.sub;

  if (!userId) {
    return null;
  }

  const nursery = await db.nursery.findUnique({
    where: {
      ownerId: userId,
    },
  });

  if (!nursery) {
    return null;
  }

  return { session, nursery };
}