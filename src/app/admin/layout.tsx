import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Fraunces, Karla } from "next/font/google";
import { AdminNav } from "./ui";
import { getSession } from "@/lib/security";
import { isAdminRole } from "@/lib/permissions";

const display = Fraunces({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-display" });
const body = Karla({ subsets: ["latin"], variable: "--font-body" });

export const metadata = {
  title: "Tomavine Admin",
  description: "Nursery verification, orders oversight and audit log.",
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  if (!isAdminRole(String(session.payload.role))) {
    redirect("/");
  }
  return (
    <div
      className={`${display.variable} ${body.variable} flex min-h-screen flex-col bg-[#F7F3E8] lg:flex-row`}
      style={{ fontFamily: "var(--font-body), system-ui, sans-serif" }}
    >
      <AdminNav />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
        <footer className="bg-[#1C3A2A] px-4 py-6 text-center text-xs text-[#F7F3E8]/50">
          Tomavine Admin · Where growers meet gardens
        </footer>
      </div>
    </div>
  );
}