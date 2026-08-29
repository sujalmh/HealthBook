import { describe, it, expect, beforeEach } from 'vitest';
import { localVault } from '@/core/vault/LocalVault';
import { webMCPEngine } from '@/core/webmcp/WebMCPEngine';
import { registerAllWebMCPTools } from '@/tools';
describe('Milestone 1: Core Foundation & WebMCP End-to-End Integration Flow', () => {
    const patientId = 'p_devi_78';
    const context = {
        patientId,
        activeProfile: {
            userId: 'user_shanti_devi',
            name: 'Shanti Devi',
            role: 'patient',
            isProxy: false,
        },
        vault: localVault,
        eventBus: webMCPEngine.eventBus,
    };
    beforeEach(async () => {
        await localVault.init();
        localVault.clear();
        registerAllWebMCPTools(webMCPEngine);
    });
    it('executes full M1 workflow: ingest document -> extract facts -> human gate approval -> vault update -> dossier compilation', async () => {
        // 1. Ingest document & extract facts via WebMCP
        const extractRes = await webMCPEngine.execute('extract_fact', {
            documentId: 'doc_discharge_cardiac_001',
            docType: 'discharge_summary',
        }, context);
        expect(extractRes.success).toBe(true);
        const facts = extractRes.data;
        expect(facts.length).toBeGreaterThanOrEqual(4);
        // Verify unapproved facts remain in unconfirmed state and NOT in active meds/labs
        const initialMeds = localVault.getActiveMedications(patientId);
        expect(initialMeds.length).toBe(0);
        // 2. Patient / Caregiver approves extracted facts via confirm_fact
        for (const fact of facts) {
            const confirmRes = await webMCPEngine.execute('confirm_fact', {
                factId: fact.id,
                action: 'approve',
            }, {
                ...context,
                activeProfile: {
                    userId: 'user_raj_son',
                    name: 'Raj Devi',
                    role: 'caregiver',
                    isProxy: true,
                    onBehalfOf: 'Shanti Devi',
                },
            });
            expect(confirmRes.success).toBe(true);
        }
        // 3. Verify downstream active stores updated
        const activeMeds = localVault.getActiveMedications(patientId);
        expect(activeMeds.length).toBeGreaterThanOrEqual(2); // Metformin, Apixaban, etc.
        const labs = localVault.getLabs(patientId);
        expect(labs.length).toBeGreaterThanOrEqual(2); // eGFR, Creatinine
        // 4. Verify immutable audit log recorded
        const auditLogs = localVault.getAuditLogs(patientId);
        expect(auditLogs.length).toBeGreaterThanOrEqual(facts.length);
        // 5. Compile lifetime health record dossier
        const dossierRes = await webMCPEngine.execute('compile_health_record', {
            patientId,
            includeAuditTrail: true,
        }, context);
        expect(dossierRes.success).toBe(true);
        expect(dossierRes.data.recordType).toBe('ContinuityDossierCompilation');
        expect(dossierRes.data.emergencySnapshot).toBeDefined();
        // 6. Verify telemetry logs recorded all executions
        const telemetry = webMCPEngine.getTelemetryLogs();
        expect(telemetry.length).toBeGreaterThanOrEqual(facts.length + 2);
    });
});
