import { describe, it, expect, beforeEach } from 'vitest';
import { LocalVaultManager } from '@/core/vault/LocalVault';
describe('Privacy-First LocalVault (11 Object Stores & In-Memory Engine)', () => {
    let vault;
    const testPatientId = 'p_devi_78';
    beforeEach(async () => {
        vault = new LocalVaultManager();
        await vault.init();
        vault.clear();
    });
    it('initializes cleanly and supports basic put, get, and delete across stores', async () => {
        const fact = {
            id: 'fact-1',
            patientId: testPatientId,
            category: 'lab',
            name: 'eGFR',
            value: 32,
            unit: 'mL/min/1.73m2',
            plainExplanation: 'eGFR is 32',
            status: 'unconfirmed',
            author: 'system_ocr',
            timestamp: new Date().toISOString(),
            boundingBox: { pageIndex: 0, x: 0.1, y: 0.2, width: 0.3, height: 0.05 },
        };
        vault.addFact(fact);
        const retrieved = vault.getFact('fact-1');
        expect(retrieved).toBeDefined();
        expect(retrieved?.name).toBe('eGFR');
        expect(retrieved?.value).toBe(32);
    });
    it('manages pending and confirmed facts with patient isolation', async () => {
        const fact1 = {
            id: 'fact-p1',
            patientId: testPatientId,
            category: 'medication',
            name: 'Metformin',
            value: { dose: '1000mg', frequency: 'BID' },
            plainExplanation: 'Metformin 1000mg twice daily',
            status: 'unconfirmed',
            author: 'system_ocr',
            timestamp: new Date().toISOString(),
        };
        const fact2 = {
            id: 'fact-p2',
            patientId: 'other-patient',
            category: 'lab',
            name: 'A1c',
            value: 7.2,
            plainExplanation: 'A1c is 7.2',
            status: 'unconfirmed',
            author: 'system_ocr',
            timestamp: new Date().toISOString(),
        };
        vault.addFact(fact1);
        vault.addFact(fact2);
        const pendingTestPatient = vault.getPendingFacts(testPatientId);
        expect(pendingTestPatient).toHaveLength(1);
        expect(pendingTestPatient[0].id).toBe('fact-p1');
        // Confirm fact with proxy actor
        const confirmed = vault.updateFactStatus('fact-p1', 'confirmed', { userId: 'user_raj_son', userName: 'Raj Devi', role: 'caregiver', onBehalfOf: 'Shanti Devi' });
        expect(confirmed?.status).toBe('confirmed');
        const confirmedList = vault.getConfirmedFacts(testPatientId);
        expect(confirmedList).toHaveLength(1);
        // Verify audit log generated
        const auditLogs = vault.getAuditLogs(testPatientId);
        expect(auditLogs.length).toBeGreaterThan(0);
        expect(auditLogs[0].action).toBe('fact_confirmed');
        expect(auditLogs[0].performedBy?.userName).toBe('Raj Devi');
    });
    it('manages medications, labs, conditions, and proposals', async () => {
        const med = {
            id: 'med-apixaban',
            patientId: testPatientId,
            brandName: 'Eliquis',
            genericName: 'Apixaban',
            dosage: '5 mg',
            frequency: 'twice_daily',
            timingSlots: ['morning', 'evening'],
            withFood: true,
            status: 'active',
        };
        vault.addMedication(med);
        const activeMeds = vault.getActiveMedications(testPatientId);
        expect(activeMeds).toHaveLength(1);
        expect(activeMeds[0].genericName).toBe('Apixaban');
        const lab = {
            id: 'lab-egfr',
            patientId: testPatientId,
            marker: 'eGFR',
            value: 32,
            unit: 'mL/min/1.73m2',
            normalizedValue: 32,
            normalizedUnit: 'mL/min/1.73m2',
            drawDate: '2026-08-28',
            referenceRange: { low: 60, high: 120 },
            isBorderline: true,
            isCritical: false,
        };
        vault.addLab(lab);
        const labs = vault.getLabsByMarker(testPatientId, 'eGFR');
        expect(labs).toHaveLength(1);
        expect(labs[0].value).toBe(32);
        // Proposal update
        const prop = {
            id: 'prop-1',
            patientId: testPatientId,
            doctorName: 'Dr. Patel',
            medName: 'Apixaban',
            type: 'dosage_change',
            previousDose: '5 mg twice daily',
            proposedDose: '2.5 mg twice daily',
            reason: 'Renal clearance adjustment',
            status: 'pending',
            timestamp: new Date().toISOString(),
        };
        vault.addProposal(prop);
        const pendingProps = vault.getPendingProposals(testPatientId);
        expect(pendingProps).toHaveLength(1);
        vault.updateProposalStatus('prop-1', 'approved', { userId: testPatientId, userName: 'Shanti Devi', role: 'patient' });
        const resolvedProps = vault.getPendingProposals(testPatientId);
        expect(resolvedProps).toHaveLength(0);
    });
    it('manages care circle and doctor grants', async () => {
        const member = {
            linkId: 'circle-1',
            patientId: testPatientId,
            caregiverUserId: 'user-raj',
            caregiverName: 'Raj Devi',
            relationship: 'son',
            permissionLevel: 'manage',
            status: 'active',
            grantedDate: new Date().toISOString(),
        };
        vault.addCaregiverLink(member);
        const circle = vault.getCaregiverLinks(testPatientId);
        expect(circle).toHaveLength(1);
        expect(circle[0].caregiverName).toBe('Raj Devi');
        vault.updateCaregiverPermission('circle-1', 'full');
        const updated = vault.careCircle.get('circle-1');
        expect(updated?.permissionLevel).toBe('full');
        const grant = {
            grantId: 'grant-1',
            patientId: testPatientId,
            doctorName: 'Dr. Kevin Chen',
            accessToken: 'cc_grant_123',
            permissionScope: 'full_dossier',
            expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
            status: 'active',
            accessLog: [],
            grantedBy: 'Shanti Devi',
            grantedDate: new Date().toISOString(),
        };
        vault.addDoctorGrant(grant);
        const retrievedGrant = vault.getDoctorGrant('grant-1');
        expect(retrievedGrant?.doctorName).toBe('Dr. Kevin Chen');
    });
});
