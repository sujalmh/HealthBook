-- CareCanvas Supabase Schema — mirrors LocalVault 13 stores (M1)
-- Single-patient cohesion: every table has patient_id column indexed for
-- exact patient isolation (patient_id === CANONICAL_PATIENT_ID 'patient-s-devi').
-- Host comment only (no password): db.vcgnjsxmigcaboayemmj.supabase.co
-- Connection via DATABASE_URL env only — never commit .env.
--
-- Generated for ws-01-01. Idempotent: all CREATE use IF NOT EXISTS.
-- Tables use patient_id TEXT (maps to TypeScript patientId) + JSONB payload
-- plus typed columns mirroring src/types/vault.ts, carecircle.ts, safety.ts
-- for queryable fields. All tables have id PRIMARY KEY and created_at.

-- Enable pgcrypto for gen_random_uuid if available (safe no-op if not)
-- CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------
-- 1. facts — approved fact vault (Fact)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS facts (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  category TEXT,
  name TEXT,
  value JSONB,
  fact_key TEXT,
  fact_value JSONB,
  unit TEXT,
  confidence DOUBLE PRECISION,
  status TEXT,
  approval_status TEXT,
  source_doc_id TEXT,
  document_id TEXT,
  plain_explanation TEXT,
  plain_narration TEXT,
  author JSONB,
  metadata JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  payload JSONB
);
CREATE INDEX IF NOT EXISTS idx_facts_patient_id ON facts (patient_id);
CREATE INDEX IF NOT EXISTS idx_facts_status ON facts (status);

-- ------------------------------------------------------------------
-- 2. documents — source PDFs / lab slip photos
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  file_name TEXT,
  name TEXT,
  title TEXT,
  doc_type TEXT,
  type TEXT,
  page_count INTEGER DEFAULT 1,
  upload_timestamp TIMESTAMPTZ DEFAULT NOW(),
  uploaded_at TIMESTAMPTZ,
  extracted_text TEXT,
  raw_buffer TEXT,
  extracted_fact_ids JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  payload JSONB
);
CREATE INDEX IF NOT EXISTS idx_documents_patient_id ON documents (patient_id);

-- ------------------------------------------------------------------
-- 3. medications — active/held/discontinued meds (MedicationRecord)
-- Canonical table 'medications'; alias 'meds' view-compatible via same shape
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS medications (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  name TEXT,
  brand_name TEXT,
  generic_name TEXT,
  dosage TEXT,
  unit TEXT,
  frequency TEXT,
  timing_slots JSONB,
  with_food BOOLEAN,
  avoid_grapefruit BOOLEAN,
  avoid_alcohol BOOLEAN,
  avoid_dairy BOOLEAN,
  empty_stomach BOOLEAN,
  status TEXT,
  source TEXT,
  start_date TIMESTAMPTZ,
  stop_date TIMESTAMPTZ,
  indication TEXT,
  color_badge TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  payload JSONB
);
CREATE INDEX IF NOT EXISTS idx_medications_patient_id ON medications (patient_id);
CREATE INDEX IF NOT EXISTS idx_medications_status ON medications (status);
CREATE INDEX IF NOT EXISTS idx_medications_generic_name ON medications (generic_name);

-- Alias table 'meds' for backward compat (same columns); kept as real table
-- so older clients can upsert to either. Hydration checks both.
CREATE TABLE IF NOT EXISTS meds (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  name TEXT,
  brand_name TEXT,
  generic_name TEXT,
  dosage TEXT,
  unit TEXT,
  frequency TEXT,
  timing_slots JSONB,
  with_food BOOLEAN,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  payload JSONB
);
CREATE INDEX IF NOT EXISTS idx_meds_patient_id ON meds (patient_id);

-- ------------------------------------------------------------------
-- 4. labs — longitudinal lab records (LabRecord)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS labs (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  marker TEXT,
  marker_code TEXT,
  value DOUBLE PRECISION,
  unit TEXT,
  normalized_value DOUBLE PRECISION,
  normalized_unit TEXT,
  draw_date TIMESTAMPTZ,
  reference_range JSONB,
  optimal_range JSONB,
  is_borderline BOOLEAN,
  is_critical BOOLEAN,
  flag TEXT,
  source_doc_id TEXT,
  doctor_comments JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  payload JSONB
);
CREATE INDEX IF NOT EXISTS idx_labs_patient_id ON labs (patient_id);
CREATE INDEX IF NOT EXISTS idx_labs_marker ON labs (marker);
CREATE INDEX IF NOT EXISTS idx_labs_draw_date ON labs (draw_date);

-- ------------------------------------------------------------------
-- 5. conditions — chronic/active conditions (ConditionRecord)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conditions (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  condition_name TEXT,
  icd10 TEXT,
  diagnosed_date TIMESTAMPTZ,
  status TEXT,
  source_doc_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  payload JSONB
);
CREATE INDEX IF NOT EXISTS idx_conditions_patient_id ON conditions (patient_id);

-- ------------------------------------------------------------------
-- 6. allergies — allergen reactions (AllergyRecord)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS allergies (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  allergen TEXT,
  reaction TEXT,
  severity TEXT,
  status TEXT,
  recorded_date TIMESTAMPTZ,
  source_doc_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  payload JSONB
);
CREATE INDEX IF NOT EXISTS idx_allergies_patient_id ON allergies (patient_id);

-- ------------------------------------------------------------------
-- 7. proposals — RxBridge / HomeLab dose change proposals (ProposalRecord)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS proposals (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  doctor_name TEXT,
  doctor_id TEXT,
  type TEXT,
  med_id TEXT,
  med_name TEXT,
  previous_dose TEXT,
  proposed_dose TEXT,
  previous_slot TEXT,
  proposed_slot TEXT,
  reason TEXT,
  plain_narration TEXT,
  linked_lab_id TEXT,
  linked_danger_id TEXT,
  status TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  approval_role TEXT,
  on_behalf_of TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  payload JSONB
);
CREATE INDEX IF NOT EXISTS idx_proposals_patient_id ON proposals (patient_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals (status);

-- ------------------------------------------------------------------
-- 8. calendar_events — Safety / follow-up / lab_due events
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS calendar_events (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  title TEXT,
  event_type TEXT,
  scheduled_date TIMESTAMPTZ,
  reason TEXT,
  description TEXT,
  status TEXT,
  provider_name TEXT,
  notify_hours_before JSONB,
  is_completed BOOLEAN DEFAULT FALSE,
  synced_to_calendar BOOLEAN DEFAULT FALSE,
  ics_data TEXT,
  shared_with_caregivers JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  payload JSONB
);
CREATE INDEX IF NOT EXISTS idx_calendar_events_patient_id ON calendar_events (patient_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_scheduled_date ON calendar_events (scheduled_date);

-- ------------------------------------------------------------------
-- 9. care_circle — Family Care Circle links (LinkedCareProfile)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS care_circle (
  link_id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  patient_name TEXT,
  relationship TEXT,
  caregiver_id TEXT,
  caregiver_user_id TEXT,
  caregiver_name TEXT,
  permission_level TEXT,
  linked_date TIMESTAMPTZ,
  granted_date TIMESTAMPTZ,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  payload JSONB
);
CREATE INDEX IF NOT EXISTS idx_care_circle_patient_id ON care_circle (patient_id);
CREATE INDEX IF NOT EXISTS idx_care_circle_caregiver ON care_circle (caregiver_user_id);

-- ------------------------------------------------------------------
-- 10. doctor_grants — Doctor access grants (DoctorAccessGrant)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS doctor_grants (
  grant_id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  doctor_email TEXT,
  doctor_name TEXT,
  duration_days INTEGER,
  scope TEXT,
  permission_scope TEXT,
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  token TEXT,
  access_token TEXT,
  access_log JSONB,
  status TEXT,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  payload JSONB
);
CREATE INDEX IF NOT EXISTS idx_doctor_grants_patient_id ON doctor_grants (patient_id);
CREATE INDEX IF NOT EXISTS idx_doctor_grants_status ON doctor_grants (status);

-- ------------------------------------------------------------------
-- 11. due_cards — HomeLab due cards (DueCardRecord)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS due_cards (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  test_panel TEXT,
  biomarkers JSONB,
  due_date TIMESTAMPTZ,
  prescribed_by TEXT,
  prescribed_date TIMESTAMPTZ,
  instructions TEXT,
  status TEXT,
  completed_lab_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  payload JSONB
);
CREATE INDEX IF NOT EXISTS idx_due_cards_patient_id ON due_cards (patient_id);
CREATE INDEX IF NOT EXISTS idx_due_cards_due_date ON due_cards (due_date);

-- ------------------------------------------------------------------
-- 12. danger_reports — Safety triage reports (DangerSignReport)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS danger_reports (
  report_id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  symptom_tags JSONB,
  free_text TEXT,
  severity_rating TEXT,
  vital_signs JSONB,
  photo_attachment JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  triage_priority TEXT,
  first_aid_advice TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  payload JSONB
);
CREATE INDEX IF NOT EXISTS idx_danger_reports_patient_id ON danger_reports (patient_id);
CREATE INDEX IF NOT EXISTS idx_danger_reports_triage ON danger_reports (triage_priority);

-- ------------------------------------------------------------------
-- 13. question_bank — Patient questions for clinician (QuestionBankItem)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS question_bank (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  question_text TEXT,
  category TEXT,
  source_module TEXT,
  origin_module TEXT,
  context TEXT,
  linked_med_name TEXT,
  linked_lab_marker TEXT,
  priority TEXT,
  clinical_rationale TEXT,
  status TEXT,
  included_in_export BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  payload JSONB
);
CREATE INDEX IF NOT EXISTS idx_question_bank_patient_id ON question_bank (patient_id);
CREATE INDEX IF NOT EXISTS idx_question_bank_status ON question_bank (status);

-- ------------------------------------------------------------------
-- 14. interaction_cache — STORED derived pill-interaction evaluations
-- ------------------------------------------------------------------
-- One row per (patient_id, regimen_hash): drug-drug arcs + diet badges +
-- duplicate alerts computed by ClinicalInteractionEngine. Content-hash keyed
-- so evaluations are served from storage instead of recomputed on every
-- PillMap load. Engine version bump invalidates old rows. Payload JSONB
-- carries the full StoredInteractionEvaluation for forward-compat.
CREATE TABLE IF NOT EXISTS interaction_cache (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  regimen_hash TEXT NOT NULL,
  engine_version TEXT NOT NULL,
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  med_fingerprint JSONB,
  diet_flags JSONB,
  arcs JSONB,
  diet_badges JSONB,
  duplicate_alerts JSONB,
  med_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  payload JSONB
);
CREATE INDEX IF NOT EXISTS idx_interaction_cache_patient_id ON interaction_cache (patient_id);
CREATE INDEX IF NOT EXISTS idx_interaction_cache_regimen_hash ON interaction_cache (regimen_hash);
CREATE INDEX IF NOT EXISTS idx_interaction_cache_engine_version ON interaction_cache (engine_version);

-- ------------------------------------------------------------------
-- Patient isolation helper — ensures every table has indexed patient_id
-- ------------------------------------------------------------------
-- All patient_id indexes above enable fast scoped queries:
--   SELECT * FROM <table> WHERE patient_id = 'patient-s-devi';
-- Hydration layer must always filter with exact === on patient_id.

-- Optional: Row Level Security placeholder (enable per-table if needed)
-- ALTER TABLE facts ENABLE ROW LEVEL SECURITY;
-- No policy enforced in dev; app isolates via patient_id === checks in client.ts
