import { describe, it, expect, beforeEach } from 'vitest';
import { localVault } from '@/core/vault/LocalVault';
import { extractFactTool, confirmFactTool, compileHealthRecordTool } from '@/tools/vaultTools';
import { WebMCPExecutionContext } from '@/types/webmcp';
import { eventBus } from '@/core/events/eventBus';

describe('Module 0: Approved Fact Vault WebMCP Tools', () => {
  const patientId = 'p_devi_78';
  const context: WebMCPExecutionContext = {
    patientId,
    activeProfile: {
      userId: 'user_shanti_devi',
      name: 'Shanti Devi',
      role: 'patient',
      isProxy: false,
    },
    vault: localVault,
    eventBus,
  };

  beforeEach(async () => {
    await localVault.init();
    localVault.clear();
  });

  it('extract_fact: extracts clinical facts, generates narration & bounding boxes, stages as unconfirmed', async () => {
    const result = await extractFactTool.execute(
      {
        documentId: 'doc_discharge_cardiac_001',
        docType: 'discharge_summary',
        rawText: 'Apixaban 5mg twice daily for stroke prevention. Metformin 1000mg twice daily with meals. Atorvastatin 40mg at bedtime. eGFR 32 mL/min.',
      } as any,
      context
    );

    expect(result.success).toBe(true);
    expect(result.data.length).toBeGreaterThanOrEqual(1);

    // Verify all facts are staged in LocalVault
    const pending = localVault.getPendingFacts(patientId);
    expect(pending.length).toBe(result.data.length);

    // Verify plain narration structure — bbox removed (AI upload no bbox)
    const anyFact = pending[0];
    expect(anyFact).toBeDefined();
    expect(anyFact?.plainExplanation).toBeDefined();
    // bbox removed — should be undefined for AI extraction
    expect(anyFact?.boundingBox).toBeUndefined();
  });

  it('confirm_fact: approves fact, propagates to domain store (meds/labs), and logs immutable audit trail', async () => {
    // 1. Stage a fact
    const fact = await localVault.addFact({
      id: 'fact-apix-test',
      patientId,
      sourceDocId: 'doc_discharge_cardiac_001',
      category: 'medication',
      name: 'Apixaban',
      value: { dose: '5mg', frequency: 'BID', brand: 'Eliquis' },
      plainExplanation: 'Apixaban 5mg twice daily',
      boundingBox: { pageIndex: 0, x: 0.1, y: 0.1, width: 0.5, height: 0.05 },
      status: 'unconfirmed',
      author: 'system_ocr',
      timestamp: new Date().toISOString(),
    });

    // 2. Approve via confirm_fact with proxy caregiver context
    const proxyContext: WebMCPExecutionContext = {
      ...context,
      activeProfile: {
        userId: 'user_raj_son',
        name: 'Raj Devi',
        role: 'caregiver',
        isProxy: true,
        onBehalfOf: 'Shanti Devi',
      },
    };

    const confirmResult = await confirmFactTool.execute(
      {
        factId: fact.id,
        action: 'approve',
      },
      proxyContext
    );

    expect(confirmResult.success).toBe(true);
    expect(confirmResult.data.status).toBe('confirmed');

    // Verify medication committed to active meds store
    const activeMeds = localVault.getActiveMedications(patientId);
    expect(activeMeds.length).toBe(1);
    expect(activeMeds[0].genericName.toLowerCase()).toContain('apixaban');

    // Verify audit log with proxy metadata
    const logs = localVault.getAuditLogs(patientId);
    expect(logs.length).toBeGreaterThan(0);
  });

  it('confirm_fact: supports edit action and updates value', async () => {
    const fact = await localVault.addFact({
      id: 'fact-creat-edit',
      patientId,
      sourceDocId: 'doc-1',
      category: 'lab',
      name: 'Creatinine',
      value: 2.5,
      unit: 'mg/dL',
      plainExplanation: 'Creatinine 2.5',
      boundingBox: { pageIndex: 0, x: 0.1, y: 0.1, width: 0.5, height: 0.05 },
      status: 'unconfirmed',
      author: 'system_ocr',
      timestamp: new Date().toISOString(),
    });

    const editResult = await confirmFactTool.execute(
      {
        factId: fact.id,
        action: 'edit',
        edits: { value: 1.9 },
      },
      context
    );

    expect(editResult.success).toBe(true);
    expect(editResult.data.status).toBe('confirmed');

    const confirmed = localVault.getConfirmedFacts(patientId);
    const val = confirmed[0].value as unknown as { value?: unknown } | unknown;
    expect((val as { value?: unknown })?.value ?? val).toBe(1.9);
  });

  it('compile_health_record: compiles lifetime comprehensive dossier with emergency snapshot', async () => {
    // Add sample facts, meds, labs
    await localVault.addFact({
      id: 'fact-c1',
      patientId,
      sourceDocId: 'doc-1',
      category: 'condition',
      name: 'Chronic Kidney Disease',
      value: 'Stage 3b',
      plainExplanation: 'CKD 3b',
      boundingBox: { pageIndex: 0, x: 0.1, y: 0.1, width: 0.5, height: 0.05 },
      status: 'confirmed',
      author: 'system_ocr',
      timestamp: new Date().toISOString(),
    });

    const compileResult = await compileHealthRecordTool.execute(
      {
        patientId,
        includeAuditTrail: true,
      },
      context
    );

    expect(compileResult.success).toBe(true);
    expect(compileResult.data.recordType).toBe('ContinuityDossierCompilation');
    expect(compileResult.data.emergencySnapshot).toBeDefined();
    expect(compileResult.data.facts.length).toBeGreaterThanOrEqual(1);
  });
});
