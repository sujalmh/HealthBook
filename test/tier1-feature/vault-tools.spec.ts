/**
 * Tier 1 Unit Tests: Approved Fact Vault Module (M0)
 * Tools: extract_fact, confirm_fact, compile_health_record (>=5 tests each)
 */

import { createTestHarness, assert, assertEquals, assertContains } from '../harness/webmcp-test-shim.ts';

export async function runVaultToolsTests(): Promise<{ passed: number; failed: number; errors: string[] }> {
  let passed = 0;
  let failed = 0;
  const errors: string[] = [];

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      passed++;
    } catch (err: any) {
      failed++;
      errors.push(`[VaultTools] ${name}: ${err.message || err}`);
    }
  }

  // --- Tool 1: extract_fact (5 tests) ---
  await test('TC-V01-01: extract_fact - standard lab fact extraction with bounding box', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('extract_fact', { documentId: 'doc_discharge_cardiac_001', docType: 'discharge_summary' }, context);
    assert(res.success, 'Tool should return success');
    assert(Array.isArray(res.data), 'Data should be an array of extracted facts');
    const labFact = res.data.find((f: any) => f.name === 'Creatinine');
    assert(!!labFact, 'Creatinine fact must be present');
    assertEquals(labFact.boundingBox?.pageIndex, 1, 'Bounding box pageIndex should be 1');
    assertEquals(labFact.status, 'unconfirmed', 'Initial status must be unconfirmed');
  });

  await test('TC-V01-02: extract_fact - medication fact extraction with dosage and narration', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('extract_fact', { documentId: 'doc_discharge_cardiac_001' }, context);
    const apixaban = res.data.find((f: any) => f.name === 'Apixaban');
    assert(!!apixaban, 'Apixaban fact should be extracted');
    assertEquals(apixaban.value.dose, '5mg', 'Apixaban dose should be 5mg');
    assertContains(apixaban.plainExplanation, 'blood thinner', 'Plain explanation should mention blood thinner');
  });

  await test('TC-V01-03: extract_fact - condition fact extraction with ICD10', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('extract_fact', { documentId: 'doc_consult_note_nephrology_006' }, context);
    const ckdFact = res.data.find((f: any) => f.name.includes('Chronic Kidney Disease'));
    assert(!!ckdFact, 'CKD fact should be extracted');
    assertEquals(ckdFact.boundingBox.pageIndex, 1);
  });

  await test('TC-V01-04: extract_fact - homelab photo slip extraction with normalized eGFR', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('extract_fact', { documentId: 'doc_homelab_slip_002' }, context);
    const egfrFact = res.data.find((f: any) => f.name === 'eGFR');
    assert(!!egfrFact, 'eGFR fact should be extracted');
    assertEquals(egfrFact.value, 28, 'eGFR value must be 28');
  });

  await test('TC-V01-05: extract_fact - missing documentId validation error', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('extract_fact', {}, context);
    assert(!res.success, 'Should fail validation without documentId');
    assertEquals(res.error?.code, 'INVALID_PARAMS');
  });

  // --- Tool 2: confirm_fact (5 tests) ---
  await test('TC-V02-01: confirm_fact - approve fact commits to confirmed state and propagates', async () => {
    const { engine, context, vault } = createTestHarness();
    await engine.execute('extract_fact', { documentId: 'doc_discharge_cardiac_001' }, context);

    const res = await engine.execute('confirm_fact', { factId: 'fact_shanti_med_apixaban', action: 'approve' }, context);
    assert(res.success, 'Confirm should succeed');
    assertEquals(res.data.status, 'confirmed', 'Fact should be confirmed');

    const medInVault = vault.getMedications(context.patientId).find(m => m.genericName === 'Apixaban');
    assert(!!medInVault, 'Confirmed medication fact must propagate to meds store');
  });

  await test('TC-V02-02: confirm_fact - reject fact marks rejected and prevents propagation', async () => {
    const { engine, context, vault } = createTestHarness();
    await engine.execute('extract_fact', { documentId: 'doc_discharge_cardiac_001' }, context);

    const res = await engine.execute('confirm_fact', { factId: 'fact_shanti_med_atorvastatin', action: 'reject' }, context);
    assert(res.success, 'Reject should succeed');
    assertEquals(res.data.status, 'rejected', 'Fact status must be rejected');

    const confirmedMeds = vault.getFactsByPatient(context.patientId, 'confirmed');
    assert(!confirmedMeds.some(f => f.id === 'fact_shanti_med_atorvastatin'), 'Rejected fact must not be in confirmed list');
  });

  await test('TC-V02-03: confirm_fact - in-line edit and approve overwrites value with audit trail', async () => {
    const { engine, context } = createTestHarness();
    await engine.execute('extract_fact', { documentId: 'doc_discharge_cardiac_001' }, context);

    const res = await engine.execute('confirm_fact', { factId: 'fact_shanti_med_metformin', action: 'edit', edits: { dose: '500mg' } }, context);
    assert(res.success, 'Edit and approve should succeed');
    assertEquals(res.data.value.dose, '500mg', 'Dose should be updated to 500mg');
    assertEquals(res.data.status, 'confirmed', 'Status should be confirmed');
  });

  await test('TC-V02-04: confirm_fact - non-existent fact ID error handling', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('confirm_fact', { factId: 'fact_non_existent_9999', action: 'approve' }, context);
    assert(!res.success, 'Should return error for missing fact');
    assertEquals(res.error?.code, 'FACT_NOT_FOUND');
  });

  await test('TC-V02-05: confirm_fact - validation rejects missing action parameter', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('confirm_fact', { factId: 'fact_1' }, context);
    assert(!res.success, 'Validation should fail if action is missing');
    assertEquals(res.error?.code, 'INVALID_PARAMS');
  });

  // --- Tool 3: compile_health_record (5 tests) ---
  await test('TC-V03-01: compile_health_record - full lifetime compilation aggregates all stores', async () => {
    const { engine, context } = createTestHarness();
    await engine.execute('extract_fact', { documentId: 'doc_discharge_cardiac_001' }, context);
    await engine.execute('confirm_fact', { factId: 'fact_shanti_med_apixaban', action: 'approve' }, context);

    const res = await engine.execute('compile_health_record', { patientId: context.patientId, sections: ['all'] }, context);
    assert(res.success, 'Compilation should succeed');
    assert(!!res.data.patientProfile, 'Profile must be present');
    assert(Array.isArray(res.data.activeMedications), 'Active meds must be present');
    assert(Array.isArray(res.data.sourceDocumentCitations), 'Citations must be present');
  });

  await test('TC-V03-02: compile_health_record - privacy exclusion of unconfirmed and rejected facts', async () => {
    const { engine, context } = createTestHarness();
    await engine.execute('extract_fact', { documentId: 'doc_discharge_cardiac_001' }, context);
    await engine.execute('confirm_fact', { factId: 'fact_shanti_med_lisinopril_stop', action: 'reject' }, context);

    const res = await engine.execute('compile_health_record', { patientId: context.patientId }, context);
    const citations = res.data.sourceDocumentCitations;
    assert(!citations.some((c: any) => c.citationId === 'cite_fact_shanti_med_lisinopril_stop'), 'Rejected facts must be excluded from citations');
  });

  await test('TC-V03-03: compile_health_record - source link preservation with exact coordinates', async () => {
    const { engine, context } = createTestHarness();
    await engine.execute('extract_fact', { documentId: 'doc_discharge_cardiac_001' }, context);
    await engine.execute('confirm_fact', { factId: 'fact_shanti_med_apixaban', action: 'approve' }, context);

    const res = await engine.execute('compile_health_record', { patientId: context.patientId }, context);
    const apixabanCite = res.data.sourceDocumentCitations.find((c: any) => c.factName === 'Apixaban');
    assert(!!apixabanCite, 'Apixaban citation must be present');
    assertEquals(apixabanCite.boundingBox.pageIndex, 1);
    assertEquals(apixabanCite.boundingBox.x, 85);
  });

  await test('TC-V03-04: compile_health_record - empty vault returns valid empty schema without crash', async () => {
    const { engine, context } = createTestHarness('p_new_empty_patient');
    const res = await engine.execute('compile_health_record', { patientId: 'p_new_empty_patient' }, context);
    assert(res.success, 'Should succeed on empty vault');
    assertEquals(res.data.activeMedications.length, 0);
  });

  await test('TC-V03-05: compile_health_record - validation rejects missing patientId', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('compile_health_record', {}, context);
    assert(!res.success, 'Validation should fail when patientId is missing');
    assertEquals(res.error?.code, 'INVALID_PARAMS');
  });

  return { passed, failed, errors };
}
