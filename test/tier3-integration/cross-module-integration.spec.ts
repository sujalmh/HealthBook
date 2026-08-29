/**
 * Tier 3 Test Suite: Cross-Module Pairwise Integration Verification
 * Tests: INT-01 through INT-12 (12 Integration Channels)
 */

import { createTestHarness, assert, assertEquals, assertContains } from '../harness/webmcp-test-shim.ts';

export async function runCrossModuleIntegrationTests(): Promise<{ passed: number; failed: number; errors: string[] }> {
  let passed = 0;
  let failed = 0;
  const errors: string[] = [];

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      passed++;
    } catch (err: any) {
      failed++;
      errors.push(`[Integration] ${name}: ${err.message || err}`);
    }
  }

  // INT-01: Vault -> LabStory
  await test('INT-01: Vault -> LabStory - confirmed lab facts stream to timeseries while rejected are excluded', async () => {
    const { engine, context, vault } = createTestHarness();
    await engine.execute('extract_fact', { documentId: 'doc_discharge_cardiac_001' }, context);
    await engine.execute('confirm_fact', { factId: 'fact_shanti_lab_creat', action: 'approve' }, context);
    await engine.execute('confirm_fact', { factId: 'fact_shanti_lab_egfr', action: 'reject' }, context);

    const confirmedLabs = vault.getLabs(context.patientId, 'Creatinine');
    assert(confirmedLabs.length >= 1, 'Approved Creatinine lab must be in store');

    const confirmedEgfr = vault.getLabs(context.patientId, 'eGFR');
    assert(confirmedEgfr.length === 0, 'Rejected eGFR lab must NOT be in store');
  });

  // INT-02: Vault -> PillMap
  await test('INT-02: Vault -> PillMap - confirmed medication facts populate active PillMap canvas', async () => {
    const { engine, context, vault } = createTestHarness();
    await engine.execute('extract_fact', { documentId: 'doc_discharge_cardiac_001' }, context);
    await engine.execute('confirm_fact', { factId: 'fact_shanti_med_apixaban', action: 'approve' }, context);

    const activeMeds = vault.getMedications(context.patientId, 'active');
    const apixaban = activeMeds.find(m => m.genericName === 'Apixaban');
    assert(!!apixaban, 'Apixaban must populate active medications in PillMap');
    assertEquals(apixaban!.dosage, '5mg');
  });

  // INT-03: Vault -> RxBridge
  await test('INT-03: Vault -> RxBridge - reads baseline OTCs from Vault and checks discharge cross-talk', async () => {
    const { engine, context, vault } = createTestHarness();
    vault.addMedication({
      id: 'med_home_fishoil',
      patientId: context.patientId,
      genericName: 'Fish Oil',
      brandName: 'OTC Fish Oil',
      dosage: '1000mg',
      frequency: 'QD',
      timingSlots: ['morning'],
      withFood: true,
      status: 'active'
    }, { userId: 'u1', userName: 'User', role: 'patient' });

    const res = await engine.execute('flag_interaction', {
      dischargeMeds: ['Apixaban'],
      preAdmitOTCs: ['OTC Fish Oil']
    }, context);

    assert(res.success);
    assert(res.data.length >= 1, 'Must detect bleeding risk between discharge Apixaban and Vault home OTC Fish Oil');
  });

  // INT-04: LabStory -> RxBridge
  await test('INT-04: LabStory -> RxBridge - recent renal lab results contextualize medication discontinuation', async () => {
    const { engine, context } = createTestHarness();
    await engine.execute('extract_labs', { documentId: 'doc_historical_labs_2022_2026' }, context);

    const res = await engine.execute('explain_med_change', {
      medName: 'Lisinopril',
      preHospDose: '20mg',
      inHospAction: 'Held due to eGFR 32',
      dischargeDose: '0mg'
    }, context);

    assert(res.success);
    assertEquals(res.data.statusBadge, 'STOPPED');
    assertContains(res.data.plainLanguageExplanation, 'kidney function');
  });

  // INT-05: RxBridge -> PillMap
  await test('INT-05: RxBridge -> PillMap - reconciled discharge list initializes Day 0 PillMap with meal badges', async () => {
    const { engine, context, vault } = createTestHarness();
    // Simulate reconciliation handoff
    const reconciledMeds = [
      { name: 'Apixaban', dose: '5mg', slot: 'morning' },
      { name: 'Metformin', dose: '1000mg', slot: 'morning', withFood: true },
      { name: 'Atorvastatin', dose: '40mg', slot: 'bedtime' },
      { name: 'Levothyroxine', dose: '75mcg', slot: 'morning' }
    ];

    for (const m of reconciledMeds) {
      await engine.execute('add_medication', m, context);
    }

    const activeMeds = vault.getMedications(context.patientId, 'active');
    assertEquals(activeMeds.length, 4);

    const dietRes = await engine.execute('check_diet_interactions', {
      medList: activeMeds.map(m => m.genericName),
      patientDiet: { drinksGrapefruitDaily: true }
    }, context);

    assert(dietRes.data.some((b: any) => b.drugName.includes('Atorvastatin')));
  });

  // INT-06: PillMap -> LabStory
  await test('INT-06: PillMap -> LabStory - active med schedules provide correlation context for biomarker charts', async () => {
    const { engine, context } = createTestHarness();
    await engine.execute('add_medication', { name: 'Metformin', dose: '1000mg', slot: 'morning' }, context);
    const corrRes = await engine.execute('correlate_meds', { biomarker: 'eGFR' }, context);
    assert(corrRes.success);
    assertContains(corrRes.data.causalStorySentence, 'Metformin');
  });

  // INT-07: HomeLab -> PillMap
  await test('INT-07: HomeLab -> PillMap - approved dosage proposal updates PillMap dose diff and pulses green', async () => {
    const { engine, context, vault } = createTestHarness();
    vault.addMedication({
      id: 'med_metformin',
      patientId: context.patientId,
      genericName: 'Metformin',
      dosage: '1000mg',
      frequency: 'BID',
      timingSlots: ['morning', 'evening'],
      withFood: true,
      status: 'active'
    }, { userId: 'u1', userName: 'User', role: 'patient' });

    const prop = await engine.execute('propose_dosage_change', {
      medName: 'Metformin',
      currentDose: '1000mg',
      proposedDose: '500mg',
      reason: 'eGFR 28'
    }, context);

    await engine.execute('approve_dosage_change', { proposalId: prop.data.id, action: 'approve' }, context);
    const syncRes = await engine.execute('sync_pillmap_from_proposal', { proposalId: prop.data.id }, context);

    assert(syncRes.success);
    assertEquals(syncRes.data.newDose, '500mg');
  });

  // INT-08: HomeLab -> LabStory
  await test('INT-08: HomeLab -> LabStory - dosage adjustment creates continuous labeled intervention band', async () => {
    const { engine, context } = createTestHarness();
    const prop = await engine.execute('propose_dosage_change', {
      medName: 'Metformin',
      proposedDose: '500mg',
      reason: 'eGFR 28'
    }, context);
    await engine.execute('approve_dosage_change', { proposalId: prop.data.id }, context);
    const syncRes = await engine.execute('sync_pillmap_from_proposal', { proposalId: prop.data.id }, context);

    assert(syncRes.success);
    assert(!!syncRes.data.labStoryInterventionBand);
    assertContains(syncRes.data.labStoryInterventionBand.medName, '500mg');
  });

  // INT-09: Safety -> PillMap
  await test('INT-09: Safety -> PillMap - remote NSAID removal deletes pill from canvas and clears arcs', async () => {
    const { engine, context, vault } = createTestHarness();
    vault.addMedication({
      id: 'med_ibuprofen',
      patientId: context.patientId,
      genericName: 'Ibuprofen',
      dosage: '400mg',
      frequency: 'TID',
      timingSlots: ['morning', 'noon', 'evening'],
      withFood: true,
      status: 'active'
    }, { userId: 'u1', userName: 'User', role: 'patient' });

    const remRes = await engine.execute('doctor_remove_medication', {
      medName: 'Ibuprofen',
      reason: 'Pedal edema and AKI risk'
    }, context);

    const appRes = await engine.execute('approve_pillmap_change', {
      actionId: remRes.data.id,
      action: 'approve'
    }, context);

    assert(appRes.success);
    const med = vault.getMedications(context.patientId).find(m => m.genericName === 'Ibuprofen');
    assertEquals(med?.status, 'discontinued');
  });

  // INT-10: Safety -> Calendar
  await test('INT-10: Safety -> Calendar - follow-up bookings sync to patient and caregiver calendar with alarms', async () => {
    const { engine, context } = createTestHarness();
    const folRes = await engine.execute('schedule_followup', {
      date: '+3d',
      reason: 'Edema check',
      providerName: 'Dr. Patel'
    }, context);

    const calRes = await engine.execute('sync_to_calendar', {
      eventId: folRes.data.id,
      recipients: ['patient', 'caregiver_raj']
    }, context);

    assert(calRes.success);
    assertContains(calRes.data.icsData, 'BEGIN:VCALENDAR');
    assertEquals(calRes.data.syncedRecipients.length, 2);
  });

  // INT-11: Care Circle -> All Modules
  await test('INT-11: Care Circle -> All Modules - proxy approvals inject immutable signature in audit trail', async () => {
    const { engine, context, vault } = createTestHarness('patient-s-devi', 'caregiver');
    context.activeProfile.onBehalfOf = 'Smt. Shanti Devi';

    const res = await engine.execute('act_on_behalf', {
      actionName: 'approve_dosage_change',
      actionPayload: { proposalId: 'prop_metformin_500' }
    }, context);

    assert(res.success);
    const audit = vault.auditLog.find(a => a.id === res.data.auditLogId);
    assert(!!audit);
    assertEquals(audit!.performedBy.userName, 'Raj Devi');
    assertEquals(audit!.performedBy.onBehalfOf, 'Smt. Shanti Devi');
  });

  // INT-12: Dossier -> Document Bounding Boxes
  await test('INT-12: Dossier -> Document Bounding Boxes - timeline queries return exact source coordinates', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('view_timeline', { itemId: 'fact_ckd_stage_3b_diagnosis' }, context);
    assert(res.success);
    assertEquals(res.data.documentId, 'doc_consult_note_nephrology_006');
    assertEquals(res.data.boundingBox.x, 120);
    assertEquals(res.data.boundingBox.y, 340);
    assertEquals(res.data.boundingBox.width, 220);
    assertEquals(res.data.boundingBox.height, 45);
  });

  return { passed, failed, errors };
}
