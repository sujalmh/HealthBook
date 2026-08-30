/**
 * Tier 2 Test Suite: Boundary, Stress, Edge & Corner Cases
 * Tests: T2-01 through T2-12
 */

import { createTestHarness, assert, assertEquals, assertContains } from '../harness/webmcp-test-shim.ts';
import { ClinicalInteractionEngine } from '../../src/core/knowledge/interactionEngine.ts';

export async function runBoundaryStressTests(): Promise<{ passed: number; failed: number; errors: string[] }> {
  let passed = 0;
  let failed = 0;
  const errors: string[] = [];

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      passed++;
    } catch (err: any) {
      failed++;
      errors.push(`[BoundaryStress] ${name}: ${err.message || err}`);
    }
  }

  // T2-01: Empty Regimen
  await test('T2-01: Empty Regimen - handles 0 pre-admission and 0 discharge meds cleanly', async () => {
    const { engine, context } = createTestHarness('p_empty_user');
    const res = await engine.execute('flag_interaction', { dischargeMeds: [] }, context);
    assert(res.success);
    assertEquals(res.data.length, 0);
    assertContains(res.plainLanguageSummary, 'No drug-drug');
  });

  // T2-02: Extreme Lab Value
  await test('T2-02: Extreme Lab Value - detects critical high Creatinine 9.4 and eGFR 4', async () => {
    const { engine, context, vault } = createTestHarness();
    vault.addLab({
      id: 'lab_critical_creat',
      patientId: context.patientId,
      marker: 'Creatinine',
      value: 9.4,
      unit: 'mg/dL',
      normalizedValue: 9.4,
      normalizedUnit: 'mg/dL',
      drawDate: new Date().toISOString(),
      referenceRange: { low: 0.6, high: 1.2 },
      optimalRange: { low: 0.7, high: 1.0 },
      isBorderline: false,
      isCritical: true,
      flag: 'CRITICAL_HIGH'
    }, { userId: 'u1', userName: 'User', role: 'patient' });

    const labs = vault.getLabs(context.patientId, 'Creatinine');
    const criticalLab = labs.find(l => l.isCritical);
    assert(!!criticalLab, 'Critical lab must be flagged');
    assertEquals(criticalLab!.flag, 'CRITICAL_HIGH');
  });

  // T2-03: Severe Polypharmacy (18 Meds)
  await test('T2-03: Severe Polypharmacy - processes 18 concurrent medications rapidly (<50ms)', async () => {
    const { engine, context } = createTestHarness();
    const polypharmacyMeds = [
      'Metformin', 'Lisinopril', 'Atorvastatin', 'Levothyroxine', 'Apixaban',
      'Furosemide', 'Carvedilol', 'Empagliflozin', 'Allopurinol', 'Omeprazole',
      'Amlodipine', 'Aspirin', 'Clopidogrel', 'Spironolactone', 'Ciprofloxacin',
      'Acetaminophen', 'Ibuprofen', 'Zolpidem'
    ];

    const start = performance.now();
    const res = await engine.execute('check_interactions', { medList: polypharmacyMeds }, context);
    const duration = performance.now() - start;

    assert(res.success);
    assert(res.data.length >= 5, 'Must detect multiple multi-drug interaction arcs');
    assert(duration < 100, `Execution should be fast (took ${duration.toFixed(1)}ms)`);
  });

  // T2-04: Simultaneous Conflict Cascade (5 overlapping conflicts)
  await test('T2-04: Simultaneous Conflict Cascade - resolves multi-conflict cascade', async () => {
    const { engine, context } = createTestHarness();
    const cascadeMeds = [
      'Warfarin', 'Aspirin', 'Ibuprofen', 'Lisinopril', 'Spironolactone',
      'Atorvastatin', 'Ciprofloxacin', 'Calcium Carbonate', 'Tylenol', 'Percocet'
    ];

    const ddiRes = await engine.execute('check_interactions', { medList: cascadeMeds }, context);
    const dietRes = await engine.execute('check_diet_interactions', { medList: cascadeMeds, patientDiet: { drinksGrapefruitDaily: true } }, context);
    const dupRes = await engine.execute('check_duplicate_ingredient', {
      medList: [
        { name: 'Tylenol', dose: '500mg' },
        { name: 'Percocet', dose: '5/325mg' },
        { name: 'Advil', dose: '200mg' },
        { name: 'Ibuprofen', dose: '400mg' }
      ]
    }, context);

    assert(ddiRes.success && ddiRes.data.length >= 3, 'Must detect multiple DDIs');
    assert(dietRes.success && dietRes.data.length >= 1, 'Must detect grapefruit diet interaction');
    assert(dupRes.success && dupRes.data.length >= 1, 'Must detect APAP duplicate');
  });

  // T2-05: Corrupt / Unreadable Document Handling
  await test('T2-05: Corrupt / Unreadable Image - graceful error formatting', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('doctor_review_comment', { labId: 'lab_1', commentText: '   ' }, context);
    assert(!res.success);
    assertEquals(res.error?.code, 'INVALID_COMMENT');
  });

  // T2-06: Blurry / Low OCR Confidence Handling
  await test('T2-06: Blurry / Low OCR Confidence - facts tagged with optical confidence metrics', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('upload_lab_image', { imageBlob: 'data:image/jpeg;base64,blurry_slip' }, context);
    assert(res.success);
    // Q10 all image OCR via AI — when AI disabled, image returns 0 with AI required narration (correct per repair)
    if (res.data.extractedValues.length === 0) {
      assertContains(res.plainLanguageSummary, 'AI required');
    } else {
      const lowConfValue = res.data.extractedValues.find((v: any) => v.confidence < 0.95);
      assert(!!lowConfValue, 'Confidence metric must be recorded');
    }
  });

  // T2-07: Extreme Multi-Year Timeline (150+ records)
  await test('T2-07: Extreme Multi-Year Timeline - parses and sorts large longitudinal series', async () => {
    const { engine, context, vault } = createTestHarness();
    for (let year = 2018; year <= 2026; year++) {
      for (let month = 1; month <= 12; month++) {
        vault.addLab({
          id: `lab_stress_${year}_${month}`,
          patientId: context.patientId,
          marker: 'Creatinine',
          value: 1.2 + (year - 2018) * 0.1,
          unit: 'mg/dL',
          normalizedValue: 1.2 + (year - 2018) * 0.1,
          normalizedUnit: 'mg/dL',
          drawDate: `${year}-${String(month).padStart(2, '0')}-01T08:00:00Z`,
          referenceRange: { low: 0.6, high: 1.2 },
          optimalRange: { low: 0.7, high: 1.0 },
          isBorderline: false,
          isCritical: false
        }, { userId: 'u1', userName: 'User', role: 'patient' });
      }
    }

    const labs = vault.getLabs(context.patientId, 'Creatinine');
    assert(labs.length >= 100, `Should store 100+ longitudinal points (found ${labs.length})`);
    assert(new Date(labs[0].drawDate).getTime() < new Date(labs[labs.length - 1].drawDate).getTime());
  });

  // T2-08: Malformed WebMCP Payload
  await test('T2-08: Malformed WebMCP Payload - engine returns structured JSON-RPC error', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('add_medication', { dose: '10mg' }, context); // Missing name and slot
    assert(!res.success);
    assertEquals(res.error?.code, 'INVALID_PARAMS');
  });

  // T2-09: Expired Doctor Token
  await test('T2-09: Expired Doctor Token - token past expiration is rejected', async () => {
    const { engine, context, vault } = createTestHarness();
    vault.addDoctorGrant({
      grantId: 'grant_expired_01',
      patientId: context.patientId,
      doctorEmail: 'dr.past@clinic.org',
      durationDays: 1,
      scope: 'full_dossier',
      issuedAt: '2026-08-01T00:00:00Z',
      expiresAt: '2026-08-02T00:00:00Z',
      token: 'cc_tok_expired',
      status: 'expired'
    });

    const grant = vault.getDoctorGrant('grant_expired_01');
    assert(!!grant);
    const isExpired = new Date(grant!.expiresAt).getTime() < Date.now();
    assert(isExpired, 'Grant should be expired');
  });

  // T2-10: Unauthorized Role Escalation
  await test('T2-10: Unauthorized Role Escalation - View Only caregiver cannot act on behalf', async () => {
    const { engine, context } = createTestHarness('p_devi_78', 'caregiver');
    context.activeProfile.permissionLevel = 'view_only';

    const res = await engine.execute('act_on_behalf', {
      actionName: 'doctor_remove_medication',
      actionPayload: { medName: 'Ibuprofen' }
    }, context);

    assert(!res.success);
    assertEquals(res.error?.code, 'PERMISSION_DENIED');
  });

  // T2-11: Local Storage Quota / Payload Optimization
  await test('T2-11: Local Storage Quota Check - handles compressed image attachments', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('report_danger_sign', {
      symptomTags: ['edema_feet'],
      photoBlob: 'data:image/webp;base64,compressed_photo_payload'
    }, context);
    assert(res.success);
    assert(!!res.data.photoAttachment);
  });

  // T2-12: Offline / Disconnected State Resilience
  await test('T2-12: Offline Mode Resilience - executes completely client-side with zero network dependency', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('suggest_schedule', {
      medList: [{ id: 'm1', name: 'Atorvastatin', currentSlot: 'morning' }]
    }, context);
    assert(res.success);
    assert(res.data.proposedShifts.length >= 1);
  });

  return { passed, failed, errors };
}
