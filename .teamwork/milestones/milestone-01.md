# Milestone milestone-01: M1 Supabase Client & Env Plumbing

Create src/core/supabase/client.ts + index.ts that reads env-only via import.meta.env.VITE_SUPABASE_DB_URL || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL, never hard-codes password/host password, handles missing URL gracefully (local-only fallback), exports isSupabaseEnabled(), getSupabaseConfig(), typed helpers for 11 stores with patientId===CANONICAL_PATIENT_ID scoping. Add src/core/supabase/schema.sql mirroring LocalVault stores (facts, meds, labs, conditions, allergies, proposals, calendar_events, care_circle, doctor_grants, due_cards, danger_reports, documents, question_bank) with patientId index. Ensure .env.example redacted placeholder present and docs, .env gitignored. Verify no baqduk outside .env. No regression to cohesion.

- Workstreams: ws-01-01
- DependsOn: none
- Status: pending
