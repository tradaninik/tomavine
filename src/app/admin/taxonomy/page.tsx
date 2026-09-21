"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Btn, Card, Empty, ErrBox, Loading, Pill, inputCls } from "../ui";

const SERIF = { fontFamily: "var(--font-display), Georgia, serif" };

type Term = {
  id: string;
  kind: string;
  label: string;
  names: Record<string, string> | null;
  groupName: string | null;
  note: string | null;
  meta: Record<string, unknown> | null;
  sort: number;
  active: boolean;
  createdAt: string;
};

type KindMeta = {
  code: string;
  label: string;
  emoji: string;
  blurb: string;
  groups: string[];
};

const META_ORDER = ["spacing", "plantsPerAcre", "season", "traySize", "form"];

const META_LABELS: Record<string, string> = {
  spacing: "Spacing",
  plantsPerAcre: "Plants/acre",
  season: "Season",
  traySize: "Tray",
  form: "Form",
};

const REGIONAL_LANGS: { code: string; label: string }[] = [
  { code: "hi", label: "Hindi" },
  { code: "te", label: "Telugu" },
  { code: "kn", label: "Kannada" },
  { code: "ta", label: "Tamil" },
  { code: "mr", label: "Marathi" },
];

function tabCls(active: boolean): string {
  return active
    ? "rounded-xl bg-[#2F6B3F] px-4 py-1.5 text-sm font-semibold text-white"
    : "rounded-xl px-4 py-1.5 text-sm font-semibold text-[#1C3A2A]/60 hover:bg-[#F7F3E8]";
}

function formatMetaValue(key: string, value: unknown): string {
  if (key === "plantsPerAcre" && typeof value === "number") {
    return value.toLocaleString("en-IN");
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  return String(value);
}

function metaEntries(meta: Record<string, unknown> | null): [string, unknown][] {
  if (!meta) {
    return [];
  }
  const ordered: string[] = [];
  for (const k of META_ORDER) {
    if (k in meta) {
      ordered.push(k);
    }
  }
  for (const k of Object.keys(meta)) {
    if (!ordered.includes(k)) {
      ordered.push(k);
    }
  }
  return ordered.map((k) => [k, meta[k]]);
}

function NamesLine({ names }: { names: Record<string, string> | null }) {
  const entries = names ? Object.entries(names) : [];
  if (entries.length === 0) {
    return null;
  }
  return (
    <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[#66735F]">
      {entries.map(([lang, val]) => (
        <span key={lang}>
          {lang} · {val}
        </span>
      ))}
    </p>
  );
}

function MetaChips({ meta }: { meta: Record<string, unknown> | null }) {
  const entries = metaEntries(meta);
  if (entries.length === 0) {
    return null;
  }
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {entries.map(([k, v]) => (
        <span
          key={k}
          className="rounded-full border border-[#A9C3A0]/50 bg-[#EDF2E6] px-2.5 py-0.5 text-xs font-medium text-[#24562F]"
        >
          {META_LABELS[k] ?? k}: {formatMetaValue(k, v)}
        </span>
      ))}
    </div>
  );
}

export default function AdminTaxonomyPage() {
  const [terms, setTerms] = useState<Term[]>([]);
  const [kinds, setKinds] = useState<KindMeta[]>([]);
  const [kind, setKind] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actError, setActError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [formKind, setFormKind] = useState("");
  const [formLabel, setFormLabel] = useState("");
  const [formGroup, setFormGroup] = useState("");
  const [formNote, setFormNote] = useState("");
  const [formNames, setFormNames] = useState<Record<string, string>>({ hi: "", te: "", kn: "", ta: "", mr: "" });
  const [formMeta, setFormMeta] = useState({ spacing: "", plantsPerAcre: "", season: "", traySize: "", form: "" });
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    fetch("/api/admin/taxonomy")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("failed"))))
      .then((data) => {
        if (active && data && Array.isArray(data.terms) && Array.isArray(data.kinds)) {
          setTerms(data.terms);
          setKinds(data.kinds);
          if (data.kinds.length > 0) {
            setKind((prev) => (prev === "" ? data.kinds[0].code : prev));
          }
        }
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reload]);

  const activeMeta = kinds.find((k) => k.code === kind) ?? null;
  const kindTerms = kind === "" ? [] : terms.filter((t) => t.kind === kind);
  const inactiveCount = terms.filter((t) => !t.active).length;
  const q = query.trim().toLowerCase();
  const searched =
    q === ""
      ? kindTerms
      : kindTerms.filter(
          (t) =>
            t.label.toLowerCase().includes(q) ||
            (t.groupName ?? "").toLowerCase().includes(q) ||
            (t.note ?? "").toLowerCase().includes(q) ||
            Object.values(t.names ?? {}).some((v) => String(v).toLowerCase().includes(q))
        );
  const groups: { name: string; items: Term[] }[] = [];
  for (const t of searched) {
    const gname = t.groupName ?? "Ungrouped";
    const bucket = groups.find((b) => b.name === gname);
    if (bucket) {
      bucket.items.push(t);
    } else {
      groups.push({ name: gname, items: [t] });
    }
  }

  function resetForm() {
    setFormLabel("");
    setFormGroup("");
    setFormNote("");
    setFormNames({ hi: "", te: "", kn: "", ta: "", mr: "" });
    setFormMeta({ spacing: "", plantsPerAcre: "", season: "", traySize: "", form: "" });
  }

  async function toggleActive(t: Term) {
    if (t.active) {
      const sure = window.confirm(
        `Deactivate “${t.label}”? It disappears from the storefront and seller pickers until reactivated.`
      );
      if (!sure) {
        return;
      }
    }
    setBusyId(t.id);
    setActError("");
    try {
      const res = await fetch(`/api/admin/taxonomy/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !t.active }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error((data && data.error) ?? "Action failed");
      }
      setTerms((prev) => prev.map((x) => (x.id === t.id ? { ...x, active: !t.active } : x)));
    } catch (e) {
      setActError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  async function submitNew(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError("");
    const label = formLabel.trim();
    if (!formKind) {
      setFormError("Pick a kind first.");
      return;
    }
    if (label.length < 2) {
      setFormError("Label needs at least 2 characters.");
      return;
    }
    const names: Record<string, string> = {};
    for (const l of REGIONAL_LANGS) {
      const v = (formNames[l.code] ?? "").trim();
      if (v) {
        names[l.code] = v;
      }
    }
    const body: Record<string, unknown> = { kind: formKind, label: label };
    if (formGroup.trim()) {
      body.groupName = formGroup.trim();
    }
    if (formNote.trim()) {
      body.note = formNote.trim();
    }
    if (Object.keys(names).length > 0) {
      body.names = names;
    }
    if (formKind === "saplingVariety") {
      const meta: Record<string, string | number> = {};
      if (formMeta.spacing.trim()) {
        meta.spacing = formMeta.spacing.trim();
      }
      const ppaRaw = formMeta.plantsPerAcre.trim();
      if (ppaRaw) {
        const ppa = Number(ppaRaw);
        if (!Number.isFinite(ppa) || ppa < 0) {
          setFormError("Plants per acre must be a positive number.");
          return;
        }
        meta.plantsPerAcre = Math.round(ppa);
      }
      if (formMeta.season.trim()) {
        meta.season = formMeta.season.trim();
      }
      if (formMeta.traySize.trim()) {
        meta.traySize = formMeta.traySize.trim();
      }
      if (formMeta.form.trim()) {
        meta.form = formMeta.form.trim();
      }
      if (Object.keys(meta).length > 0) {
        body.meta = meta;
      }
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/taxonomy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data && data.error === "duplicate") {
          throw new Error(`“${label}” already exists in this kind — labels are identity, choose a different label.`);
        }
        throw new Error((data && data.error) ?? "Create failed");
      }
      setOkMsg(`Added “${label}”.`);
      setFormOpen(false);
      resetForm();
      setKind(formKind);
      setReload((x) => x + 1);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <Loading />;
  }

  if (error) {
    return (
      <ErrBox>
        <p className="mb-2">Could not load taxonomy — please retry. (If Neon was asleep, give it a few seconds first.)</p>
        <Btn size="sm" onClick={() => setReload((x) => x + 1)}>
          Retry
        </Btn>
      </ErrBox>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold text-[#1C3A2A]" style={SERIF}>
          Taxonomy
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          {okMsg ? <Pill tone="leaf">✓ {okMsg}</Pill> : null}
          {inactiveCount > 0 ? <Pill tone="amber">{inactiveCount} inactive</Pill> : null}
          <Btn
            onClick={() => {
              if (formOpen) {
                setFormOpen(false);
              } else {
                setFormOpen(true);
                setFormKind(kind);
                setFormError("");
              }
            }}
          >
            {formOpen ? "Close form" : "+ Add term"}
          </Btn>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 rounded-2xl bg-white p-1 shadow-sm">
        {kinds.map((k) => {
          const total = terms.filter((t) => t.kind === k.code).length;
          const on = terms.filter((t) => t.kind === k.code && t.active).length;
          return (
            <button key={k.code} type="button" onClick={() => setKind(k.code)} className={tabCls(kind === k.code)} style={SERIF}>
              {k.emoji} {k.label} · {on === total ? total : `${on}/${total}`}
            </button>
          );
        })}
      </div>

      {activeMeta ? (
        <p className="text-sm text-[#66735F]">
          {activeMeta.blurb} <span className="text-[#8E9A84]">({kindTerms.length} terms in this kind)</span>
        </p>
      ) : null}

      <div className="sm:max-w-md">
        <input
          className={inputCls}
          placeholder="Search label, group, note or regional name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {formOpen ? (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-semibold text-[#1C3A2A]" style={SERIF}>
              New term
            </h2>
            <Btn
              size="sm"
              variant="ghost"
              onClick={() => {
                setFormOpen(false);
                resetForm();
                setFormError("");
              }}
            >
              Cancel
            </Btn>
          </div>
          <form onSubmit={submitNew} className="mt-4 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-[#66735F]">Kind</p>
                <select className={inputCls} value={formKind} onChange={(e) => setFormKind(e.target.value)}>
                  {kinds.map((k) => (
                    <option key={k.code} value={k.code}>
                      {k.emoji} {k.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-[#66735F]">Label — the identity, never reused</p>
                <input
                  className={inputCls}
                  value={formLabel}
                  onChange={(e) => setFormLabel(e.target.value)}
                  placeholder="e.g. Arka Rakshak (tomato)"
                  maxLength={100}
                />
              </div>
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-[#66735F]">Group</p>
                <input
                  className={inputCls}
                  list="tv-group-options"
                  value={formGroup}
                  onChange={(e) => setFormGroup(e.target.value)}
                  placeholder="Pick an existing group or type a new one"
                  maxLength={80}
                />
                <datalist id="tv-group-options">
                  {(kinds.find((k) => k.code === formKind)?.groups ?? []).map((g) => (
                    <option key={g} value={g} />
                  ))}
                </datalist>
              </div>
              <div>
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-[#66735F]">Specialist note (shows in gold)</p>
                <input
                  className={inputCls}
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  placeholder="One line of growing wisdom"
                  maxLength={500}
                />
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#66735F]">Regional names (optional)</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {REGIONAL_LANGS.map((l) => (
                  <div key={l.code}>
                    <p className="mb-1 text-xs text-[#8E9A84]">{l.label}</p>
                    <input
                      className={inputCls}
                      value={formNames[l.code] ?? ""}
                      onChange={(e) => setFormNames((p) => ({ ...p, [l.code]: e.target.value }))}
                      placeholder="Optional"
                      maxLength={120}
                    />
                  </div>
                ))}
              </div>
            </div>

            {formKind === "saplingVariety" ? (
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[#66735F]">
                  Per-acre guidance (optional — powers the storefront agri panel)
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <p className="mb-1 text-xs text-[#8E9A84]">Spacing</p>
                    <input
                      className={inputCls}
                      value={formMeta.spacing}
                      onChange={(e) => setFormMeta((p) => ({ ...p, spacing: e.target.value }))}
                      placeholder="60 cm × 60 cm"
                      maxLength={120}
                    />
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-[#8E9A84]">Plants per acre</p>
                    <input
                      className={inputCls}
                      type="number"
                      min={0}
                      value={formMeta.plantsPerAcre}
                      onChange={(e) => setFormMeta((p) => ({ ...p, plantsPerAcre: e.target.value }))}
                      placeholder="19800"
                    />
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-[#8E9A84]">Season</p>
                    <input
                      className={inputCls}
                      value={formMeta.season}
                      onChange={(e) => setFormMeta((p) => ({ ...p, season: e.target.value }))}
                      placeholder="Jun–Jul · Sep–Oct"
                      maxLength={120}
                    />
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-[#8E9A84]">Tray size</p>
                    <input
                      className={inputCls}
                      value={formMeta.traySize}
                      onChange={(e) => setFormMeta((p) => ({ ...p, traySize: e.target.value }))}
                      placeholder="104-cell tray"
                      maxLength={120}
                    />
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-[#8E9A84]">Form</p>
                    <input
                      className={inputCls}
                      value={formMeta.form}
                      onChange={(e) => setFormMeta((p) => ({ ...p, form: e.target.value }))}
                      placeholder="Budded plant, polybag"
                      maxLength={120}
                    />
                  </div>
                </div>
              </div>
            ) : null}

            {formError ? <ErrBox>{formError}</ErrBox> : null}

            <div className="flex flex-wrap items-center gap-2">
              <Btn type="submit" disabled={submitting}>
                + Create term
              </Btn>
              <span className="text-xs text-[#8E9A84]">Labels are permanent identity — duplicates are rejected.</span>
            </div>
          </form>
        </Card>
      ) : null}

      {actError ? <ErrBox>{actError}</ErrBox> : null}

      {groups.length === 0 ? (
        <Empty
          emoji={activeMeta?.emoji ?? "🌱"}
          title={query.trim() ? `No terms match “${query.trim()}”` : "No terms in this kind yet"}
          text={query.trim() ? "Try a shorter search, or clear it." : "Create the first one with “+ Add term”."}
        />
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.name}>
              <div className="mb-3 flex items-center gap-2 border-l-4 border-[#A9C3A0] pl-3">
                <h2 className="text-lg font-semibold text-[#1C3A2A]" style={SERIF}>
                  {g.name}
                </h2>
                <Pill tone="cream">{g.items.length}</Pill>
                {g.items.some((t) => !t.active) ? <Pill tone="amber">{g.items.filter((t) => !t.active).length} off</Pill> : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {g.items.map((t) => {
                  const busy = busyId === t.id;
                  return (
                    <div
                      key={t.id}
                      className={
                        t.active
                          ? "rounded-2xl border border-[#1C3A2A]/10 bg-[#F7F3E8] p-4 shadow-sm"
                          : "rounded-2xl border border-dashed border-[#1C3A2A]/25 bg-white p-4 opacity-75 shadow-sm"
                      }
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-[#20291D]" style={SERIF}>
                          {t.label}
                        </p>
                        {t.active ? <Pill tone="leaf">Active</Pill> : <Pill tone="rose">Inactive</Pill>}
                      </div>
                      <NamesLine names={t.names} />
                      {t.note ? (
                        <p className="mt-2 rounded-lg border border-[#E39B2D]/40 bg-[#E39B2D]/10 px-2 py-1 text-xs font-medium text-[#8A5A14]">
                          💡 {t.note}
                        </p>
                      ) : null}
                      <MetaChips meta={t.meta} />
                      <div className="mt-3 flex items-center justify-between border-t border-[#E4E0CE] pt-3">
                        <span className="text-xs text-[#8E9A84]">sort {t.sort}</span>
                        <Btn size="sm" variant={t.active ? "outline" : "primary"} onClick={() => toggleActive(t)} disabled={busy}>
                          {t.active ? "Deactivate" : "Reactivate"}
                        </Btn>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}