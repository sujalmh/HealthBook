/**
 * Acceptance Flow D: Safety Alert Escalation & Doctor Remote Pill Adjustment
 * (Danger Sign Report -> Clinician Triage -> Remote NSAID Removal & 3-Day Follow-Up -> Multi-User Calendar Sync)
 * Automated Step-by-Step E2E Verification
 */
import { createTestHarness, assert, assertEquals, assertContains } from '../harness/webmcp-test-shim.ts';
export async function runFlowDTests() {
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
            errors.push(`[Flow D] ${name}: ${err.message || err}`);
        }
    }
    await test('Flow D E2E: Safety Alert Escalation & Doctor Remote Pillbox Loop', async () => {
        const { engine, context, vault } = createTestHarness('patient-s-devi', 'patient');
        // Setup active medications including offending NSAID
        vault.addMedication({
            id: 'med_ibuprofen',
            patientId: 'patient-s-devi',
            genericName: 'Ibuprofen',
            brandName: 'Advil',
            dosage: '400mg',
            frequency: 'TID',
            timingSlots: ['morning', 'noon', 'evening'],
            withFood: true,
            status: 'active'
        }, { userId: 'u1', userName: 'User', role: 'patient' });
        // Step D.1: Patient reports acute danger signs (bilateral pedal edema + dyspnea + photo)
        const dangerRes = await engine.execute('report_danger_sign', {
            symptomTags: ['edema_feet', 'dyspnea'],
            freeText: 'Feet and ankles are noticeably swollen since yesterday, shoes will not fit.',
            severityRating: 'severe',
            photoBlob: 'data:image/jpeg;base64,swollen_feet_photo'
        }, context);
        assert(dangerRes.success, 'Step D.1: Danger sign reporting must succeed');
        assertEquals(dangerRes.data.triagePriority, 'URGENT', 'Step D.1: Triage priority must be URGENT');
        assertContains(dangerRes.plainLanguageSummary, 'triage queue', 'Step D.1: Shows emergency reassurance banner');
        // Step D.2: System notifies clinician triage portal
        const notifRes = await engine.execute('notify_doctor', {
            priority: 'URGENT',
            alertPayload: {
                reportId: dangerRes.data.reportId,
                symptoms: ['edema_feet', 'dyspnea']
            }
        }, context);
        assert(notifRes.success, 'Step D.2: Doctor notification dispatched');
        // Step D.3: Doctor reviews alert with complete clinical context
        const doctorContext = {
            ...context,
            activeProfile: {
                userId: 'dr_patel_md',
                name: 'Dr. A. Patel, MD',
                role: 'doctor',
                isProxy: false
            }
        };
        const recordRes = await engine.execute('compile_health_record', {
            patientId: 'patient-s-devi',
            sections: ['all']
        }, doctorContext);
        assert(recordRes.success, 'Step D.3: Complete health record compiled for clinician view');
        // Step D.4: Doctor orders removal of offending NSAID and schedules 3-day follow-up
        const removeRes = await engine.execute('doctor_remove_medication', {
            medName: 'Ibuprofen',
            reason: 'Fluid retention and acute renal strain on underlying CKD'
        }, doctorContext);
        assert(removeRes.success, 'Step D.4: Doctor remove medication proposal created');
        assertEquals(removeRes.data.status, 'pending', 'Step D.4: Action remains pending patient approval');
        const followupRes = await engine.execute('schedule_followup', {
            date: '+3d',
            appointmentType: 'in_person_clinic',
            reason: 'Edema and renal function evaluation',
            providerName: 'Dr. A. Patel, MD'
        }, doctorContext);
        assert(followupRes.success, 'Step D.4: Follow-up booked');
        // Step D.5: Patient / Caregiver approves doctor's remote pillbox safety action
        const approveRes = await engine.execute('approve_pillmap_change', {
            actionId: removeRes.data.id,
            action: 'approve'
        }, context);
        assert(approveRes.success, 'Step D.5: Patient approves NSAID removal');
        assertEquals(approveRes.data.status, 'approved');
        const ibuprofenInVault = vault.getMedications('patient-s-devi').find(m => m.genericName === 'Ibuprofen');
        assertEquals(ibuprofenInVault?.status, 'discontinued', 'Step D.5: Ibuprofen marked discontinued in vault');
        // Step D.6: Multi-user calendar sync for Patient and Caregiver
        const calRes = await engine.execute('sync_to_calendar', {
            eventId: followupRes.data.id,
            recipients: ['patient', 'caregiver_raj']
        }, context);
        assert(calRes.success, 'Step D.6: Calendar sync payload generated');
        assertContains(calRes.data.icsData, 'BEGIN:VCALENDAR', 'Step D.6: Valid ICS file generated');
        assertEquals(calRes.data.syncedRecipients.length, 2, 'Step D.6: Dispatched to both patient and caregiver');
        // Step D.7: Safety event is logged in Continuity Dossier
        const audits = vault.auditLog.filter(a => a.entityType === 'danger_sign' || a.action.includes('proposal') || a.action.includes('approve_pillmap_change'));
        assert(audits.length >= 2, 'Step D.7: Complete incident record logged to Dossier audit trail');
    });
    return { passed, failed, errors };
}
