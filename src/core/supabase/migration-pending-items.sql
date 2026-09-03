-- HealthBook migration: pending_items inbox for accept/reject flows.
-- Anything awaiting a human decision (dosage proposals, pill changes, fact
-- approvals) lives HERE with a 1-day TTL — never in the permanent tables.
-- On decision: effect applied to the real table, audit logged, inbox row deleted.
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS pending_items (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_by TEXT,
  created_by_role TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 day'),
  decided_at TIMESTAMPTZ,
  decided_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pending_items_patient_id ON pending_items (patient_id);
CREATE INDEX IF NOT EXISTS idx_pending_items_expires_at ON pending_items (expires_at);
CREATE INDEX IF NOT EXISTS idx_pending_items_status ON pending_items (status);

ALTER TABLE pending_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pending_select_visible ON pending_items;
CREATE POLICY pending_select_visible ON pending_items FOR SELECT
  USING (patient_id IN (SELECT public.healthbook_visible_patient_ids()));
DROP POLICY IF EXISTS pending_insert_writable ON pending_items;
CREATE POLICY pending_insert_writable ON pending_items FOR INSERT
  WITH CHECK (patient_id IN (SELECT public.healthbook_writable_patient_ids()));
DROP POLICY IF EXISTS pending_update_writable ON pending_items;
CREATE POLICY pending_update_writable ON pending_items FOR UPDATE
  USING (patient_id IN (SELECT public.healthbook_writable_patient_ids()))
  WITH CHECK (patient_id IN (SELECT public.healthbook_writable_patient_ids()));
DROP POLICY IF EXISTS pending_delete_writable ON pending_items;
CREATE POLICY pending_delete_writable ON pending_items FOR DELETE
  USING (patient_id IN (SELECT public.healthbook_writable_patient_ids()));
