/**
 * CareCanvas WebMCP Test Harness & Assertion Engine
 */
import { WebMCPEngine } from '../../src/core/webmcp/webMCPEngine.ts';
import { LocalVaultManager } from '../../src/core/vault/localVault.ts';
import { WebMCPEventBus } from '../../src/core/events/eventBus.ts';
import { registerAllWebMCPTools } from '../../src/tools/index.ts';
export function createTestHarness(patientId = 'patient-s-devi', role = 'patient') {
    const eventBus = new WebMCPEventBus();
    const vault = new LocalVaultManager(eventBus);
    const engine = new WebMCPEngine(eventBus);
    registerAllWebMCPTools(engine);
    const context = {
        patientId,
        activeProfile: {
            userId: role === 'caregiver' ? 'user_raj_son' : role === 'doctor' ? 'dr_patel_md' : 'user_shanti_devi',
            name: role === 'caregiver' ? 'Raj Devi' : role === 'doctor' ? 'Dr. A. Patel, MD' : 'Smt. Shanti Devi',
            role,
            isProxy: role === 'caregiver',
            onBehalfOf: role === 'caregiver' ? 'Smt. Shanti Devi' : undefined,
            permissionLevel: role === 'caregiver' ? 'manage' : undefined
        },
        vault,
        eventBus
    };
    return { engine, vault, eventBus, context };
}
// --- Assertion Utilities ---
export function assert(condition, message) {
    if (!condition) {
        throw new Error(`Assertion Failed: ${message || 'Expected true but got false'}`);
    }
}
export function assertEquals(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`Assertion Failed: ${message || ''}\n  Expected: ${JSON.stringify(expected)}\n  Actual:   ${JSON.stringify(actual)}`);
    }
}
export function assertDeepEquals(actual, expected, message) {
    const actualStr = JSON.stringify(actual);
    const expectedStr = JSON.stringify(expected);
    if (actualStr !== expectedStr) {
        throw new Error(`Assertion Failed: ${message || ''}\n  Expected: ${expectedStr}\n  Actual:   ${actualStr}`);
    }
}
export function assertGreaterThan(actual, expected, message) {
    if (actual <= expected) {
        throw new Error(`Assertion Failed: ${message || ''}\n  Expected > ${expected}, got ${actual}`);
    }
}
export function assertContains(haystack, needle, message) {
    if (typeof haystack === 'string') {
        if (!haystack.includes(needle)) {
            throw new Error(`Assertion Failed: ${message || ''}\n  Expected string to contain "${needle}"\n  String: "${haystack}"`);
        }
    }
    else if (Array.isArray(haystack)) {
        if (!haystack.includes(needle)) {
            throw new Error(`Assertion Failed: ${message || ''}\n  Expected array to contain item\n  Array: ${JSON.stringify(haystack)}`);
        }
    }
}
export async function assertThrowsAsync(fn, expectedErrorSnippet) {
    let threw = false;
    try {
        await fn();
    }
    catch (err) {
        threw = true;
        if (expectedErrorSnippet && !String(err.message || err).includes(expectedErrorSnippet)) {
            throw new Error(`Expected error containing "${expectedErrorSnippet}", but got "${err.message || err}"`);
        }
    }
    if (!threw) {
        throw new Error('Expected function to throw an error, but it succeeded.');
    }
}
