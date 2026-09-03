-- CareCanvas migration: Supabase as source of truth (server-truth).
-- Profiles map Supabase Auth users to vault patientIds; RLS enforces isolation.
-- Safe to re-run (IF NOT EXISTS / DROP POLICY IF EXISTS).

-- 1) Profiles ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  auth_user_id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  patient_id TEXT UNIQUE NOT NULL,
  email TEXT,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'patient',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_profiles_patient_id ON profiles (patient_id);
GRANT SELECT, INSERT, UPDATE ON profiles TO authenticated;

-- 2) Visibility helpers (SECURITY DEFINER so policies can read across RLS) --
CREATE OR REPLACE FUNCTION public.carecanvas_my_patient_ids()
RETURNS SETOF text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.patient_id FROM public.profiles p WHERE p.auth_user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.carecanvas_visible_patient_ids()
RETURNS SETOF text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.patient_id FROM public.profiles p WHERE p.auth_user_id = auth.uid()
  UNION
  SELECT cc.patient_id FROM public.care_circle cc
  WHERE COALESCE(cc.status, cc.payload ->> 'status') = 'active'
    AND (
      cc.payload ->> 'doctorId' IN (SELECT public.carecanvas_my_patient_ids())
      OR cc.payload ->> 'doctorUserId' IN (SELECT public.carecanvas_my_patient_ids())
    );
$$;

CREATE OR REPLACE FUNCTION public.carecanvas_writable_patient_ids()
RETURNS SETOF text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.patient_id FROM public.profiles p WHERE p.auth_user_id = auth.uid()
  UNION
  SELECT cc.patient_id FROM public.care_circle cc
  WHERE COALESCE(cc.status, cc.payload ->> 'status') = 'active'
    AND COALESCE(cc.permission_level, cc.payload ->> 'permissionLevel') IN ('manage', 'full')
    AND (
      cc.payload ->> 'doctorId' IN (SELECT public.carecanvas_my_patient_ids())
      OR cc.payload ->> 'doctorUserId' IN (SELECT public.carecanvas_my_patient_ids())
    );
$$;

-- 3) RLS --------------------------------------------------------------------
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE meds ENABLE ROW LEVEL SECURITY;
ALTER TABLE medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE labs ENABLE ROW LEVEL SECURITY;
ALTER TABLE conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE allergies ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE care_circle ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE due_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE danger_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE interaction_cache ENABLE ROW LEVEL SECURITY;

-- profiles: users manage only their own row
DROP POLICY IF EXISTS profiles_select_own ON profiles;
CREATE POLICY profiles_select_own ON profiles FOR SELECT
  USING (auth_user_id = auth.uid());
DROP POLICY IF EXISTS profiles_insert_own ON profiles;
CREATE POLICY profiles_insert_own ON profiles FOR INSERT
  WITH CHECK (auth_user_id = auth.uid());
DROP POLICY IF EXISTS profiles_update_own ON profiles;
CREATE POLICY profiles_update_own ON profiles FOR UPDATE
  USING (auth_user_id = auth.uid()) WITH CHECK (auth_user_id = auth.uid());

-- data tables: read own + actively linked; write own + manage/full links
-- (care_circle gets an extra self-revoke rule below)
DROP POLICY IF EXISTS data_select_visible ON facts;
CREATE POLICY data_select_visible ON facts FOR SELECT
  USING (patient_id IN (SELECT public.carecanvas_visible_patient_ids()));
DROP POLICY IF EXISTS data_insert_writable ON facts;
CREATE POLICY data_insert_writable ON facts FOR INSERT
  WITH CHECK (patient_id IN (SELECT public.carecanvas_writable_patient_ids()));
DROP POLICY IF EXISTS data_update_writable ON facts;
CREATE POLICY data_update_writable ON facts FOR UPDATE
  USING (patient_id IN (SELECT public.carecanvas_writable_patient_ids()))
  WITH CHECK (patient_id IN (SELECT public.carecanvas_writable_patient_ids()));
DROP POLICY IF EXISTS data_delete_writable ON facts;
CREATE POLICY data_delete_writable ON facts FOR DELETE
  USING (patient_id IN (SELECT public.carecanvas_writable_patient_ids()));

DROP POLICY IF EXISTS data_select_visible ON documents;
CREATE POLICY data_select_visible ON documents FOR SELECT
  USING (patient_id IN (SELECT public.carecanvas_visible_patient_ids()));
DROP POLICY IF EXISTS data_insert_writable ON documents;
CREATE POLICY data_insert_writable ON documents FOR INSERT
  WITH CHECK (patient_id IN (SELECT public.carecanvas_writable_patient_ids()));
DROP POLICY IF EXISTS data_update_writable ON documents;
CREATE POLICY data_update_writable ON documents FOR UPDATE
  USING (patient_id IN (SELECT public.carecanvas_writable_patient_ids()))
  WITH CHECK (patient_id IN (SELECT public.carecanvas_writable_patient_ids()));
DROP POLICY IF EXISTS data_delete_writable ON documents;
CREATE POLICY data_delete_writable ON documents FOR DELETE
  USING (patient_id IN (SELECT public.carecanvas_writable_patient_ids()));

DROP POLICY IF EXISTS data_select_visible ON meds;
CREATE POLICY data_select_visible ON meds FOR SELECT
  USING (patient_id IN (SELECT public.carecanvas_visible_patient_ids()));
DROP POLICY IF EXISTS data_insert_writable ON meds;
CREATE POLICY data_insert_writable ON meds FOR INSERT
  WITH CHECK (patient_id IN (SELECT public.carecanvas_writable_patient_ids()));
DROP POLICY IF EXISTS data_update_writable ON meds;
CREATE POLICY data_update_writable ON meds FOR UPDATE
  USING (patient_id IN (SELECT public.carecanvas_writable_patient_ids()))
  WITH CHECK (patient_id IN (SELECT public.carecanvas_writable_patient_ids()));
DROP POLICY IF EXISTS data_delete_writable ON meds;
CREATE POLICY data_delete_writable ON meds FOR DELETE
  USING (patient_id IN (SELECT public.carecanvas_writable_patient_ids()));

DROP POLICY IF EXISTS data_select_visible ON medications;
CREATE POLICY data_select_visible ON medications FOR SELECT
  USING (patient_id IN (SELECT public.carecanvas_visible_patient_ids()));
DROP POLICY IF EXISTS data_insert_writable ON medications;
CREATE POLICY data_insert_writable ON medications FOR INSERT
  WITH CHECK (patient_id IN (SELECT public.carecanvas_writable_patient_ids()));
DROP POLICY IF EXISTS data_update_writable ON medications;
CREATE POLICY data_update_writable ON medications FOR UPDATE
  USING (patient_id IN (SELECT public.carecanvas_writable_patient_ids()))
  WITH CHECK (patient_id IN (SELECT public.carecanvas_writable_patient_ids()));
DROP POLICY IF EXISTS data_delete_writable ON medications;
CREATE POLICY data_delete_writable ON medications FOR DELETE
  USING (patient_id IN (SELECT public.carecanvas_writable_patient_ids()));

DROP POLICY IF EXISTS data_select_visible ON labs;
CREATE POLICY data_select_visible ON labs FOR SELECT
  USING (patient_id IN (SELECT public.carecanvas_visible_patient_ids()));
DROP POLICY IF EXISTS data_insert_writable ON labs;
CREATE POLICY data_insert_writable ON labs FOR INSERT
  WITH CHECK (patient_id IN (SELECT public.carecanvas_writable_patient_ids()));
DROP POLICY IF EXISTS data_update_writable ON labs;
CREATE POLICY data_update_writable ON labs FOR UPDATE
  USING (patient_id IN (SELECT public.carecanvas_writable_patient_ids()))
  WITH CHECK (patient_id IN (SELECT public.carecanvas_writable_patient_ids()));
DROP POLICY IF EXISTS data_delete_writable ON labs;
CREATE POLICY data_delete_writable ON labs FOR DELETE
  USING (patient_id IN (SELECT public.carecanvas_writable_patient_ids()));

DROP POLICY IF EXISTS data_select_visible ON conditions;
CREATE POLICY data_select_visible ON conditions FOR SELECT
  USING (patient_id IN (SELECT public.carecanvas_visible_patient_ids()));
DROP POLICY IF EXISTS data_insert_writable ON conditions;
CREATE POLICY data_insert_writable ON conditions FOR INSERT
  WITH CHECK (patient_id IN (SELECT public.carecanvas_writable_patient_ids()));
DROP POLICY IF EXISTS data_update_writable ON conditions;
CREATE POLICY data_update_writable ON conditions FOR UPDATE
  USING (patient_id IN (SELECT public.carecanvas_writable_patient_ids()))
  WITH CHECK (patient_id IN (SELECT public.carecanvas_writable_patient_ids()));
DROP POLICY IF EXISTS data_delete_writable ON conditions;
CREATE POLICY data_delete_writable ON conditions FOR DELETE
  USING (patient_id IN (SELECT public.carecanvas_writable_patient_ids()));

DROP POLICY IF EXISTS data_select_visible ON allergies;
CREATE POLICY data_select_visible ON allergies FOR SELECT
  USING (patient_id IN (SELECT public.carecanvas_visible_patient_ids()));
DROP POLICY IF EXISTS data_insert_writable ON allergies;
CREATE POLICY data_insert_writable ON allergies FOR INSERT
  WITH CHECK (patient_id IN (SELECT public.carecanvas_writable_patient_ids()));
DROP POLICY IF EXISTS data_update_writable ON allergies;
CREATE POLICY data_update_writable ON allergies FOR UPDATE
  USING (patient_id IN (SELECT public.carecanvas_writable_patient_ids()))
  WITH CHECK (patient_id IN (SELECT public.carecanvas_writable_patient_ids()));
DROP POLICY IF EXISTS data_delete_writable ON allergies;
CREATE POLICY data_delete_writable ON allergies FOR DELETE
  USING (patient_id IN (SELECT public.carecanvas_writable_patient_ids()));

DROP POLICY IF EXISTS data_select_visible ON proposals;
CREATE POLICY data_select_visible ON proposals FOR SELECT
  USING (patient_id IN (SELECT public.carecanvas_visible_patient_ids()));
DROP POLICY IF EXISTS data_insert_writable ON proposals;
CREATE POLICY data_insert_writable ON proposals FOR INSERT
  WITH CHECK (patient_id IN (SELECT public.carecanvas_writable_patient_ids()));
DROP POLICY IF EXISTS data_update_writable ON proposals;
CREATE POLICY data_update_writable ON proposals FOR UPDATE
  USING (patient_id IN (SELECT public.carecanvas_writable_patient_ids()))
  WITH CHECK (patient_id IN (SELECT public.carecanvas_writable_patient_ids()));
DROP POLICY IF EXISTS data_delete_writable ON proposals;
CREATE POLICY data_delete_writable ON proposals FOR DELETE
  USING (patient_id IN (SELECT public.carecanvas_writable_patient_ids()));

DROP POLICY IF EXISTS data_select_visible ON calendar_events;
CREATE POLICY data_select_visible ON calendar_events FOR SELECT
  USING (patient_id IN (SELECT public.carecanvas_visible_patient_ids()));
DROP POLICY IF EXISTS data_insert_writable ON calendar_events;
CREATE POLICY data_insert_writable ON calendar_events FOR INSERT
  WITH CHECK (patient_id IN (SELECT public.carecanvas_writable_patient_ids()));
DROP POLICY IF EXISTS data_update_writable ON calendar_events;
CREATE POLICY data_update_writable ON calendar_events FOR UPDATE
  USING (patient_id IN (SELECT public.carecanvas_writable_patient_ids()))
  WITH CHECK (patient_id IN (SELECT public.carecanvas_writable_patient_ids()));
DROP POLICY IF EXISTS data_delete_writable ON calendar_events;
CREATE POLICY data_delete_writable ON calendar_events FOR DELETE
  USING (patient_id IN (SELECT public.carecanvas_writable_patient_ids()));

DROP POLICY IF EXISTS data_select_visible ON due_cards;
CREATE POLICY data_select_visible ON due_cards FOR SELECT
  USING (patient_id IN (SELECT public.carecanvas_visible_patient_ids()));
DROP POLICY IF EXISTS data_insert_writable ON due_cards;
CREATE POLICY data_insert_writable ON due_cards FOR INSERT
  WITH CHECK (patient_id IN (SELECT public.carecanvas_writable_patient_ids()));
DROP POLICY IF EXISTS data_update_writable ON due_cards;
CREATE POLICY data_update_writable ON due_cards FOR UPDATE
  USING (patient_id IN (SELECT public.carecanvas_writable_patient_ids()))
  WITH CHECK (patient_id IN (SELECT public.carecanvas_writable_patient_ids()));
DROP POLICY IF EXISTS data_delete_writable ON due_cards;
CREATE POLICY data_delete_writable ON due_cards FOR DELETE
  USING (patient_id IN (SELECT public.carecanvas_writable_patient_ids()));

DROP POLICY IF EXISTS data_select_visible ON danger_reports;
CREATE POLICY data_select_visible ON danger_reports FOR SELECT
  USING (patient_id IN (SELECT public.carecanvas_visible_patient_ids()));
DROP POLICY IF EXISTS data_insert_writable ON danger_reports;
CREATE POLICY data_insert_writable ON danger_reports FOR INSERT
  WITH CHECK (patient_id IN (SELECT public.carecanvas_writable_patient_ids()));
DROP POLICY IF EXISTS data_update_writable ON danger_reports;
CREATE POLICY data_update_writable ON danger_reports FOR UPDATE
  USING (patient_id IN (SELECT public.carecanvas_writable_patient_ids()))
  WITH CHECK (patient_id IN (SELECT public.carecanvas_writable_patient_ids()));
DROP POLICY IF EXISTS data_delete_writable ON danger_reports;
CREATE POLICY data_delete_writable ON danger_reports FOR DELETE
  USING (patient_id IN (SELECT public.carecanvas_writable_patient_ids()));

DROP POLICY IF EXISTS data_select_visible ON question_bank;
CREATE POLICY data_select_visible ON question_bank FOR SELECT
  USING (patient_id IN (SELECT public.carecanvas_visible_patient_ids()));
DROP POLICY IF EXISTS data_insert_writable ON question_bank;
CREATE POLICY data_insert_writable ON question_bank FOR INSERT
  WITH CHECK (patient_id IN (SELECT public.carecanvas_writable_patient_ids()));
DROP POLICY IF EXISTS data_update_writable ON question_bank;
CREATE POLICY data_update_writable ON question_bank FOR UPDATE
  USING (patient_id IN (SELECT public.carecanvas_writable_patient_ids()))
  WITH CHECK (patient_id IN (SELECT public.carecanvas_writable_patient_ids()));
DROP POLICY IF EXISTS data_delete_writable ON question_bank;
CREATE POLICY data_delete_writable ON question_bank FOR DELETE
  USING (patient_id IN (SELECT public.carecanvas_writable_patient_ids()));

DROP POLICY IF EXISTS data_select_visible ON interaction_cache;
CREATE POLICY data_select_visible ON interaction_cache FOR SELECT
  USING (patient_id IN (SELECT public.carecanvas_visible_patient_ids()));
DROP POLICY IF EXISTS data_insert_writable ON interaction_cache;
CREATE POLICY data_insert_writable ON interaction_cache FOR INSERT
  WITH CHECK (patient_id IN (SELECT public.carecanvas_writable_patient_ids()));
DROP POLICY IF EXISTS data_update_writable ON interaction_cache;
CREATE POLICY data_update_writable ON interaction_cache FOR UPDATE
  USING (patient_id IN (SELECT public.carecanvas_writable_patient_ids()))
  WITH CHECK (patient_id IN (SELECT public.carecanvas_writable_patient_ids()));
DROP POLICY IF EXISTS data_delete_writable ON interaction_cache;
CREATE POLICY data_delete_writable ON interaction_cache FOR DELETE
  USING (patient_id IN (SELECT public.carecanvas_writable_patient_ids()));

-- care_circle: read visible; write own links; linked doctors may revoke their own link
DROP POLICY IF EXISTS carecircle_select_visible ON care_circle;
CREATE POLICY carecircle_select_visible ON care_circle FOR SELECT
  USING (patient_id IN (SELECT public.carecanvas_visible_patient_ids()));
DROP POLICY IF EXISTS carecircle_insert_own ON care_circle;
CREATE POLICY carecircle_insert_own ON care_circle FOR INSERT
  WITH CHECK (patient_id IN (SELECT public.carecanvas_my_patient_ids()));
DROP POLICY IF EXISTS carecircle_update_own ON care_circle;
CREATE POLICY carecircle_update_own ON care_circle FOR UPDATE
  USING (
    patient_id IN (SELECT public.carecanvas_my_patient_ids())
    OR payload ->> 'doctorId' IN (SELECT public.carecanvas_my_patient_ids())
    OR payload ->> 'doctorUserId' IN (SELECT public.carecanvas_my_patient_ids())
  )
  WITH CHECK (
    patient_id IN (SELECT public.carecanvas_my_patient_ids())
    OR payload ->> 'doctorId' IN (SELECT public.carecanvas_my_patient_ids())
    OR payload ->> 'doctorUserId' IN (SELECT public.carecanvas_my_patient_ids())
  );
DROP POLICY IF EXISTS carecircle_delete_own_or_self ON care_circle;
CREATE POLICY carecircle_delete_own_or_self ON care_circle FOR DELETE
  USING (
    patient_id IN (SELECT public.carecanvas_my_patient_ids())
    OR payload ->> 'doctorId' IN (SELECT public.carecanvas_my_patient_ids())
    OR payload ->> 'doctorUserId' IN (SELECT public.carecanvas_my_patient_ids())
  );

-- doctor_grants: read own or granted-to-me; write own only (patient grants)
DROP POLICY IF EXISTS grants_select ON doctor_grants;
CREATE POLICY grants_select ON doctor_grants FOR SELECT
  USING (
    patient_id IN (SELECT public.carecanvas_visible_patient_ids())
    OR payload ->> 'doctorEmail' IN (SELECT email FROM public.profiles WHERE auth_user_id = auth.uid())
  );
DROP POLICY IF EXISTS grants_write_own ON doctor_grants;
CREATE POLICY grants_write_own ON doctor_grants FOR INSERT
  WITH CHECK (patient_id IN (SELECT public.carecanvas_my_patient_ids()));
DROP POLICY IF EXISTS grants_update_own ON doctor_grants;
CREATE POLICY grants_update_own ON doctor_grants FOR UPDATE
  USING (patient_id IN (SELECT public.carecanvas_my_patient_ids()))
  WITH CHECK (patient_id IN (SELECT public.carecanvas_my_patient_ids()));
DROP POLICY IF EXISTS grants_delete_own ON doctor_grants;
CREATE POLICY grants_delete_own ON doctor_grants FOR DELETE
  USING (patient_id IN (SELECT public.carecanvas_my_patient_ids()));
