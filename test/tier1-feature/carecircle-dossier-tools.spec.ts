/**
 * Tier 1 Unit Tests: Family Care Circle & Continuity Dossier Module (M5 / M6)
 * Tools: link_patient, grant_caregiver_access, revoke_caregiver_access, switch_profile,
 *        act_on_behalf, grant_doctor_access, revoke_access, view_timeline (>=5 tests each)
 */

import { createTestHarness, assert, assertEquals, assertContains } from '../harness/webmcp-test-shim.ts';

export async function runCareCircleDossierToolsTests(): Promise<{ passed: number; failed: number; errors: string[] }> {
  let passed = 0;
  let failed = 0;
  const errors: string[] = [];

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      passed++;
    } catch (err: any) {
      failed++;
      errors.push(`[CareCircleDossierTools] ${name}: ${err.message || err}`);
    }
  }

  // --- Tool 1: link_patient (5 tests) — M3 real-data: generic patientName (vault-derived) ---
  await test('TC-FC01-01: link_patient - links patient profile with Manage permissions (real-data generic)', async () => {
    const { engine, context } = createTestHarness('user_raj_son', 'caregiver');
    const res = await engine.execute('link_patient', { patientId: 'p_devi_78', relationship: 'parent' }, context);
    assert(res.success);
    // M3 generic: patientName derived from activeProfile context, not hardcoded Shanti
    assert(res.data.patientName && typeof res.data.patientName === 'string' && res.data.patientName.length > 0, 'patientName should be non-empty generic');
    assertEquals(res.data.permissionLevel, 'manage');
  });

  await test('TC-FC01-02: link_patient - saves link in LocalVault care circle store', async () => {
    const { engine, context, vault } = createTestHarness('user_raj_son', 'caregiver');
    await engine.execute('link_patient', { patientId: 'p_devi_78', relationship: 'parent' }, context);
    const links = vault.getCaregiverLinks('p_devi_78');
    assert(links.length >= 1);
  });

  await test('TC-FC01-03: link_patient - handles pediatric or dependent profile linking', async () => {
    const { engine, context } = createTestHarness('user_parent', 'caregiver');
    const res = await engine.execute('link_patient', { patientId: 'p_child_01', relationship: 'child' }, context);
    assert(res.success);
    assertEquals(res.data.relationship, 'child');
  });

  await test('TC-FC01-04: link_patient - rejects invalid authorization token', async () => {
    const { engine, context } = createTestHarness('user_raj_son', 'caregiver');
    const res = await engine.execute('link_patient', { patientId: 'p_devi_78', relationship: 'parent', authToken: 'invalid_token' }, context);
    assert(!res.success);
    assertEquals(res.error?.code, 'AUTH_FAILED');
  });

  await test('TC-FC01-05: link_patient - validation rejects missing patientId', async () => {
    const { engine, context } = createTestHarness('user_raj_son', 'caregiver');
    const res = await engine.execute('link_patient', { relationship: 'parent' }, context);
    assert(!res.success);
    assertEquals(res.error?.code, 'INVALID_PARAMS');
  });

  // --- Tool 2: grant_caregiver_access (5 tests) ---
  await test('TC-FC02-01: grant_caregiver_access - configures View Only permission level', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('grant_caregiver_access', { caregiverId: 'user_raj_son', permissionLevel: 'view_only' }, context);
    assert(res.success);
    assertEquals(res.data.permissionLevel, 'view_only');
  });

  await test('TC-FC02-02: grant_caregiver_access - configures Manage permission level', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('grant_caregiver_access', { caregiverId: 'user_raj_son', permissionLevel: 'manage' }, context);
    assert(res.success);
    assertEquals(res.data.permissionLevel, 'manage');
  });

  await test('TC-FC02-03: grant_caregiver_access - configures Full permission level', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('grant_caregiver_access', { caregiverId: 'user_raj_son', permissionLevel: 'full' }, context);
    assert(res.success);
    assertEquals(res.data.permissionLevel, 'full');
  });

  await test('TC-FC02-04: grant_caregiver_access - plain narration confirms updated scope', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('grant_caregiver_access', { caregiverId: 'user_susan', permissionLevel: 'manage' }, context);
    assert(res.success);
    assertContains(res.plainLanguageSummary, 'manage');
  });

  await test('TC-FC02-05: grant_caregiver_access - validation rejects missing permissionLevel', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('grant_caregiver_access', { caregiverId: 'u1' }, context);
    assert(!res.success);
    assertEquals(res.error?.code, 'INVALID_PARAMS');
  });

  // --- Tool 3: revoke_caregiver_access (5 tests) ---
  await test('TC-FC03-01: revoke_caregiver_access - revokes access immediately', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('revoke_caregiver_access', { caregiverId: 'user_raj_son' }, context);
    assert(res.success);
    assertEquals(res.data.status, 'revoked');
  });

  await test('TC-FC03-02: revoke_caregiver_access - plain summary confirms user revoked', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('revoke_caregiver_access', { caregiverId: 'user_stranger' }, context);
    assert(res.success);
    assertContains(res.plainLanguageSummary, 'revoked');
  });

  await test('TC-FC03-03: revoke_caregiver_access - multiple calls are idempotent', async () => {
    const { engine, context } = createTestHarness();
    await engine.execute('revoke_caregiver_access', { caregiverId: 'user_raj_son' }, context);
    const res = await engine.execute('revoke_caregiver_access', { caregiverId: 'user_raj_son' }, context);
    assert(res.success);
  });

  await test('TC-FC03-04: revoke_caregiver_access - returns revoked payload', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('revoke_caregiver_access', { caregiverId: 'user_nurse' }, context);
    assert(res.success);
    assertEquals(res.data.caregiverId, 'user_nurse');
  });

  await test('TC-FC03-05: revoke_caregiver_access - validation rejects missing caregiverId', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('revoke_caregiver_access', {}, context);
    assert(!res.success);
    assertEquals(res.error?.code, 'INVALID_PARAMS');
  });

  // --- Tool 4: switch_profile (5 tests) ---
  await test('TC-FC04-01: switch_profile - switches active context from self to linked patient (generic)', async () => {
    const { engine, context } = createTestHarness('user_raj_son', 'caregiver');
    const res = await engine.execute('switch_profile', { targetPatientId: 'p_devi_78' }, context);
    assert(res.success);
    assertEquals(res.data.isProxyActive, true);
    assertEquals(context.patientId, 'p_devi_78');
    // M3 generic: patientName vault-derived, not hardcoded Shanti
    assert(res.data.patientName && res.data.patientName.length > 0, 'patientName should be generic non-empty');
  });

  await test('TC-FC04-02: switch_profile - switches back to self', async () => {
    const { engine, context } = createTestHarness('user_raj_son', 'caregiver');
    await engine.execute('switch_profile', { targetPatientId: 'p_devi_78' }, context);
    const res = await engine.execute('switch_profile', { targetPatientId: 'self' }, context);
    assert(res.success);
    assertEquals(res.data.isProxyActive, false);
    assertEquals(context.patientId, 'user_raj_son');
  });

  await test('TC-FC04-03: switch_profile - switches to linked patient profile (generic)', async () => {
    const { engine, context } = createTestHarness('user_susan_daughter', 'caregiver');
    const res = await engine.execute('switch_profile', { targetPatientId: 'p_jenkins_72' }, context);
    assert(res.success);
    assertEquals(context.patientId, 'p_jenkins_72');
    assert(res.data.patientName && res.data.patientName.length > 0, 'patientName should be generic');
  });

  await test('TC-FC04-04: switch_profile - triggers UI canvas re-renders', async () => {
    const { engine, context } = createTestHarness('user_raj_son', 'caregiver');
    const res = await engine.execute('switch_profile', { targetPatientId: 'p_devi_78' }, context);
    assert(res.success);
    assert(!!engine.getTool('switch_profile')?.uiSideEffects?.canvasRerenders?.includes('pillmap'));
  });

  await test('TC-FC04-05: switch_profile - validation rejects missing targetPatientId', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('switch_profile', {}, context);
    assert(!res.success);
    assertEquals(res.error?.code, 'INVALID_PARAMS');
  });

  // --- Tool 5: act_on_behalf (5 tests) ---
  await test('TC-FC03-01: act_on_behalf - caregiver executes audited proposal approval on behalf', async () => {
    const { engine, context, vault } = createTestHarness('p_devi_78', 'caregiver');
    context.activeProfile.onBehalfOf = 'Patient';

    const res = await engine.execute('act_on_behalf', {
      actionName: 'approve_dosage_change',
      actionPayload: { proposalId: 'prop_metformin_500' }
    }, context);
    assert(res.success);
    assert(!!res.data.signature);
    assert(res.data.performedBy.toLowerCase().includes('on behalf of'), `Expected on behalf of, got ${res.data.performedBy}`);
    assert(res.data.performedBy.includes('Patient') || res.data.performedBy.toLowerCase().includes('family'), `Expected Patient or family, got ${res.data.performedBy}`);

    const auditEntry = vault.auditLog.find(a => a.id === res.data.auditLogId);
    assert(!!auditEntry);
    assert(!!auditEntry && (auditEntry.performedBy.onBehalfOf === 'Patient' || !!auditEntry.performedBy.onBehalfOf?.toLowerCase().includes('patient')), `Expected Patient, got ${auditEntry?.performedBy.onBehalfOf}`);
  });

  await test('TC-FC03-02: act_on_behalf - blocks execution if caregiver permission level is View Only', async () => {
    const { engine, context } = createTestHarness('p_devi_78', 'caregiver');
    context.activeProfile.permissionLevel = 'view_only';

    const res = await engine.execute('act_on_behalf', {
      actionName: 'approve_dosage_change',
      actionPayload: { proposalId: 'prop_1' }
    }, context);
    assert(!res.success);
    assertEquals(res.error?.code, 'PERMISSION_DENIED');
  });

  await test('TC-FC03-03: act_on_behalf - audited danger sign report submission on behalf', async () => {
    const { engine, context } = createTestHarness('p_devi_78', 'caregiver');
    context.activeProfile.permissionLevel = 'manage';
    context.activeProfile.onBehalfOf = 'Smt. Shanti Devi';

    const res = await engine.execute('act_on_behalf', {
      actionName: 'report_danger_sign',
      actionPayload: { symptoms: ['edema_feet'], severity: 'severe' }
    }, context);
    assert(res.success);
    assert(!!res.data.auditLogId);
  });

  await test('TC-FC03-04: act_on_behalf - immutable signature hash generation', async () => {
    const { engine, context } = createTestHarness('p_devi_78', 'caregiver');
    const res = await engine.execute('act_on_behalf', {
      actionName: 'upload_lab_image',
      actionPayload: { imageId: 'img_slip_1' }
    }, context);
    assert(res.success);
    assertContains(res.data.signature, 'sha256_');
  });

  await test('TC-FC03-05: act_on_behalf - validation rejects missing actionName', async () => {
    const { engine, context } = createTestHarness('p_devi_78', 'caregiver');
    const res = await engine.execute('act_on_behalf', { actionPayload: {} }, context);
    assert(!res.success);
    assertEquals(res.error?.code, 'INVALID_PARAMS');
  });

  // --- Tool 6: grant_doctor_access (5 tests) ---
  await test('TC-CD01-01: grant_doctor_access - generates 7-day ephemeral token for Dr. Chen', async () => {
    const { engine, context, vault } = createTestHarness();
    const res = await engine.execute('grant_doctor_access', {
      doctorEmail: 'dr.chen@nephrology.org',
      durationDays: 7,
      scope: 'full_dossier'
    }, context);
    assert(res.success);
    assertContains(res.data.token, 'cc_tok_');
    assertEquals(res.data.durationDays, 7);
    assertEquals(res.data.status, 'active');

    const inVault = vault.getDoctorGrant(res.data.grantId);
    assert(!!inVault);
  });

  await test('TC-CD01-02: grant_doctor_access - emergency snapshot scope grant', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('grant_doctor_access', {
      doctorEmail: 'er.triage@hospital.org',
      durationDays: 1,
      scope: 'snapshot_only'
    }, context);
    assert(res.success);
    assertEquals(res.data.scope, 'snapshot_only');
  });

  await test('TC-CD01-03: grant_doctor_access - calculates expiration date correctly', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('grant_doctor_access', {
      doctorEmail: 'dr.evans@heart.org',
      durationDays: 14
    }, context);
    assert(res.success);
    const expTime = new Date(res.data.expiresAt).getTime();
    const now = Date.now();
    assert(expTime > now + 13 * 86400000);
  });

  await test('TC-CD01-04: grant_doctor_access - plain narration confirms doctor email and duration', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('grant_doctor_access', { doctorEmail: 'specialist@clinic.com' }, context);
    assert(res.success);
    assertContains(res.plainLanguageSummary, 'specialist@clinic.com');
  });

  await test('TC-CD01-05: grant_doctor_access - validation rejects missing doctorEmail', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('grant_doctor_access', {}, context);
    assert(!res.success);
    assertEquals(res.error?.code, 'INVALID_PARAMS');
  });

  // --- Tool 7: revoke_access (5 tests) ---
  await test('TC-CD01-06: revoke_access - immediately invalidates active doctor token', async () => {
    const { engine, context, vault } = createTestHarness();
    const grantRes = await engine.execute('grant_doctor_access', { doctorEmail: 'dr.chen@nephrology.org' }, context);
    const res = await engine.execute('revoke_access', { grantId: grantRes.data.grantId }, context);
    assert(res.success);
    assertEquals(res.data.status, 'revoked');

    const grant = vault.getDoctorGrant(grantRes.data.grantId);
    assertEquals(grant?.status, 'revoked');
  });

  await test('TC-CD01-07: revoke_access - plain summary confirms revocation', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('revoke_access', { grantId: 'grant_123' }, context);
    assert(res.success);
    assertContains(res.plainLanguageSummary, 'revoked');
  });

  await test('TC-CD01-08: revoke_access - sets revokedAt timestamp', async () => {
    const { engine, context, vault } = createTestHarness();
    const grantRes = await engine.execute('grant_doctor_access', { doctorEmail: 'dr.temp@clinic.org' }, context);
    await engine.execute('revoke_access', { grantId: grantRes.data.grantId }, context);
    const grant = vault.getDoctorGrant(grantRes.data.grantId);
    assert(!!grant?.revokedAt);
  });

  await test('TC-CD01-09: revoke_access - idempotent handling of non-existent ID', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('revoke_access', { grantId: 'grant_ghost_999' }, context);
    assert(res.success);
  });

  await test('TC-CD01-10: revoke_access - validation rejects missing grantId', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('revoke_access', {}, context);
    assert(!res.success);
    assertEquals(res.error?.code, 'INVALID_PARAMS');
  });

  // --- Tool 8: view_timeline (5 tests) ---
  await test('TC-CD02-01: view_timeline - returns exact bounding box for CKD 3b diagnosis in nephrology consult scan', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('view_timeline', { itemId: 'fact_ckd_stage_3b_diagnosis' }, context);
    assert(res.success);
    assertEquals(res.data.documentId, 'doc_consult_note_nephrology_006');
    assertEquals(res.data.boundingBox.x, 120);
    assertEquals(res.data.boundingBox.y, 340);
    assertEquals(res.data.boundingBox.width, 220);
    assertEquals(res.data.boundingBox.height, 45);
  });

  await test('TC-CD02-02: view_timeline - returns source bounding box for extracted fact in vault', async () => {
    const { engine, context } = createTestHarness();
    await engine.execute('extract_fact', { documentId: 'doc_discharge_cardiac_001' }, context);
    const res = await engine.execute('view_timeline', { itemId: 'fact_shanti_med_apixaban' }, context);
    assert(res.success);
    assertEquals(res.data.boundingBox.pageIndex, 1);
    assertEquals(res.data.boundingBox.x, 85);
  });

  await test('TC-CD02-03: view_timeline - returns snippet text for PDF viewer overlay', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('view_timeline', { itemId: 'fact_ckd_stage_3b_diagnosis' }, context);
    assert(res.success);
    assertContains(res.data.snippetText, 'Chronic Kidney Disease Stage 3b');
  });

  await test('TC-CD02-04: view_timeline - plain summary explains located document and coordinates', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('view_timeline', { itemId: 'fact_ckd_stage_3b_diagnosis' }, context);
    assert(res.success);
    assertContains(res.plainLanguageSummary, 'nephrology_consult_2024.pdf');
  });

  await test('TC-CD02-05: view_timeline - validation rejects missing itemId', async () => {
    const { engine, context } = createTestHarness();
    const res = await engine.execute('view_timeline', {}, context);
    assert(!res.success);
    assertEquals(res.error?.code, 'INVALID_PARAMS');
  });

  return { passed, failed, errors };
}
