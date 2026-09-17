import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/security";
import Nav from "./nav";

export default async function SellerLayout({ children }: { children: ReactNode }) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (session.payload.role === "CUSTOMER") {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-[#F7F3E8]">
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}