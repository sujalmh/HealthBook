/**
 * CareCanvas WebMCP Adapter — Spec Mapping & Validation
 * Protocol-correct bridging: parameters → inputSchema, name/description validation,
 * patientId vault bridging, DOMString serialization, annotations.
 * Spec: W3C WebMCP Draft 26 Aug 2026 §4.1-4.5
 */

import type { WebMCPToolDefinition, WebMCPToolParameterSchema } from '../../types/webmcp.ts';
import { localVault } from '../vault/LocalVault.ts';

export const TOOL_NAME_REGEX = /^[a-zA-Z0-9_.-]+$/;
export const TOOL_NAME_MAX = 128;

/** Throw DOMException InvalidStateError with correct name */
export function throwInvalidStateError(message: string): never {
  if (typeof DOMException !== 'undefined') {
    throw new DOMException(message, 'InvalidStateError');
  }
  const err = new Error(message) as Error & { name: string };
  err.name = 'InvalidStateError';
  throw err;
}

export function throwAbortError(message = 'Aborted'): never {
  if (typeof DOMException !== 'undefined') {
    throw new DOMException(message, 'AbortError');
  }
  const err = new Error(message) as Error & { name: string };
  err.name = 'AbortError';
  throw err;
}

/** Validate name 1-128 regex ^[a-zA-Z0-9_.-]+$ else InvalidStateError */
export function validateToolName(name: unknown): void {
  if (typeof name !== 'string' || name.length < 1 || name.length > TOOL_NAME_MAX || !TOOL_NAME_REGEX.test(name)) {
    throwInvalidStateError(`Invalid tool name "${String(name)}": must match ^[a-zA-Z0-9_.-]+$ and be 1-128 chars`);
  }
}

/** Validate description non-empty else InvalidStateError */
export function validateToolDescription(description: unknown, name: string): void {
  if (typeof description !== 'string' || description.trim().length === 0) {
    throwInvalidStateError(`Tool description must be non-empty string for "${name}"`);
  }
}

/** Serialize inputSchema via JSON.stringify — TypeError on circular */
export function serializeInputSchema(schema: unknown): string {
  try {
    if (schema === undefined) return JSON.stringify({});
    if (typeof schema === 'string') {
      try {
        JSON.parse(schema);
        return schema;
      } catch {
        return JSON.stringify(schema);
      }
    }
    return JSON.stringify(schema);
  } catch (e) {
    if (e instanceof TypeError) throw e;
    throw new TypeError(`Invalid inputSchema: ${(e as Error)?.message || String(e)}`);
  }
}

/** Derive patientId/activeProfile from localStorage carecanvas_active_user same as WebMCPEngine.ts:187-200 */
export function derivePatientContext(): { patientId: string; activeProfile: unknown; storedProfile: unknown } {
  const storedProfile = (() => {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem('carecanvas_active_user');
        if (raw) {
          const p = JSON.parse(raw);
          if (p?.userId) return p;
        }
      }
    } catch {}
    return null;
  })();
  const resolvedPatientId = storedProfile?.userId || '';
  const resolvedProfile = storedProfile || { userId: resolvedPatientId || '', name: '', role: 'patient', isProxy: false };
  return { patientId: resolvedPatientId, activeProfile: resolvedProfile, storedProfile };
}

/**
 * Map internal WebMCPToolDefinition → spec ModelContextTool
 * parameters → inputSchema (object, will be stringified internally by polyfill/native)
 * title = name, annotations.readOnlyHint = !requiresHumanApproval
 * execute wrapper bridges vault/context via derivePatientContext at call time, injects localVault + eventBus + activeProfile
 * Keeps Q5 snake_case names unchanged, Q6 staged pendingApprovalId workflow via engine.execute
 */
export function toSpecTool(def: WebMCPToolDefinition, engine: unknown) {
  const inputSchema = (def as unknown as { inputSchema?: unknown }).inputSchema ?? def.parameters;
  const eng = engine as { eventBus: unknown; execute: (name: string, params: unknown, ctx: unknown) => Promise<unknown> };
  return {
    name: def.name,
    description: def.description,
    inputSchema,
    title: def.name,
    annotations: { readOnlyHint: !def.requiresHumanApproval },
    execute: async (inputObject: unknown, options: { signal?: AbortSignal } = {}) => {
      if (options?.signal?.aborted) {
        const reason = options.signal.reason ?? (typeof DOMException !== 'undefined' ? new DOMException('Aborted', 'AbortError') : Object.assign(new Error('Aborted'), { name: 'AbortError' }));
        throw reason;
      }
      const { patientId, activeProfile } = derivePatientContext();
      const bridgedContext = {
        vault: localVault,
        eventBus: eng.eventBus,
        patientId,
        activeProfile,
      };

      const execPromise = eng.execute(def.name, (inputObject as Record<string, unknown>) || {}, bridgedContext);
      if (options?.signal) {
        const signal = options.signal;
        return await new Promise((resolve, reject) => {
          const onAbort = () => reject(signal.reason ?? (typeof DOMException !== 'undefined' ? new DOMException('Aborted', 'AbortError') : Object.assign(new Error('Aborted'), { name: 'AbortError' })));
          signal.addEventListener('abort', onAbort, { once: true });
          execPromise.then((res: unknown) => {
            signal.removeEventListener('abort', onAbort);
            resolve(res);
          }).catch((e: unknown) => {
            signal.removeEventListener('abort', onAbort);
            reject(e);
          });
        });
      }
      return await execPromise;
    },
  };
}
