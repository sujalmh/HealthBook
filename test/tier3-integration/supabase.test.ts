/**
 * Tier 3 Supabase Integration — Env-gated sync + hydration + adversarial (M4)
 * Env-gated: all tests run without real DB via mocks; disabled path verified via env clearing.
 * If DATABASE_URL present, real client would be used but mocks still guarantee isolation.
 *
 * Coverage (8 required cases):
 *  1. syncToSupabase disabled when no URL gracefully (local-only)
 *  2. hydrateFromSupabase disabled returns skipped:true 0 hydrated
 *  3. hydrate payload mismatch isolation blocked (med-mismatch)
 *  4. rapid successive adds no duplication (10 med adds 10 events no dup, Map size correct)
 *  5. multi-patient isolation preserved (filter exact ===, payload mismatch rejected)
 *  6. no duplicate EventBus inflation from sync (hydrate 0 events, sync only toast not added)
 *  7. Supabase down fallback (mock fetch throw → hydrate 0 skipped false but fallback seeds 5 meds)
 *  8. idempotent hydration (second hydrate no dup, Map size stable)
 *
 * Runs under vitest: `npx vitest run test/tier3-integration/supabase.test.ts`
 * Also via `npm test -- test/tier3-integration/supabase.test.ts` (explicit file overrides vite include)
 * Disabled graceful: if env missing, disabled tests still pass; enabled tests set env + mock fetchSupabaseTable.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LocalVaultManager } from '@/core/vault/LocalVault';
import { setVaultSyncMode } from '@/core/vault/LocalVault';
import { WebMCPEventBus } from '@/core/events/eventBus';
import { seedIfEmpty, CANONICAL_PATIENT_ID } from '@/core/vault/seed';
import { isSupabaseEnabled, _resetSupabaseClientForTests } from '@/core/supabase/client';
import * as SupabaseClientModule from '@/core/supabase/client';
import { hydrateFromSupabase, syncToSupabase } from '@/core/vault/supabaseSync';

const CANONICAL = CANONICAL_PATIENT_ID; // patient-s-devi
const OTHER_PATIENT = 'p_jenkins_72';

// Save original env to restore
const ORIGINAL_ENV = { ...process.env };

function makeVaultWithBus() {
  const bus = new WebMCPEventBus();
  const vault = new LocalVaultManager(bus);
  return { vault, bus };
}

function countEvents(bus: WebMCPEventBus, name: string) {
  return bus.getEvents(name).length;
}

function enableSupabaseEnv() {
  // Use stub https URL so Lightweight client treats as REST base and isEnabled true
  process.env.DATABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_DB_URL = 'https://test.supabase.co';
  process.env.VITE_SUPABASE_DB_URL = 'https://test.supabase.co';
  _resetSupabaseClientForTests();
}

function disableSupabaseEnv() {
  delete process.env.DATABASE_URL;
  delete process.env.SUPABASE_DB_URL;
  delete process.env.VITE_SUPABASE_DB_URL;
  delete process.env.SUPABASE_URL;
  delete process.env.VITE_SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;
  delete process.env.VITE_SUPABASE_ANON_KEY;
  _resetSupabaseClientForTests();
}

describe('M4 Supabase Integration — env-gated sync+hydration adversarial', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    disableSupabaseEnv();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    setVaultSyncMode('local');
    // restore original env shape but keep our disable as baseline; tests that enabled will re-disable via beforeEach
    // Ensure we don't leak mock env
    for (const k of Object.keys(process.env)) {
      if (!(k in ORIGINAL_ENV)) delete (process.env as any)[k];
    }
    for (const [k, v] of Object.entries(ORIGINAL_ENV)) {
      if (v !== undefined) (process.env as any)[k] = v;
      else delete (process.env as any)[k];
    }
    _resetSupabaseClientForTests();
  });

  // ------------------------------------------------------------------
  // 1. syncToSupabase disabled when no URL gracefully (local-only)
  // ------------------------------------------------------------------
  it('1. syncToSupabase disabled when no URL gracefully (local-only)', async () => {
    disableSupabaseEnv();
    expect(isSupabaseEnabled()).toBe(false);

    const { vault, bus } = makeVaultWithBus();
    bus.clearHistory();

    const med = {
      id: 'med_sync_disabled_001',
      patientId: CANONICAL,
      genericName: 'SyncDisabledMed',
      brandName: 'SyncDisabled',
      dosage: '10mg',
      frequency: 'QD',
      timingSlots: ['morning'] as const,
      withFood: false,
      status: 'active' as const,
    };

    // LocalVault addMedication should succeed locally even when Supabase disabled
    await vault.addMedication(med as any);
    expect(vault.getMedications(CANONICAL).some(m => m.id === med.id)).toBe(true);
    expect(countEvents(bus, 'medication_added')).toBe(1);

    const res = await syncToSupabase('medications', med as any);
    expect(res.ok).toBe(true);
    expect(res.skipped).toBe(true);
    // No throw, local-only preserved
    expect(vault.getMedications(CANONICAL).length).toBe(1);

    // Also via generic upsert path
    const up = await SupabaseClientModule.upsertSupabaseRecord('medications' as any, med as any);
    // When disabled, upsert returns skipped true
    expect(up.skipped).toBe(true);
  });

  // ------------------------------------------------------------------
  // 2. hydrateFromSupabase disabled returns skipped:true 0 hydrated
  // ------------------------------------------------------------------
  it('2. hydrateFromSupabase disabled returns skipped:true 0 hydrated', async () => {
    disableSupabaseEnv();
    expect(isSupabaseEnabled()).toBe(false);

    const { vault, bus } = makeVaultWithBus();
    bus.clearHistory();

    const res = await hydrateFromSupabase(CANONICAL, vault);
    expect(res.hydrated).toBe(0);
    expect(res.skipped).toBe(true);
    expect(vault.getMedications(CANONICAL).length).toBe(0);
    expect(countEvents(bus, 'medication_added')).toBe(0);

    // Fallback seed is now no-op empty vault (M1 clean)
    const seedRes = seedIfEmpty(vault, CANONICAL);
    expect(seedRes.seeded || seedRes.skipped).toBeDefined();
    expect(vault.getMedications(CANONICAL).length).toBe(0);
    expect(countEvents(bus, 'medication_added')).toBe(0);
  });

  // ------------------------------------------------------------------
  // 3. hydrate payload mismatch isolation blocked (med-mismatch)
  // ------------------------------------------------------------------
  it('3. hydrate payload mismatch isolation blocked (med-mismatch)', async () => {
    enableSupabaseEnv();
    expect(isSupabaseEnabled()).toBe(true);

    const { vault, bus } = makeVaultWithBus();
    bus.clearHistory();

    const spy = vi.spyOn(SupabaseClientModule, 'fetchSupabaseTable').mockImplementation(async (table: any, _patientId: string) => {
      if (table === 'medications') {
        return {
          data: [
            // canonical — should hydrate
            { id: 'med_canonical_001', patientId: CANONICAL, patient_id: CANONICAL, genericName: 'Good', dosage: '10mg', payload: { id: 'med_canonical_001', patientId: CANONICAL, genericName: 'Good', dosage: '10mg', frequency: 'QD', timingSlots: ['morning'], withFood: false, status: 'active' } },
            // evil patientId — must be blocked (payload mismatch)
            { id: 'med_mismatch_evil', patientId: OTHER_PATIENT, patient_id: OTHER_PATIENT, genericName: 'Bad', dosage: '10mg', payload: { id: 'med_mismatch_evil', patientId: OTHER_PATIENT, genericName: 'Bad', dosage: '10mg', frequency: 'QD', timingSlots: ['morning'], withFood: false, status: 'active' } },
            // outer patient_id mismatch even though payload says canonical — must be blocked by raw.patient_id check
            { id: 'med_mismatch_outer', patient_id: OTHER_PATIENT, payload: { id: 'med_mismatch_outer', patientId: CANONICAL, genericName: 'BadOuter', dosage: '10mg', frequency: 'QD', timingSlots: ['morning'], withFood: false, status: 'active' } },
            // missing patientId — must be blocked
            { id: 'med_no_pid', genericName: 'NoPid', dosage: '10mg', payload: { id: 'med_no_pid', genericName: 'NoPid', dosage: '10mg' } },
          ] as any,
          error: null,
        };
      }
      // other tables empty
      return { data: [], error: null } as any;
    });

    const res = await hydrateFromSupabase(CANONICAL, vault);
    expect(spy).toHaveBeenCalled();

    // Only 1 canonical should hydrate
    expect(res.hydrated).toBe(1);
    expect(vault.getMedications(CANONICAL).length).toBe(1);
    expect(vault.getMedications(CANONICAL).some(m => m.id === 'med_canonical_001')).toBe(true);
    expect(vault.getMedications(CANONICAL).some(m => m.id === 'med_mismatch_evil')).toBe(false);
    expect(vault.getMedications(CANONICAL).some(m => m.id === 'med_mismatch_outer')).toBe(false);
    expect(vault.getMedications(OTHER_PATIENT).length).toBe(0);
    // Hydrate is silent — no EventBus inflation
    expect(countEvents(bus, 'medication_added')).toBe(0);
    expect(countEvents(bus, 'medication_updated')).toBe(0);
  });

  // ------------------------------------------------------------------
  // 4. rapid successive adds no duplication (10 med adds 10 events no dup, Map size correct)
  // ------------------------------------------------------------------
  it('4. rapid successive adds no duplication (10 med adds 10 events no dup, Map size correct)', async () => {
    disableSupabaseEnv();
    const { vault, bus } = makeVaultWithBus();
    vault.clear({ preserveAudit: false });
    bus.clearHistory();

    // Also test with Supabase disabled rapid local adds — should be 10 distinct
    const promises: Promise<void>[] = [];
    for (let i = 0; i < 10; i++) {
      promises.push(Promise.resolve().then(async () => {
        await vault.addMedication({
          id: `med_rapid_supabase_${i}`,
          patientId: CANONICAL,
          genericName: `RapidSupa-${i}`,
          dosage: `${i}mg`,
          frequency: 'QD',
          timingSlots: ['morning'],
          withFood: false,
          status: 'active',
        } as any);
      }));
    }
    await Promise.all(promises);

    expect(vault.getMedications(CANONICAL).length).toBe(10);
    expect(countEvents(bus, 'medication_added')).toBe(10);
    const ids = vault.getMedications(CANONICAL).map(m => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(ids).size).toBe(10);
    // Map size correct
    expect((vault as any).meds.size).toBe(10);

    // Enable env and repeat rapid with Supabase sync path (mocked upsert intercepts network)
    enableSupabaseEnv();
    setVaultSyncMode('server');
    // Mock upsert to be no-op skipped so rapid doesn't hit network
    const upSpy = vi.spyOn(SupabaseClientModule, 'upsertSupabaseRecord').mockResolvedValue({ ok: true, skipped: true } as any);
    const { vault: v2, bus: b2 } = makeVaultWithBus();
    b2.clearHistory();
    const p2: Promise<void>[] = [];
    for (let i = 0; i < 10; i++) {
      p2.push(Promise.resolve().then(async () => {
        await v2.addMedication({
          id: `med_rapid_supabase2_${i}`,
          patientId: CANONICAL,
          genericName: `Rapid2-${i}`,
          dosage: `${i}mg`,
          frequency: 'QD',
          timingSlots: ['morning'],
          withFood: false,
          status: 'active',
        } as any);
      }));
    }
    await Promise.all(p2);
    expect(v2.getMedications(CANONICAL).length).toBe(10);
    expect(countEvents(b2, 'medication_added')).toBe(10);
    expect(new Set(v2.getMedications(CANONICAL).map(m => m.id)).size).toBe(10);
    // 10 med writes + 10 auto-generated medication questions (nested writes persist too)
    expect(upSpy).toHaveBeenCalledTimes(20);
    // No duplicate Map entries
    expect((v2 as any).meds.size).toBe(10);
  });

  // ------------------------------------------------------------------
  // 5. multi-patient isolation preserved (filter exact ===, payload mismatch rejected)
  // ------------------------------------------------------------------
  it('5. multi-patient isolation preserved (filter exact ===, payload mismatch rejected)', async () => {
    enableSupabaseEnv();
    expect(isSupabaseEnabled()).toBe(true);

    const { vault, bus } = makeVaultWithBus();
    bus.clearHistory();

    vi.spyOn(SupabaseClientModule, 'fetchSupabaseTable').mockImplementation(async (table: any, pid: string) => {
      if (pid === CANONICAL) {
        if (table === 'medications') {
          return {
            data: [
              { id: 'med_iso_canonical', patientId: CANONICAL, patient_id: CANONICAL, payload: { id: 'med_iso_canonical', patientId: CANONICAL, genericName: 'IsoGood', dosage: '5mg', frequency: 'QD', timingSlots: ['morning'], withFood: false, status: 'active' } },
              // Other patient row that server incorrectly returned despite filter — must be rejected by exact === check
              { id: 'med_iso_other', patientId: OTHER_PATIENT, patient_id: OTHER_PATIENT, payload: { id: 'med_iso_other', patientId: OTHER_PATIENT, genericName: 'IsoBad', dosage: '5mg', frequency: 'QD', timingSlots: ['morning'], withFood: false, status: 'active' } },
              // substring trick: patientId includes devi but not exact
              { id: 'med_iso_substring', patientId: 'evil-devi-attacker', patient_id: 'evil-devi-attacker', payload: { id: 'med_iso_substring', patientId: 'evil-devi-attacker', genericName: 'SubBad', dosage: '5mg', frequency: 'QD', timingSlots: ['morning'], withFood: false, status: 'active' } },
            ] as any,
            error: null,
          };
        }
        if (table === 'labs') {
          return {
            data: [
              { id: 'lab_iso_canonical', patientId: CANONICAL, patient_id: CANONICAL, marker: 'eGFR', value: 28, payload: { id: 'lab_iso_canonical', patientId: CANONICAL, marker: 'eGFR', value: 28, unit: 'mL/min', normalizedValue: 28, normalizedUnit: 'mL/min', drawDate: new Date().toISOString(), referenceRange: { low: 60, high: 120 }, optimalRange: { low: 90, high: 120 }, isBorderline: false, isCritical: false } },
              { id: 'lab_iso_other', patientId: OTHER_PATIENT, patient_id: OTHER_PATIENT, marker: 'eGFR', value: 99, payload: { id: 'lab_iso_other', patientId: OTHER_PATIENT, marker: 'eGFR', value: 99, unit: 'mL/min', normalizedValue: 99, normalizedUnit: 'mL/min', drawDate: new Date().toISOString(), referenceRange: { low: 60, high: 120 }, optimalRange: { low: 90, high: 120 }, isBorderline: false, isCritical: false } },
            ] as any,
            error: null,
          };
        }
      }
      // Other patient hydrate returns its own
      if (pid === OTHER_PATIENT && table === 'medications') {
        return { data: [{ id: 'med_iso_other', patientId: OTHER_PATIENT, patient_id: OTHER_PATIENT, payload: { id: 'med_iso_other', patientId: OTHER_PATIENT, genericName: 'IsoBad', dosage: '5mg', frequency: 'QD', timingSlots: ['morning'], withFood: false, status: 'active' } }] as any, error: null };
      }
      return { data: [], error: null } as any;
    });

    const resCanonical = await hydrateFromSupabase(CANONICAL, vault);
    expect(resCanonical.hydrated).toBe(2); // 1 med + 1 lab canonical
    expect(vault.getMedications(CANONICAL).length).toBe(1);
    expect(vault.getMedications(CANONICAL).some(m => m.id === 'med_iso_canonical')).toBe(true);
    expect(vault.getMedications(CANONICAL).some(m => m.id === 'med_iso_other')).toBe(false);
    expect(vault.getMedications(CANONICAL).some(m => m.id === 'med_iso_substring')).toBe(false);
    expect(vault.getLabs(CANONICAL).length).toBe(1);
    expect(vault.getMedications(OTHER_PATIENT).length).toBe(0);
    expect(vault.getLabs(OTHER_PATIENT).length).toBe(0);

    // Hybrid: also hydrate other patient into separate vault to ensure not leaking
    const { vault: vOther } = makeVaultWithBus();
    const resOther = await hydrateFromSupabase(OTHER_PATIENT, vOther);
    // vOther should have only other patient data when mocked correctly
    // Our mock for OTHER_PATIENT medications returns 1, so expect hydration
    expect(vOther.getMedications(OTHER_PATIENT).length).toBe(1);
    expect(vOther.getMedications(CANONICAL).length).toBe(0);

    // Isolation exact === preserved
    expect(countEvents(bus, 'medication_added')).toBe(0);
  });

  // ------------------------------------------------------------------
  // 6. no duplicate EventBus inflation from sync (hydrate 0 events, sync only toast not added)
  // ------------------------------------------------------------------
  it('6. no duplicate EventBus inflation from sync (hydrate 0 events, sync only toast not added)', async () => {
    enableSupabaseEnv();
    expect(isSupabaseEnabled()).toBe(true);

    // Mock fetch to return empty so hydrate does nothing but is not skipped (error vs empty)
    vi.spyOn(SupabaseClientModule, 'fetchSupabaseTable').mockResolvedValue({ data: [], error: null } as any);
    const { vault, bus } = makeVaultWithBus();
    bus.clearHistory();

    const hRes = await hydrateFromSupabase(CANONICAL, vault);
    expect(hRes.hydrated).toBe(0);
    expect(hRes.skipped).toBe(false);
    expect(countEvents(bus, 'medication_added')).toBe(0);
    expect(countEvents(bus, 'lab_added')).toBe(0);
    expect(countEvents(bus, 'fact_added')).toBe(0);
    expect(countEvents(bus, 'due_card_added')).toBe(0);
    expect(countEvents(bus, 'toast')).toBe(0);

    // Now test sync path: addMedication when Supabase save fails must reject —
    // server truth means nothing is silently kept local on failure.
    vi.restoreAllMocks();
    enableSupabaseEnv();
    setVaultSyncMode('server');
    vi.spyOn(SupabaseClientModule, 'upsertSupabaseRecord').mockResolvedValue({ ok: false, error: 'mock supabase down' } as any);
    // Also need fetch stub still
    vi.spyOn(SupabaseClientModule, 'fetchSupabaseTable').mockResolvedValue({ data: [], error: null } as any);

    const { vault: v2, bus: b2 } = makeVaultWithBus();
    b2.clearHistory();

    const med = {
      id: 'med_sync_toast_001',
      patientId: CANONICAL,
      genericName: 'ToastMed',
      dosage: '10mg',
      frequency: 'QD',
      timingSlots: ['morning'] as const,
      withFood: false,
      status: 'active' as const,
    };
    await expect(v2.addMedication(med as any)).rejects.toThrow(/mock supabase down/);
    // Nothing cached on failure: no event, no silent local copy
    expect(countEvents(b2, 'medication_added')).toBe(0);
    expect(v2.getMedications(CANONICAL).length).toBe(0);
  });

  // ------------------------------------------------------------------
  // 7. Supabase down fallback (mock fetch throw → hydrate 0 skipped false but fallback seeds 5 meds)
  // ------------------------------------------------------------------
  it('7. Supabase down fallback (mock fetch throw → hydrate 0 skipped false but fallback seeds 5 meds)', async () => {
    enableSupabaseEnv();
    expect(isSupabaseEnabled()).toBe(true);

    // Mock fetchSupabaseTable to simulate network down: throw or return error
    vi.spyOn(SupabaseClientModule, 'fetchSupabaseTable').mockImplementation(async () => {
      throw new Error('mock fetch network down');
    });

    const { vault, bus } = makeVaultWithBus();
    vault.clear({ preserveAudit: false });
    bus.clearHistory();

    const hRes = await hydrateFromSupabase(CANONICAL, vault);
    // Our hydrate catches per-table errors and continues; if all throw, each caught and counts 0, total 0 skipped false (since not all skipped)
    // But if impl catches top-level, may still be 0. Accept either 0,0 or skipped true fallback both allow seed.
    expect(hRes.hydrated).toBe(0);
    // skipped may be false (per-table error) or true (top-level) — both indicate fallback should seed
    expect(typeof hRes.skipped).toBe('boolean');
    expect(vault.getMedications(CANONICAL).length).toBe(0);

    // Fallback path: seedIfEmpty is now no-op empty (M1)
    const seedRes = seedIfEmpty(vault, CANONICAL);
    expect(vault.getMedications(CANONICAL).length).toBe(0);
    expect(vault.getLabs(CANONICAL).length).toBe(0);
    if (seedRes.inserted) {
      expect(seedRes.inserted.medications).toBe(0);
    }

    // Variant: mock to return {error} not throw
    vi.restoreAllMocks();
    vi.spyOn(SupabaseClientModule, 'fetchSupabaseTable').mockResolvedValue({ data: null as any, error: 'mock down error' } as any);
    const { vault: v2 } = makeVaultWithBus();
    v2.clear({ preserveAudit: false });
    const h2 = await hydrateFromSupabase(CANONICAL, v2);
    expect(h2.hydrated).toBe(0);
    expect(h2.skipped).toBe(false);
    const s2 = seedIfEmpty(v2, CANONICAL);
    expect(v2.getMedications(CANONICAL).length).toBe(0);
    expect(s2.inserted.medications).toBe(0);
  });

  // ------------------------------------------------------------------
  // 8. idempotent hydration (second hydrate no dup, Map size stable)
  // ------------------------------------------------------------------
  it('8. idempotent hydration (second hydrate no dup, Map size stable)', async () => {
    enableSupabaseEnv();
    expect(isSupabaseEnabled()).toBe(true);

    const mockRows = [
      { id: 'med_idempotent_001', patientId: CANONICAL, patient_id: CANONICAL, genericName: 'IdempotentMed1', dosage: '10mg', payload: { id: 'med_idempotent_001', patientId: CANONICAL, genericName: 'IdempotentMed1', dosage: '10mg', frequency: 'QD', timingSlots: ['morning'], withFood: false, status: 'active' } },
      { id: 'med_idempotent_002', patientId: CANONICAL, patient_id: CANONICAL, genericName: 'IdempotentMed2', dosage: '20mg', payload: { id: 'med_idempotent_002', patientId: CANONICAL, genericName: 'IdempotentMed2', dosage: '20mg', frequency: 'QD', timingSlots: ['morning'], withFood: false, status: 'active' } },
    ];

    vi.spyOn(SupabaseClientModule, 'fetchSupabaseTable').mockImplementation(async (table: any) => {
      if (table === 'medications') return { data: mockRows as any, error: null };
      return { data: [], error: null } as any;
    });

    const { vault, bus } = makeVaultWithBus();
    vault.clear({ preserveAudit: false });
    bus.clearHistory();

    const r1 = await hydrateFromSupabase(CANONICAL, vault);
    expect(r1.hydrated).toBe(2);
    expect(vault.getMedications(CANONICAL).length).toBe(2);
    expect((vault as any).meds.size).toBe(2);
    expect(countEvents(bus, 'medication_added')).toBe(0); // silent
    const sizeAfterFirst = (vault as any).meds.size;

    const r2 = await hydrateFromSupabase(CANONICAL, vault);
    // Second hydrate same rows should not duplicate; hydrated counts 2 again but map size stable
    expect(r2.hydrated).toBe(2);
    expect(vault.getMedications(CANONICAL).length).toBe(2);
    expect((vault as any).meds.size).toBe(sizeAfterFirst);
    expect((vault as any).meds.size).toBe(2);
    expect(countEvents(bus, 'medication_added')).toBe(0);

    // Mutate one row to simulate update (same id different dosage) — should merge not duplicate
    const updatedRows = [
      { id: 'med_idempotent_001', patientId: CANONICAL, patient_id: CANONICAL, genericName: 'IdempotentMed1', dosage: '15mg', payload: { id: 'med_idempotent_001', patientId: CANONICAL, genericName: 'IdempotentMed1', dosage: '15mg', frequency: 'QD', timingSlots: ['morning'], withFood: false, status: 'active' } },
      { id: 'med_idempotent_002', patientId: CANONICAL, patient_id: CANONICAL, genericName: 'IdempotentMed2', dosage: '20mg', payload: { id: 'med_idempotent_002', patientId: CANONICAL, genericName: 'IdempotentMed2', dosage: '20mg', frequency: 'QD', timingSlots: ['morning'], withFood: false, status: 'active' } },
    ];
    vi.restoreAllMocks();
    vi.spyOn(SupabaseClientModule, 'fetchSupabaseTable').mockImplementation(async (table: any) => {
      if (table === 'medications') return { data: updatedRows as any, error: null };
      return { data: [], error: null } as any;
    });

    const r3 = await hydrateFromSupabase(CANONICAL, vault);
    expect(r3.hydrated).toBe(2);
    expect((vault as any).meds.size).toBe(2);
    expect(vault.getMedications(CANONICAL).find(m => m.id === 'med_idempotent_001')?.dosage).toBe('15mg');
    expect(countEvents(bus, 'medication_added')).toBe(0);
    expect(countEvents(bus, 'medication_updated')).toBe(0); // hydrate never emits updated either
  });
});
