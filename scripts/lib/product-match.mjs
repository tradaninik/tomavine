// Pure name-matching + fix-planning helpers for coordinated product data
// fixes. NO Prisma imports here: every function is plain data-in/data-out so
// the decision logic can be unit-tested offline against fixture rows that
// mirror the live listing (see scripts/fix-product-data.mjs for the executor).
//
// Matching policy (deliberately conservative):
//   - names are normalized (trim, collapse inner spaces, lowercase) before
//     comparison, so "  Lemon grass 1 " matches "Lemon grass 1"
//   - an exact normalized match wins
//   - otherwise a loose substring match is allowed (target contained in row
//     name or vice versa, min 4 chars) and is ANNOUNCED in the plan
//   - zero matches or multiple matches => the step FAILS loudly with the
//     candidate rows listed — never a silent no-op

export function normName(s) {
  return String(s ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

// rows: [{ id, nameEn, ... }]
// returns { matches: rows[], ambiguous: boolean, mode: "exact" | "loose" }
export function findCandidates(rows, name) {
  const t = normName(name);
  const exact = rows.filter((r) => normName(r.nameEn) === t);
  if (exact.length > 0) {
    return { matches: exact, ambiguous: exact.length > 1, mode: "exact" };
  }
  const loose = rows.filter((r) => {
    const n = normName(r.nameEn);
    return (t.length >= 4 && n.includes(t)) || (n.length >= 4 && t.includes(n));
  });
  return { matches: loose, ambiguous: loose.length > 1, mode: "loose" };
}

// Build the full fix plan from the current product rows. Pure function.
//
// targets = {
//   rename:     { from: "Lemon grass 1", to: "Lemongrass" },
//   hide:       "Indoor foliage",
//   photos:     [{ name: "Lemongrass", image: "/photos/lemongrass.jpg" }, ...],
//   botanicals: [{ name: "Lemongrass", botanical: "Cymbopogon citratus" }, ...],
// }
// rows = [{ id, nameEn, hidden, image, botanical }]
//
// Returns { ops, failures }:
//   ops     — ordered list of { op: "rename"|"hide"|"setimage"|"setbotanical",
//             ...payload } to execute, plus { op: "already"|"note"|"fail" }
//             informational entries the executor prints
//   failures— every step that could not be planned (executor exits 1)
export function planFixes(rows, targets) {
  const ops = [];
  const failures = [];
  const view = rows.map((r) => ({ ...r })); // local mutable copy

  const fail = (step, note, candidates) => {
    const c = candidates ?? [];
    failures.push({ step, note, candidates: c });
    ops.push({ op: "fail", step, note, candidates: c });
  };

  const resolve = (name, step, blockedNote) => {
    if (blockedNote) {
      fail(step, `skipped: ${blockedNote}`, []);
      return null;
    }
    const { matches, ambiguous, mode } = findCandidates(view, name);
    if (ambiguous) {
      fail(step, `ambiguous match for ${JSON.stringify(name)} — ${matches.length} rows match`, matches);
      return null;
    }
    if (matches.length === 0) {
      const words = normName(name).split(" ").filter((w) => w.length >= 4);
      const near = view.filter((r) => {
        const n = normName(r.nameEn);
        return words.some((w) => n.includes(w));
      });
      fail(step, `no product matches ${JSON.stringify(name)}`, near);
      return null;
    }
    if (mode === "loose") {
      ops.push({
        op: "note",
        step,
        text: `loose match: target ${JSON.stringify(name)} -> row ${JSON.stringify(matches[0].nameEn)}`,
      });
    }
    return matches[0];
  };

  // ── 1. rename ────────────────────────────────────────────────
  let renameOk = true;
  const t = targets.rename;
  const oldRes = findCandidates(view, t.from);
  const newRes = findCandidates(view, t.to);
  if (oldRes.matches.length === 1 && !oldRes.ambiguous) {
    if (newRes.matches.length > 0) {
      fail(
        "rename",
        `refusing: ${JSON.stringify(t.to)} already exists on another row (${newRes.matches
          .map((r) => r.nameEn)
          .join(", ")}) — resolve manually`,
        [],
      );
      renameOk = false;
    } else {
      const row = oldRes.matches[0];
      if (oldRes.mode === "loose") {
        ops.push({
          op: "note",
          step: "rename",
          text: `loose match: target ${JSON.stringify(t.from)} -> row ${JSON.stringify(row.nameEn)}`,
        });
      }
      ops.push({ op: "rename", step: "rename", id: row.id, from: row.nameEn, to: t.to });
      row.nameEn = t.to;
    }
  } else if (oldRes.matches.length === 0) {
    if (newRes.matches.length === 1 && !newRes.ambiguous) {
      const row = newRes.matches[0];
      ops.push({
        op: "already",
        step: "rename",
        text: `already renamed: ${JSON.stringify(row.nameEn)} (id ${row.id})`,
      });
    } else {
      fail(
        "rename",
        `no product matches ${JSON.stringify(t.from)} and no ${JSON.stringify(t.to)} found either`,
        oldRes.matches,
      );
      renameOk = false;
    }
  } else {
    fail("rename", `ambiguous match for ${JSON.stringify(t.from)}`, oldRes.matches);
    renameOk = false;
  }

  // Steps that target the rename's new name are blocked if the rename failed.
  const blockedIfRenameFailed = (name) =>
    !renameOk && normName(name) === normName(t.to)
      ? `rename to ${JSON.stringify(t.to)} did not apply`
      : null;

  // ── 2. hide ──────────────────────────────────────────────────
  const hideRow = resolve(targets.hide, "hide");
  if (hideRow) {
    if (hideRow.hidden) {
      ops.push({ op: "already", step: "hide", text: `${JSON.stringify(hideRow.nameEn)} is already hidden` });
    } else {
      ops.push({ op: "hide", step: "hide", id: hideRow.id, nameEn: hideRow.nameEn });
      hideRow.hidden = true;
    }
  }

  // ── 3. photos ────────────────────────────────────────────────
  for (const p of targets.photos) {
    const step = `photo:${p.image}`;
    const row = resolve(p.name, step, blockedIfRenameFailed(p.name));
    if (!row) continue;
    if (row.image === p.image) {
      ops.push({ op: "already", step, text: `${JSON.stringify(row.nameEn)} already has ${p.image}` });
    } else {
      ops.push({ op: "setimage", step, id: row.id, nameEn: row.nameEn, from: row.image, to: p.image });
      row.image = p.image;
    }
  }

  // ── 4. botanicals ────────────────────────────────────────────
  for (const b of targets.botanicals) {
    const step = `botanical:${b.botanical}`;
    const row = resolve(b.name, step, blockedIfRenameFailed(b.name));
    if (!row) continue;
    if (row.botanical === b.botanical) {
      ops.push({ op: "already", step, text: `${JSON.stringify(row.nameEn)} already has botanical ${JSON.stringify(b.botanical)}` });
    } else {
      ops.push({
        op: "setbotanical",
        step,
        id: row.id,
        nameEn: row.nameEn,
        from: row.botanical,
        to: b.botanical,
      });
      row.botanical = b.botanical;
    }
  }

  return { ops, failures };
}
