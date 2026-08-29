/**
 * Tier 1 Unit Tests: Safety Alerts, Doctor Remote Pillbox & Calendar (M5)
 * Tools: report_danger_sign, notify_doctor, doctor_add_medication, doctor_remove_medication, doctor_change_dose,
 *        approve_pillmap_change, schedule_followup, schedule_lab, sync_to_calendar (>=5 tests each)
 */
import { createTestHarness, assert, assertEquals, assertContains } from '../harness/webmcp-test-shim.ts';
export async function runSafetyToolsTests() {
    let passed = 0;
    let failed = 0;
    const errors = [];
    async function test(name, fn) {
        try {
            await fn();
            passed++;
        }
        catch (err) {
            failed++;
            errors.push(`[SafetyTools] ${name}: ${err.message || err}`);
        }
    }
    // --- Tool 1: report_danger_sign (5 tests) ---
    await test('TC-SF01-01: report_danger_sign - acute pedal edema and breathlessness triage report', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('report_danger_sign', {
            symptomTags: ['edema_feet', 'dyspnea'],
            freeText: 'Feet are noticeably swollen since yesterday, shoes will not fit.',
            severityRating: 'severe',
            photoBlob: 'data:image/jpeg;base64,swollen_feet_photo'
        }, context);
        assert(res.success);
        assertEquals(res.data.triagePriority, 'URGENT');
        assertContains(res.data.firstAidAdvice, 'triage queue');
    });
    await test('TC-SF01-02: report_danger_sign - logs incident to LocalVault audit trail', async () => {
        const { engine, context, vault } = createTestHarness();
        await engine.execute('report_danger_sign', { symptomTags: ['chest_pain'], severityRating: 'critical' }, context);
        const audits = vault.auditLog.filter(a => a.action === 'report_danger_sign');
        assert(audits.length >= 1);
    });
    await test('TC-SF01-03: report_danger_sign - captures vital signs in report payload', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('report_danger_sign', {
            symptomTags: ['dizziness'],
            vitalSigns: { systolicBP: 185, diastolicBP: 115, heartRate: 98 }
        }, context);
        assert(res.success);
        assertEquals(res.data.vitalSigns.systolicBP, 185);
    });
    await test('TC-SF01-04: report_danger_sign - attaches photo reference', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('report_danger_sign', {
            symptomTags: ['edema_feet'],
            photoBlob: 'data:image/jpeg;base64,edema_photo'
        }, context);
        assert(res.success);
        assert(!!res.data.photoAttachment);
    });
    await test('TC-SF01-05: report_danger_sign - validation rejects missing symptomTags', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('report_danger_sign', {}, context);
        assert(!res.success);
        assertEquals(res.error?.code, 'INVALID_PARAMS');
    });
    // --- Tool 2: notify_doctor (5 tests) ---
    await test('TC-SF02-01: notify_doctor - URGENT priority triage alert push', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('notify_doctor', { priority: 'URGENT', alertPayload: { symptoms: ['edema'] } }, context);
        assert(res.success);
        assertEquals(res.data.priority, 'URGENT');
        assertEquals(res.data.status, 'delivered_to_doctor_inbox');
    });
    await test('TC-SF02-02: notify_doctor - EMERGENCY priority alert routing', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('notify_doctor', { priority: 'EMERGENCY' }, context);
        assert(res.success);
        assertEquals(res.data.priority, 'EMERGENCY');
    });
    await test('TC-SF02-03: notify_doctor - ROUTINE priority queue routing', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('notify_doctor', { priority: 'ROUTINE' }, context);
        assert(res.success);
        assertEquals(res.data.priority, 'ROUTINE');
    });
    await test('TC-SF02-04: notify_doctor - plain summary confirms delivery', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('notify_doctor', { priority: 'URGENT' }, context);
        assert(res.success);
        assertContains(res.plainLanguageSummary, 'delivered to Dr. Patel');
    });
    await test('TC-SF02-05: notify_doctor - validation rejects missing priority', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('notify_doctor', {}, context);
        assert(!res.success);
        assertEquals(res.error?.code, 'INVALID_PARAMS');
    });
    // --- Tool 3: doctor_add_medication (5 tests) ---
    await test('TC-SF03-01: doctor_add_medication - stages new diuretic proposal', async () => {
        const { engine, context } = createTestHarness('p_devi_78', 'doctor');
        const res = await engine.execute('doctor_add_medication', {
            medName: 'Furosemide',
            dose: '20mg',
            slot: 'morning',
            reason: 'Acute fluid overload / peripheral edema'
        }, context);
        assert(res.success);
        assertEquals(res.data.type, 'add_med');
        assertEquals(res.data.status, 'pending');
    });
    await test('TC-SF03-02: doctor_add_medication - includes clinical reason in narration', async () => {
        const { engine, context } = createTestHarness('p_devi_78', 'doctor');
        const res = await engine.execute('doctor_add_medication', {
            medName: 'Metoprolol',
            dose: '25mg',
            reason: 'Rate control'
        }, context);
        assert(res.success);
        assertContains(res.data.plainNarration, 'Rate control');
    });
    await test('TC-SF03-03: doctor_add_medication - defaults slot to morning if omitted', async () => {
        const { engine, context } = createTestHarness('p_devi_78', 'doctor');
        const res = await engine.execute('doctor_add_medication', {
            medName: 'Potassium Chloride',
            dose: '20mEq',
            reason: 'Diuretic supplement'
        }, context);
        assert(res.success);
        assertEquals(res.data.proposedSlot, 'morning');
    });
    await test('TC-SF03-04: doctor_add_medication - saves in LocalVault proposals store', async () => {
        const { engine, context, vault } = createTestHarness('p_devi_78', 'doctor');
        const res = await engine.execute('doctor_add_medication', {
            medName: 'Furosemide',
            dose: '40mg',
            reason: 'Edema'
        }, context);
        assert(res.success);
        const prop = vault.proposals.get(res.data.id);
        assert(!!prop);
    });
    await test('TC-SF03-05: doctor_add_medication - validation rejects missing dose', async () => {
        const { engine, context } = createTestHarness('p_devi_78', 'doctor');
        const res = await engine.execute('doctor_add_medication', { medName: 'Furosemide', reason: 'Edema' }, context);
        assert(!res.success);
        assertEquals(res.error?.code, 'INVALID_PARAMS');
    });
    // --- Tool 4: doctor_remove_medication (5 tests) ---
    await test('TC-SF04-01: doctor_remove_medication - emergency stop proposal for offending NSAID Ibuprofen', async () => {
        const { engine, context } = createTestHarness('p_devi_78', 'doctor');
        const res = await engine.execute('doctor_remove_medication', {
            medName: 'Ibuprofen',
            reason: 'Fluid retention and acute renal strain on underlying CKD'
        }, context);
        assert(res.success);
        assertEquals(res.data.type, 'remove_med');
        assertEquals(res.data.status, 'pending');
        assertContains(res.data.plainNarration, 'STOPPING Ibuprofen');
    });
    await test('TC-SF04-02: doctor_remove_medication - stops anticoagulant for active bleeding report', async () => {
        const { engine, context } = createTestHarness('p_devi_78', 'doctor');
        const res = await engine.execute('doctor_remove_medication', {
            medName: 'Apixaban',
            reason: 'Active GI bleeding'
        }, context);
        assert(res.success);
        assertEquals(res.data.medName, 'Apixaban');
    });
    await test('TC-SF04-03: doctor_remove_medication - requires detailed clinical reason >= 5 characters', async () => {
        const { engine, context } = createTestHarness('p_devi_78', 'doctor');
        const res = await engine.execute('doctor_remove_medication', { medName: 'Ibuprofen', reason: 'no' }, context);
        assert(!res.success);
        assertEquals(res.error?.code, 'INVALID_REASON');
    });
    await test('TC-SF04-04: doctor_remove_medication - saves in proposals store awaiting patient approval', async () => {
        const { engine, context, vault } = createTestHarness('p_devi_78', 'doctor');
        const res = await engine.execute('doctor_remove_medication', { medName: 'Advil', reason: 'Acute kidney injury' }, context);
        assert(res.success);
        const inVault = vault.proposals.get(res.data.id);
        assert(!!inVault);
        assertEquals(inVault.status, 'pending');
    });
    await test('TC-SF04-05: doctor_remove_medication - validation rejects missing medName', async () => {
        const { engine, context } = createTestHarness('p_devi_78', 'doctor');
        const res = await engine.execute('doctor_remove_medication', { reason: 'Side effect' }, context);
        assert(!res.success);
        assertEquals(res.error?.code, 'INVALID_PARAMS');
    });
    // --- Tool 5: doctor_change_dose (5 tests) ---
    await test('TC-SF05-01: doctor_change_dose - titrates medication dose in response to safety alert', async () => {
        const { engine, context } = createTestHarness('p_devi_78', 'doctor');
        const res = await engine.execute('doctor_change_dose', {
            medName: 'Furosemide',
            newDose: '80mg QD',
            reason: 'Temporary dose doubling for 3 days to resolve fluid retention'
        }, context);
        assert(res.success);
        assertEquals(res.data.proposedDose, '80mg QD');
    });
    await test('TC-SF05-02: doctor_change_dose - reduces antihypertensive for hypotension', async () => {
        const { engine, context } = createTestHarness('p_devi_78', 'doctor');
        const res = await engine.execute('doctor_change_dose', {
            medName: 'Carvedilol',
            newDose: '6.25mg BID',
            reason: 'Symptomatic dizziness and systolic BP < 100'
        }, context);
        assert(res.success);
        assertEquals(res.data.proposedDose, '6.25mg BID');
    });
    await test('TC-SF05-03: doctor_change_dose - narration explains dose adjustment', async () => {
        const { engine, context } = createTestHarness('p_devi_78', 'doctor');
        const res = await engine.execute('doctor_change_dose', {
            medName: 'Metformin',
            newDose: '500mg QD',
            reason: 'Renal clearance decrease'
        }, context);
        assert(res.success);
        assertContains(res.data.plainNarration, 'adjusted Metformin');
    });
    await test('TC-SF05-04: doctor_change_dose - creates proposal in vault', async () => {
        const { engine, context, vault } = createTestHarness('p_devi_78', 'doctor');
        const res = await engine.execute('doctor_change_dose', {
            medName: 'Atorvastatin',
            newDose: '20mg QHS',
            reason: 'Muscle aches'
        }, context);
        assert(res.success);
        assert(vault.proposals.has(res.data.id));
    });
    await test('TC-SF05-05: doctor_change_dose - validation rejects missing newDose', async () => {
        const { engine, context } = createTestHarness('p_devi_78', 'doctor');
        const res = await engine.execute('doctor_change_dose', { medName: 'Metformin', reason: 'renal' }, context);
        assert(!res.success);
        assertEquals(res.error?.code, 'INVALID_PARAMS');
    });
    // --- Tool 6: approve_pillmap_change (5 tests) ---
    await test('TC-SF06-01: approve_pillmap_change - patient approves doctor NSAID removal and updates vault', async () => {
        const { engine, context, vault } = createTestHarness();
        vault.addMedication({
            id: 'med_ibuprofen',
            patientId: context.patientId,
            genericName: 'Ibuprofen',
            dosage: '400mg',
            frequency: 'TID PRN',
            timingSlots: ['morning', 'noon', 'evening'],
            withFood: true,
            status: 'active'
        }, { userId: 'u1', userName: 'User', role: 'patient' });
        const removeRes = await engine.execute('doctor_remove_medication', {
            medName: 'Ibuprofen',
            reason: 'Fluid retention & AKI risk'
        }, context);
        const approveRes = await engine.execute('approve_pillmap_change', {
            actionId: removeRes.data.id,
            action: 'approve'
        }, context);
        assert(approveRes.success);
        assertEquals(approveRes.data.status, 'approved');
        const medInVault = vault.getMedications(context.patientId).find(m => m.genericName === 'Ibuprofen');
        assertEquals(medInVault?.status, 'discontinued');
    });
    await test('TC-SF06-02: approve_pillmap_change - caregiver proxy approval', async () => {
        const { engine, context } = createTestHarness('p_devi_78', 'caregiver');
        const removeRes = await engine.execute('doctor_remove_medication', { medName: 'Aleve', reason: 'Renal strain' }, context);
        const approveRes = await engine.execute('approve_pillmap_change', {
            actionId: removeRes.data.id,
            action: 'approve',
            approvedBy: 'Raj Devi'
        }, context);
        assert(approveRes.success);
        assertEquals(approveRes.data.status, 'approved');
    });
    await test('TC-SF06-03: approve_pillmap_change - rejection handling', async () => {
        const { engine, context } = createTestHarness();
        const removeRes = await engine.execute('doctor_remove_medication', { medName: 'Aspirin', reason: 'Minor bruising' }, context);
        const res = await engine.execute('approve_pillmap_change', { actionId: removeRes.data.id, action: 'reject' }, context);
        assert(res.success);
        assertEquals(res.data.status, 'rejected');
    });
    await test('TC-SF06-04: approve_pillmap_change - non-existent action ID error', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('approve_pillmap_change', { actionId: 'act_unknown_000' }, context);
        assert(!res.success);
        assertEquals(res.error?.code, 'ACTION_NOT_FOUND');
    });
    await test('TC-SF06-05: approve_pillmap_change - validation rejects missing actionId', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('approve_pillmap_change', {}, context);
        assert(!res.success);
        assertEquals(res.error?.code, 'INVALID_PARAMS');
    });
    // --- Tool 7: schedule_followup (5 tests) ---
    await test('TC-SF07-01: schedule_followup - 3-day urgent clinic follow-up booking', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('schedule_followup', {
            date: '+3d',
            appointmentType: 'in_person_clinic',
            reason: 'Edema and renal function evaluation',
            providerName: 'Dr. A. Patel, MD'
        }, context);
        assert(res.success);
        assertEquals(res.data.eventType, 'doctor_followup');
        assertContains(res.data.title, 'Follow-up');
    });
    await test('TC-SF07-02: schedule_followup - telehealth video consultation booking', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('schedule_followup', {
            date: '2026-09-05T10:00:00Z',
            appointmentType: 'telehealth_video',
            reason: 'Medication titration review'
        }, context);
        assert(res.success);
        assertEquals(res.data.reason, 'Medication titration review');
    });
    await test('TC-SF07-03: schedule_followup - configures 24h & 2h reminder schedule', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('schedule_followup', { date: '+3d', reason: 'Post-discharge check' }, context);
        assert(res.success);
        assertEquals(res.data.notifyHoursBefore.length, 2);
        assertEquals(res.data.notifyHoursBefore[0], 24);
    });
    await test('TC-SF07-04: schedule_followup - saves in LocalVault calendar events', async () => {
        const { engine, context, vault } = createTestHarness();
        await engine.execute('schedule_followup', { date: '+3d', reason: 'Renal check' }, context);
        const events = vault.getCalendarEvents(context.patientId);
        assert(events.some(e => e.eventType === 'doctor_followup'));
    });
    await test('TC-SF07-05: schedule_followup - validation rejects missing date', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('schedule_followup', { reason: 'check' }, context);
        assert(!res.success);
        assertEquals(res.error?.code, 'INVALID_PARAMS');
    });
    // --- Tool 8: schedule_lab (5 tests) ---
    await test('TC-SF08-01: schedule_lab - 4-week repeat Creatinine & Potassium cadence', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('schedule_lab', {
            cadence: '4_weeks',
            testPanel: 'Serum Creatinine & Potassium'
        }, context);
        assert(res.success);
        assertEquals(res.data.testPanel, 'Serum Creatinine & Potassium');
        assertEquals(res.data.status, 'due_soon');
    });
    await test('TC-SF08-02: schedule_lab - 3-month HbA1c panel scheduling', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('schedule_lab', {
            cadence: '3_months',
            testPanel: 'HbA1c & Fasting Lipids'
        }, context);
        assert(res.success);
        assertEquals(res.data.testPanel, 'HbA1c & Fasting Lipids');
    });
    await test('TC-SF08-03: schedule_lab - saves due card into vault', async () => {
        const { engine, context, vault } = createTestHarness();
        const res = await engine.execute('schedule_lab', { testPanel: 'Renal Function Panel' }, context);
        assert(res.success);
        assert(vault.dueCards.has(res.data.id));
    });
    await test('TC-SF08-04: schedule_lab - plain narration confirms target date', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('schedule_lab', { testPanel: 'BMP' }, context);
        assert(res.success);
        assertContains(res.plainLanguageSummary, 'BMP');
    });
    await test('TC-SF08-05: schedule_lab - validation rejects missing testPanel', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('schedule_lab', {}, context);
        assert(!res.success);
        assertEquals(res.error?.code, 'INVALID_PARAMS');
    });
    // --- Tool 9: sync_to_calendar (5 tests) ---
    await test('TC-SF09-01: sync_to_calendar - RFC 5545 iCalendar ICS payload generation', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('sync_to_calendar', { eventId: 'evt_followup_001' }, context);
        assert(res.success);
        assertContains(res.data.icsData, 'BEGIN:VCALENDAR');
        assertContains(res.data.icsData, 'BEGIN:VEVENT');
        assertContains(res.data.icsData, 'VALARM');
    });
    await test('TC-SF09-02: sync_to_calendar - multi-recipient sync to patient and caregiver', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('sync_to_calendar', {
            eventId: 'evt_followup_001',
            recipients: ['patient', 'caregiver_raj']
        }, context);
        assert(res.success);
        assertEquals(res.data.syncedRecipients.length, 2);
    });
    await test('TC-SF09-03: sync_to_calendar - Google Calendar web intent URI generation', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('sync_to_calendar', { eventId: 'evt_followup_001' }, context);
        assert(res.success);
        assertContains(res.data.googleCalendarIntent, 'calendar.google.com');
    });
    await test('TC-SF09-04: sync_to_calendar - VALARM 24h and 2h trigger offsets', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('sync_to_calendar', { eventId: 'evt_followup_001' }, context);
        assert(res.success);
        assertContains(res.data.icsData, '-P1D');
        assertContains(res.data.icsData, '-PT2H');
    });
    await test('TC-SF09-05: sync_to_calendar - validation rejects missing eventId', async () => {
        const { engine, context } = createTestHarness();
        const res = await engine.execute('sync_to_calendar', {}, context);
        assert(!res.success);
        assertEquals(res.error?.code, 'INVALID_PARAMS');
    });
    return { passed, failed, errors };
}
