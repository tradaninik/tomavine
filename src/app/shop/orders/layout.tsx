import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getSession } from "@/lib/security";

export default async function OrdersLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return <>{children}</>;
}