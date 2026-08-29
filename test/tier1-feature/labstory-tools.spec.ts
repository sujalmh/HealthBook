/**
 * Tier 1 Unit Tests: LabStory Causal Biomarker Engine (M2) — REAL DATA (M3)
 * Tools: extract_labs, correlate_meds (>=5 tests each)
 * Real-data: uses rawLabData/rawText for context.patientId, no mock fixture fallback.
 */

import { createTestHarness, assert, assertEquals, assertContains } from '../harness/webmcp-test-shim.ts';

export async function runLabStoryToolsTests(): Promise<{ passed: number; failed: number; errors: string[] }> {
  let passed = 0;
  let failed = 0;
  const errors: string[] = [];

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      passed++;
    } catch (err: any) {
      failed++;
      errors.push(`[LabStoryTools] ${name}: ${err.message || err}`);
    }
  }

  // Helper to build multi-year raw labs
  function buildRawLabs(overrides: any = {}) {
    const base = [
      { marker: 'Creatinine', value: 1.1, unit: 'mg/dL', drawDate: '2022-03-15T08:30:00Z' },
      { marker: 'eGFR', value: 58, unit: 'mL/min/1.73m2', drawDate: '2022-03-15T08:30:00Z' },
      { marker: 'Creatinine', value: 1.25, unit: 'mg/dL', drawDate: '2023-01-20T09:00:00Z' },
      { marker: 'eGFR', value: 50, unit: 'mL/min/1.73m2', drawDate: '2023-01-20T09:00:00Z' },
      { marker: 'HbA1c', value: 7.4, unit: '%', drawDate: '2023-01-20T09:00:00Z' },
      { marker: 'Potassium', value: 4.2, unit: 'mEq/L', drawDate: '2022-03-15T08:30:00Z' },
      { marker: 'Creatinine', value: 1.45, unit: 'mg/dL', drawDate: '2024-08-14T08:45:00Z' },
      { marker: 'eGFR', value: 42, unit: 'mL/min/1.73m2', drawDate: '2024-08-14T08:45:00Z' },
    ];
    return overrides.rawLabData || base;
  }

  // --- Tool 1: extract_labs (5 tests) ---
  await test('TC-LS01-01: extract_labs - longitudinal biomarker panel ingestion via rawLabData', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('extract_labs', { documentId: 'doc_real_labs_001', rawLabData: buildRawLabs() }, context);
    assert(res.success, 'Extraction should succeed');
    assert(Array.isArray(res.data), 'Data should be array of lab records');
    assert(res.data.length >= 5, 'Should extract at least 5 biomarker records from rawLabData');
  });

  await test('TC-LS01-02: extract_labs - unit normalization and reference ranges attachment', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('extract_labs', { documentId: 'doc_real_labs_002', rawLabData: [{ marker: 'Creatinine', value: 1.8, unit: 'mg/dL', drawDate: new Date().toISOString() }] }, context);
    const creatRecord = res.data.find((r: any) => r.marker === 'Creatinine');
    assert(!!creatRecord, 'Creatinine record must exist');
    assertEquals(creatRecord.unit, 'mg/dL');
    assertEquals(creatRecord.referenceRange.high, 1.2);
    assertEquals(creatRecord.normalizedUnit, 'mg/dL');
  });

  await test('TC-LS01-03: extract_labs - critical low eGFR flag detection via rawLabData', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('extract_labs', { documentId: 'doc_real_labs_003', rawLabData: [{ marker: 'eGFR', value: 28, unit: 'mL/min/1.73m2', drawDate: new Date().toISOString() }] }, context);
    const egfr = res.data.find((r: any) => r.marker === 'eGFR');
    assert(!!egfr, 'eGFR record must exist');
    // eGFR 28 < 60 => LOW, and <15 would be CRITICAL_LOW; with 28 expect LOW
    assert(egfr.flag === 'LOW' || egfr.flag === 'CRITICAL_LOW', 'eGFR 28 should be flagged LOW');
    assertEquals(egfr.value, 28);
  });

  await test('TC-LS01-04: extract_labs - chronological placement via vault', async () => {
    const { engine, context, vault } = createTestHarness();
    const raw = [
      { marker: 'Creatinine', value: 1.6, unit: 'mg/dL', drawDate: '2025-06-02T09:30:00Z' },
      { marker: 'Creatinine', value: 1.1, unit: 'mg/dL', drawDate: '2022-03-15T08:30:00Z' },
      { marker: 'Creatinine', value: 1.25, unit: 'mg/dL', drawDate: '2023-01-20T09:00:00Z' },
    ];
    await engine.execute('extract_labs', { documentId: 'doc_real_labs_004', rawLabData: raw }, context);
    const sortedCreats = vault.getLabs(context.patientId, 'Creatinine');
    assert(sortedCreats.length >= 3, 'Should have at least 3 creatinine records');
    const firstDate = new Date(sortedCreats[0].drawDate).getTime();
    const lastDate = new Date(sortedCreats[sortedCreats.length - 1].drawDate).getTime();
    assert(firstDate <= lastDate, 'Labs must be in chronological ascending order');
  });

  await test('TC-LS01-05: extract_labs - validation error when documentId is missing', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('extract_labs', {}, context);
    assert(!res.success, 'Validation should fail if documentId is missing');
    assertEquals(res.error?.code, 'INVALID_PARAMS');
  });

  // --- Tool 2: correlate_meds (5 tests) — requires vault labs first ---
  await test('TC-LS02-01: correlate_meds - eGFR trajectory with vault labs', async () => {
    const { engine, context } = createTestHarness();
    // Seed vault with eGFR labs that show decline
    await engine.execute('extract_labs', { documentId: 'doc_corr_001', rawLabData: [
      { marker: 'eGFR', value: 58, unit: 'mL/min/1.73m2', drawDate: '2022-03-15T08:30:00Z' },
      { marker: 'eGFR', value: 42, unit: 'mL/min/1.73m2', drawDate: '2024-08-14T08:45:00Z' },
      { marker: 'eGFR', value: 32, unit: 'mL/min/1.73m2', drawDate: '2026-08-25T11:00:00Z' },
    ]}, context);
    const res = await engine.execute('correlate_meds', { biomarker: 'eGFR' }, context);
    assert(res.success, 'Correlation query should succeed');
    // Real vault narrative after labs is "eGFR decreased/increased" not "No lab data"
    assert(!res.data.causalStorySentence.includes('No lab data for eGFR yet'), 'Should have lab data now');
    assertContains(res.data.causalStorySentence.toLowerCase(), 'egfr', 'Story should mention eGFR');
  });

  await test('TC-LS02-02: correlate_meds - Glucose trend with vault labs', async () => {
    const { engine, context } = createTestHarness();
    await engine.execute('extract_labs', { documentId: 'doc_corr_002', rawLabData: [
      { marker: 'Glucose Fasting', value: 118, unit: 'mg/dL', drawDate: '2022-03-15T08:30:00Z' },
      { marker: 'Glucose Fasting', value: 145, unit: 'mg/dL', drawDate: '2023-11-10T10:15:00Z' },
    ]}, context);
    const res = await engine.execute('correlate_meds', { biomarker: 'Glucose Fasting' }, context);
    assert(res.success, 'Query should succeed');
    assert(!res.data.causalStorySentence.includes('No lab data'), 'Should have glucose data');
    assertContains(res.data.causalStorySentence, 'Glucose', 'Should analyze Glucose');
  });

  await test('TC-LS02-03: correlate_meds - Potassium trend', async () => {
    const { engine, context } = createTestHarness();
    await engine.execute('extract_labs', { documentId: 'doc_corr_003', rawLabData: [
      { marker: 'Potassium', value: 4.2, unit: 'mEq/L', drawDate: '2022-03-15T08:30:00Z' },
      { marker: 'Potassium', value: 4.8, unit: 'mEq/L', drawDate: '2024-08-14T08:45:00Z' },
    ]}, context);
    const res = await engine.execute('correlate_meds', { biomarker: 'Potassium' }, context);
    assert(res.success, 'Query should succeed');
    assertContains(res.data.causalStorySentence, 'Potassium', 'Should analyze potassium trends');
  });

  await test('TC-LS02-04: correlate_meds - Generates targeted doctor question for Question Bank', async () => {
    const { engine, context } = createTestHarness();
    await engine.execute('extract_labs', { documentId: 'doc_corr_004', rawLabData: [{ marker: 'Creatinine', value: 1.8, unit: 'mg/dL', drawDate: new Date().toISOString() }] }, context);
    const res = await engine.execute('correlate_meds', { biomarker: 'Creatinine' }, context);
    assert(!!res.data.recommendedDoctorQuestion, 'Must generate recommended doctor question');
    assertContains(res.data.recommendedDoctorQuestion, 'Creatinine');
  });

  await test('TC-LS02-05: correlate_meds - validation error on empty biomarker parameter', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('correlate_meds', {}, context);
    assert(!res.success, 'Should fail validation without biomarker');
    assertEquals(res.error?.code, 'INVALID_PARAMS');
  });

  return { passed, failed, errors };
}
