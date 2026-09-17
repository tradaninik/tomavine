"use client";

import { useCallback, useEffect, useState } from "react";
import { Btn, Card, Pill } from "../ui";

type Review = {
  id: string;
  stars: number;
  text: string;
  reply: string | null;
  createdAt: string;
  product: { nameEn: string };
  user: { name: string | null; phone: string };
};

export default function SellerReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const res = await fetch("/api/seller/reviews");

      if (!res.ok) throw new Error("failed");

      const data = await res.json();
      setReviews(data.reviews);
      setError("");
    } catch {
      setError("Could not load reviews.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function saveReply(review: Review) {
    const reply = (replies[review.id] ?? review.reply ?? "").trim();

    if (reply.length < 1) {
      setError("Write a reply first.");
      return;
    }

    setBusyId(review.id);
    setError("");

    try {
      const res = await fetch("/api/seller/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId: review.id, reply: reply }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Could not save reply");
      }

      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save reply");
    } finally {
      setBusyId(null);
    }
  }

  if (loading && reviews.length === 0) {
    return <p className="text-[#1C3A2A]/60">Loading…</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-[#1C3A2A]">Reviews</h1>

      {error ? <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p> : null}

      {reviews.length === 0 ? (
        <p className="text-[#1C3A2A]/60">No reviews yet. They will appear here once customers review your products.</p>
      ) : null}

      {reviews.map((r) => {
        const busy = busyId === r.id;

        return (
          <Card key={r.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-bold text-[#1C3A2A]">{r.product.nameEn}</p>
                <p className="text-xs text-[#1C3A2A]/50">
                  {r.user.name ?? r.user.phone} · {new Date(r.createdAt).toLocaleDateString("en-IN")}
                </p>
              </div>
              <span className="text-amber-500">
                {"★".repeat(r.stars)}
                {"☆".repeat(5 - r.stars)}
              </span>
            </div>

            <p className="mt-3 text-sm text-[#1C3A2A]/80">{r.text}</p>

            {r.reply ? (
              <div className="mt-3 rounded-xl bg-[#2F6B3F]/10 px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#2F6B3F]">Your reply</p>
                <p className="mt-1 text-sm text-[#1C3A2A]/80">{r.reply}</p>
              </div>
            ) : null}

            <div className="mt-3">
              <textarea
                className="w-full rounded-xl border border-[#1C3A2A]/20 bg-white px-3 py-2 text-sm"
                rows={3}
                placeholder={r.reply ? "Update your reply…" : "Write a public reply…"}
                value={replies[r.id] ?? r.reply ?? ""}
                onChange={(e) => setReplies({ ...replies, [r.id]: e.target.value })}
              />
              <div className="mt-2">
                <Btn onClick={() => saveReply(r)} disabled={busy}>
                  {busy ? "Saving…" : r.reply ? "Update reply" : "Post reply"}
                </Btn>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}