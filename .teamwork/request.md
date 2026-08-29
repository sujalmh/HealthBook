# Request — CareCanvas Supabase Persistence (Env-Based)

## Objective
> **Verbatim user instruction (preserved, sanitized):**
> ```
> local only has no sense, the app cant be used. use the exact message i dropped in chat, im not going to rotate password
> [SUPABASE_URL REDACTED: postgresql://postgres:[REDACTED]@db.vcgnjsxmigcaboayemmj.supabase.co:5432/postgres]
> I dont want you to make it public, just add it into .env file and use supabase
> ```
> **Original host verbatim:** `db.vcgnjsxmigcaboayemmj.supabase.co:5432/postgres` user `postgres`
> **Sanitized note:** Password supplied by user stored *only* in local `.env` (gitignored, never in artifacts). Request artifact redacts password as `[REDACTED]` per security invariant.

**Interpreted intent:**

Enable real persistence/usage for CareCanvas by integrating **Supabase Postgres** (host `db.vcgnjsxmigcaboayemmj.supabase.co`) **via env-based `DATABASE_URL`** from local `.env` (already created, gitignored), while **preserving** the just-delivered cohesion hardening:

- Single canonical patient `patient-s-devi` with centralized idempotent seed (`src/core/vault/seed.ts` + `src/main.tsx` bootstrap) — do not revert to per-feature mocks
- Relevant-only reactive EventBus matrix (typed `EventName`/`EventPayloadMap`/alias groups) — keep 17 helpers and 7-view wiring
- De-slopped cohesive shell (`App.tsx` hidden wrappers, unified header)

Add a Supabase sync layer that makes local-only data *persistable/shareable* without breaking privacy/local-first UX: `LocalVault` remains immediate source of truth for UI reactivity; Postgres provides durability across reloads/devices. Must use `.env` (`DATABASE_URL`, `SUPABASE_DB_URL`, `VITE_SUPABASE_DB_URL`) — **never hard-code password in source or artifacts** — and rely on `.gitignore` + `opencode.json` deny.

This request **extends** prior cohesion project `teamwork-1787960278184` (4 milestones PASS, `verification/final.md` PASS) — do not regress cohesion. Prior `.teamwork/` verification for cohesion remains valid; this new run is `teamwork-1787976000076` focused on Supabase persistence.

Reference codebase:
- `src/core/vault/LocalVault.ts` (11 stores) — to be wrapped with Supabase sync
- `src/core/vault/seed.ts` (CANONICAL_PATIENT_ID `patient-s-devi`)
- `src/core/events/eventBus.ts` (typed matrix)
- `src/App.tsx`, `src/main.tsx` (bootstrap)
- `.env` (gitignored, contains DATABASE_URL) + `.env.example` (redacted)
- `package.json`, `vite.config.ts`, `test/tier3-integration/cohesion.test.ts` (28 tests), `src/tools/index.ts` (40 tools)

## Constraints
- Use Antigravity Distributed Coding pattern (Sentinel → Orchestrator → Explorer/Workers → Critic → Challenger → Auditor → Success Auditor) per `teamwork/patterns/distributed-coding/pattern.json`
- Preserve OpenCode compatibility and Teamwork engine invariants: explicit per-workstream file ownership, DAG scheduling, isolated `.teamwork/worktrees/<ws-id>/` scratch, `state.json`+`progress.md` persistence
- Keep PHI handling: `LocalVault` stays local for immediate UI; Supabase sync is explicit, env-gated (`if (DATABASE_URL) sync`); never log password, never commit `.env`, use `.env.example` with `[REDACTED]`
- Do NOT read secrets (`.env`, `*.pem`, `credentials/**`) in workers/reviewers — workers must read `import.meta.env` / `process.env` indirection, not raw `.env` read; auditor verifies no password in repo
- Do NOT overwrite cohesion hardening: canonical patient unified, zero divergent per-view seeds, EventBus relevance preserved, `App.tsx` hidden wrappers intact
- Dispatch-only Sentinel/Orchestrator; workers own file globs, reviewers read-only
- Every milestone Critic→Challenger→Auditor PASS; final Success Auditor PASS before Done; Ralph Loop max 3
- `tsc --noEmit` clean, `vite build` clean (1660 modules baseline), preserve 40 WebMCP tools
- Supabase integration must be idempotent, handle offline fallback (if DATABASE_URL missing, app still works local-only), and not duplicate events (use `LocalVault` typed emitters + Supabase sync without inflation)

## Acceptance Criteria
- [ ] **Request artifact preserved** with verbatim intent (sanitized: password `[REDACTED]`) before Orchestrator start — `.env` contains full URL locally, not in artifact
- [ ] **State initialized** via `TeamworkEngine.initProject` `teamwork-1787976000076`, sanitized request in `state.json` (no password)
- [ ] **`.env` handling verified**: `.env` exists locally with `DATABASE_URL` (gitignored), `.env.example` exists with `[REDACTED]` placeholder, `grep -R "baqduk" .teamwork/ src/ --exclude=.env` shows 0 hits outside `.env`; `.gitignore` covers `.env`; `opencode.json` deny unchanged
- [ ] **Supabase client layer** `src/core/supabase/*` (or `src/core/vault/supabaseSync.ts`) reads `import.meta.env.VITE_SUPABASE_DB_URL || process.env.DATABASE_URL` (env-only, no hard-coded password), handles connection pool, exposes `syncToSupabase()` / `hydrateFromSupabase()` with typed vault records (11 stores), uses `CANONICAL_PATIENT_ID` scoping, patient-isolation (`patientId ===` exact)
- [ ] **LocalVault sync integration**: `LocalVault` methods (`addMedication`, `addLab`, `addDangerReport`, `addCalendarEvent`, etc.) optionally sync to Supabase after local `emit` (non-blocking, failure falls back to local-only with toast), and bootstrap (`src/main.tsx` or `seed.ts`) hydrates from Supabase if `DATABASE_URL` present and local empty, else falls back to `seedIfEmpty` idempotent seed (preserves cohesion cold-start)
- [ ] **Cohesion preserved**: `grep -rn "p_devi_78" src` still 0, `grep seedBaselineRegimen src/components` 0, EventBus typed matrix intact, `App.tsx` hidden wrappers intact, `cohesion.test.ts` 28 still PASS (may add Supabase env-gated integration test, but not break existing)
- [ ] **No secret leakage**: `grep -R "baqduk\|vcgnjsxmigcaboayemmj" src/ test/ .teamwork/ --exclude-dir=node_modules` shows only `db.vcgnjsxmigcaboayemmj.supabase.co` host in sanitized places (request/plan) and 0 password hits; `.teamwork/request.md` contains `[REDACTED]` not raw password
- [ ] **Tests & build**: `npm run lint` 0, `npm test` 133+ PASS (cohesion 28 + possibly new supabase-gated tests skips when no DB), `node test/test-runner.ts` 231 PASS, `npm run build` 1660+ modules, 40 WebMCP tools intact, `dist/` built
- [ ] **Orchestrator executed with gates**: `plan.md` with milestones (M1 Supabase client & env plumbing, M2 LocalVault sync & hydration, M3 bootstrap integration & fallback + migration, M4 tests/build/adversarial + final hardening), DAG, parallel ownership, Explorer where needed, Worker results, per-milestone critics/challengers/auditors PASS
- [ ] **Adversarial**: handles `DATABASE_URL` missing (offline graceful), rapid Supabase sync no duplication, Supabase down fallback to local, multi-patient isolation preserved in Postgres row filtering, no spurious EventBus inflation from sync
- [ ] **Success Auditor final PASS** `verification/final.md` independently re-runs lint/test/build, verifies host `db.vcgnjsxmigcaboayemmj` used via env, password 0 hits in artifacts/src, cohesion preserved, and Supabase layer present

## Non-Goals
- Persisting raw password in repo/artifacts/logs — env-only
- Reverting cohesion hardening (single seed, EventBus matrix) — must preserve
- EHR FHIR auto-pull / TrialBridge / Offline PWA deep offline / new design system — out of scope
- Reproducing proprietary Antigravity hidden prompts — observable architecture only
- Long Proof / Self Verification patterns — future, not this run

## Created
- Timestamp: 2026-08-29T04:05:00Z
- Source input hash: supabase-persistence-20260829
- Host: db.vcgnjsxmigcaboayemmj.supabase.co:5432 (password in local .env only, redacted here)
- Prior project ref: teamwork-1787960278184 cohesion PASS (4 milestones, verification/final.md PASS) — this is extension teamwork-1787976000076
- Engine projectId: teamwork-1787976000076
- Pattern: distributed-coding

## Artifact
- Path: /Users/sujal/Projects/proj1/.teamwork/request.md
- Pattern: distributed-coding
