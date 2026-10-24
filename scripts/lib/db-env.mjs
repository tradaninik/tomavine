// ─────────────────────────────────────────────────────────────
// Shared DATABASE_URL loader for Tomavine data scripts.
//
//   import { loadDbEnv } from "./lib/db-env.mjs";
//   loadDbEnv();
//   const prisma = new PrismaClient();
//
// Fixes the known Windows gotcha (project handoff): a stray
// DATABASE_URL from another project (libsql://…) riding in the
// shell used to silently override .env. Rules now:
//   1. No DATABASE_URL in the shell            -> use .env
//   2. Shell value starts with postgresql://   -> deliberate override, shell wins
//   3. Shell value is anything else, .env has one -> WARN, .env wins
//   4. Shell value is anything else, no .env   -> WARN, keep shell (Prisma fails)
//   5. Nothing anywhere                        -> WARN (set it in .env)
// The effective URL is ALWAYS printed with credentials masked, so
// you can see which database a script is about to touch before it
// writes — no more guessing which env won.
// ─────────────────────────────────────────────────────────────

import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";

// .env is resolved from the repo root (this file lives at
// scripts/lib/db-env.mjs), NOT from the current working directory —
// so the scripts behave the same no matter where they run from.
const ENV_PATH = fileURLToPath(new URL("../../.env", import.meta.url));

function readEnvDatabaseUrl() {
  if (!existsSync(ENV_PATH)) {
    return null;
  }
  for (const line of readFileSync(ENV_PATH, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*DATABASE_URL\s*=\s*"?([^"\n]+)"?\s*$/);
    if (m) {
      return m[1].trim();
    }
  }
  return null;
}

// Hide user:password before the host; URLs without credentials
// pass through untouched (nothing to hide).
function maskUrl(url) {
  return url.replace(/:\/\/[^@\s/]+@/, "://***@");
}

// Just enough of the scheme to say WHICH kind of URL it was —
// never enough to leak anything.
function brief(url) {
  return url.slice(0, 12) + "…";
}

export function loadDbEnv() {
  const shell = process.env.DATABASE_URL || null;
  const fromEnvFile = readEnvDatabaseUrl();

  if (shell && shell.startsWith("postgresql://")) {
    process.env.DATABASE_URL = shell;
    console.log(`[db-env] shell override: ${maskUrl(shell)}`);
    return;
  }

  if (shell && fromEnvFile) {
    console.warn(`[db-env] WARNING: shell DATABASE_URL is not postgresql (${brief(shell)}) — ignoring it and using .env instead.`);
    process.env.DATABASE_URL = fromEnvFile;
    console.log(`[db-env] .env: ${maskUrl(fromEnvFile)}`);
    return;
  }

  if (shell) {
    console.warn(`[db-env] WARNING: shell DATABASE_URL is not postgresql (${brief(shell)}) and .env has no DATABASE_URL. Unset the variable or add DATABASE_URL to .env — Prisma cannot use this URL.`);
    return;
  }

  if (fromEnvFile) {
    process.env.DATABASE_URL = fromEnvFile;
    console.log(`[db-env] .env: ${maskUrl(fromEnvFile)}`);
    return;
  }

  console.warn("[db-env] WARNING: no DATABASE_URL in the shell or .env. Add it to .env (the same URL Vercel uses).");
}
