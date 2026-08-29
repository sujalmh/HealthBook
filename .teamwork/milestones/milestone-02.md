# Milestone milestone-02: M2 LocalVault Sync & Hydration

Wrap LocalVault add* methods (addMedication, addLab, addFact, addDangerReport, addCalendarEvent, addProposal, addDueCard, addCondition, addAllergy, addDoctorGrant, addCaregiverLink, addQuestion) to optionally syncToSupabase after local emit (non-blocking catch -> local-only + toast, no event duplication). Implement hydrateFromSupabase(patientId) in src/core/vault/supabaseSync.ts that pulls Postgres rows -> Map.set without emitting duplicate added inflation (use has check -> updated vs added, patient isolation exact ===). Handle Supabase down -> fallback. Preserve EventBus relevance matrix.

- Workstreams: ws-02-01
- DependsOn: milestone-01
- Status: pending
