import Link from "next/link";

const CATEGORIES = [
  {
    emoji: "🌾",
    title: "Farmer saplings",
    text: "Tray-packed vegetable seedlings with per-acre guidance, straight from verified growers.",
  },
  {
    emoji: "🪴",
    title: "Plants",
    text: "Flowering, foliage and fruiting plants for homes, offices and landscapes.",
  },
  {
    emoji: "🧪",
    title: "Organic inputs",
    text: "Jeevamrutam, vermicompost and natural pest care for living soil.",
  },
  {
    emoji: "🏺",
    title: "Pots & tools",
    text: "Terracotta, grow bags and hand tools that last seasons.",
  },
  {
    emoji: "🗓️",
    title: "Care subscriptions",
    text: "Monthly garden-care visits from nursery teams near you.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#F7F3E8]">
      <header className="bg-[#1C3A2A] text-[#F7F3E8]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <span className="text-lg font-bold">🌱 Tomavine</span>
          <Link
            href="/login"
            className="rounded-xl bg-[#2F6B3F] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#255732]"
          >
            Login
          </Link>
        </div>
      </header>

      <main>
        <section className="bg-[#1C3A2A] px-4 py-20 text-center text-[#F7F3E8]">
          <h1 className="mx-auto max-w-3xl text-4xl font-bold sm:text-5xl">Where growers meet gardens</h1>
          <p className="mx-auto mt-4 max-w-xl text-[#F7F3E8]/70">
            India&apos;s marketplace for nursery plants, farmer saplings and organic garden care — from physically
            verified nurseries to your doorstep.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/login"
              className="rounded-xl bg-[#2F6B3F] px-6 py-3 font-semibold text-white transition hover:bg-[#255732]"
            >
              Get started
            </Link>
            <Link
              href="/login"
              className="rounded-xl border border-[#F7F3E8]/30 px-6 py-3 font-semibold transition hover:bg-white/10"
            >
              I&apos;m a nursery
            </Link>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-2xl font-bold text-[#1C3A2A]">Everything a garden needs</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CATEGORIES.map((c) => (
              <div
                key={c.title}
                className="rounded-2xl border border-[#1C3A2A]/10 bg-white p-6 shadow-sm"
              >
                <p className="text-3xl">{c.emoji}</p>
                <h3 className="mt-3 font-semibold text-[#1C3A2A]">{c.title}</h3>
                <p className="mt-2 text-sm text-[#1C3A2A]/70">{c.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white px-4 py-16">
          <div className="mx-auto max-w-6xl rounded-3xl bg-[#2F6B3F]/10 p-10 text-center">
            <h2 className="text-2xl font-bold text-[#1C3A2A]">Selling? Run your whole nursery from WhatsApp.</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-[#1C3A2A]/70">
              New orders arrive as WhatsApp alerts. Reply 1 to accept, 2 to reject — and track everything in the
              seller dashboard.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-block rounded-xl bg-[#2F6B3F] px-6 py-3 font-semibold text-white transition hover:bg-[#255732]"
            >
              Nursery login
            </Link>
          </div>
        </section>
      </main>

      <footer className="bg-[#1C3A2A] px-4 py-8 text-center text-sm text-[#F7F3E8]/60">
        Tomavine · Where growers meet gardens
      </footer>
    </div>
  );
}