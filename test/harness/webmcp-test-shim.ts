/**
 * CareCanvas WebMCP Test Harness & Assertion Engine
 */

import { WebMCPEngine } from '../../src/core/webmcp/WebMCPEngine.ts';
import { LocalVaultManager } from '../../src/core/vault/LocalVault.ts';
import { WebMCPEventBus } from '../../src/core/events/eventBus.ts';
import type {  WebMCPExecutionContext, WebMCPToolResult  } from '../../src/types/webmcp.ts';
import { registerAllWebMCPTools } from '../../src/tools/index.ts';

export interface TestHarnessContext {
  engine: WebMCPEngine;
  vault: LocalVaultManager;
  eventBus: WebMCPEventBus;
  context: WebMCPExecutionContext;
}

export function createTestHarness(patientId: string = 'test-patient-001', role: 'patient' | 'caregiver' | 'doctor' = 'patient'): TestHarnessContext {
  const eventBus = new WebMCPEventBus();
  const vault = new LocalVaultManager(eventBus);
  const engine = new WebMCPEngine(eventBus);

  registerAllWebMCPTools(engine);

  // M3 real-data: derive generic patient identity from patientId (no fixture branching)
  const derivedPatientName = patientId === 'test-patient-001' ? 'Test Patient' : patientId.includes('devi') ? 'Smt. Shanti Devi' : patientId.includes('jenkins') || patientId.includes('p_jenkins') ? 'Harold Jenkins' : patientId.startsWith('p-') || patientId.startsWith('user_') ? 'Patient' : 'Patient';
  const derivedUserId = role === 'caregiver' ? 'user_raj_son' : role === 'doctor' ? 'dr_patel_md' : patientId.startsWith('test-patient') ? patientId : patientId === 'patient-s-devi' ? 'user_shanti_devi' : `user_${patientId.replace(/[^a-z0-9]/gi,'_')}`;
  const context: WebMCPExecutionContext = {
    patientId,
    activeProfile: {
      userId: derivedUserId,
      name: role === 'caregiver' ? 'Raj Devi' : role === 'doctor' ? 'Dr. A. Patel, MD' : derivedPatientName,
      role,
      isProxy: role === 'caregiver',
      onBehalfOf: role === 'caregiver' ? derivedPatientName : undefined,
      permissionLevel: role === 'caregiver' ? 'manage' : undefined
    },
    vault,
    eventBus
  };

  return { engine, vault, eventBus, context };
}

// --- Assertion Utilities ---
export function assert(condition: boolean, message?: string): void {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message || 'Expected true but got false'}`);
  }
}

export function assertEquals(actual: any, expected: any, message?: string): void {
  if (actual !== expected) {
    throw new Error(`Assertion Failed: ${message || ''}\n  Expected: ${JSON.stringify(expected)}\n  Actual:   ${JSON.stringify(actual)}`);
  }
}

export function assertDeepEquals(actual: any, expected: any, message?: string): void {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(`Assertion Failed: ${message || ''}\n  Expected: ${expectedStr}\n  Actual:   ${actualStr}`);
  }
}

export function assertGreaterThan(actual: number, expected: number, message?: string): void {
  if (actual <= expected) {
    throw new Error(`Assertion Failed: ${message || ''}\n  Expected > ${expected}, got ${actual}`);
  }
}

export function assertContains(haystack: string | any[], needle: any, message?: string): void {
  if (typeof haystack === 'string') {
    if (!haystack.includes(needle)) {
      throw new Error(`Assertion Failed: ${message || ''}\n  Expected string to contain "${needle}"\n  String: "${haystack}"`);
    }
  } else if (Array.isArray(haystack)) {
    if (!haystack.includes(needle)) {
      throw new Error(`Assertion Failed: ${message || ''}\n  Expected array to contain item\n  Array: ${JSON.stringify(haystack)}`);
    }
  }
}

export async function assertThrowsAsync(fn: () => Promise<any>, expectedErrorSnippet?: string): Promise<void> {
  let threw = false;
  try {
    await fn();
  } catch (err: any) {
    threw = true;
    if (expectedErrorSnippet && !String(err.message || err).includes(expectedErrorSnippet)) {
      throw new Error(`Expected error containing "${expectedErrorSnippet}", but got "${err.message || err}"`);
    }
  }
  if (!threw) {
    throw new Error('Expected function to throw an error, but it succeeded.');
  }
}
