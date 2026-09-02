/**
 * CareCanvas WebMCP Tools: Auth Onboarding — human-only password
 * Tools: create_account, sign_in
 * Security: NO password field in parameters. AI must never receive or handle password.
 * Password entry is human-only via secure browser <input type="password">.
 * AI prepares name/email/role, then prompts human to type password in browser.
 */

import type { WebMCPToolDefinition, WebMCPExecutionContext, WebMCPToolResult } from '../types/webmcp.ts';

function truncateName(name: string, max = 64): string {
  if (name.length <= max) return name;
  return name.slice(0, max - 1).trimEnd() + '…';
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getUsers(): Array<{ userId?: string; email?: string; name?: string; role?: string; password?: string }> {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('carecanvas_users') : null;
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function hasForbiddenPasswordField(params: unknown): string | null {
  if (!params || typeof params !== 'object') return null;
  const obj = params as Record<string, unknown>;
  const forbidden = ['password', 'passwd', 'pwd', 'pass', 'secret', 'passcode'];
  for (const k of Object.keys(obj)) {
    const low = k.toLowerCase();
    if (forbidden.includes(low)) return k;
    // also check nested? only top level
  }
  return null;
}

export const createAccountTool: WebMCPToolDefinition = {
  name: 'create_account',
  description: 'Prepares a new CareCanvas account (name, email, role). Does NOT accept password — human must type password securely in the browser password field. AI should call this to prefill onboarding, then instruct human: "Please type your password in the browser to finish creating your account. Password is never shared with AI."',
  moduleOwner: 'carecircle',
  category: 'audit_proxy',
  requiresHumanApproval: false,
  approvalGateType: 'none',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Display name (optional, defaults to Anonymous, max 64 chars)' },
      email: { type: 'string', description: 'Email address for the new account (required)' },
      role: { type: 'string', enum: ['patient', 'doctor'], description: 'Account role: patient (default) or doctor' },
    },
    required: ['email'],
    additionalProperties: false,
  },
  returns: { type: 'object', description: 'Pending account staging — awaiting human password in browser' },
  uiSideEffects: {
    toastNotification: { type: 'info', messageTemplate: 'AI prepared sign-up — please type your password in the browser to finish.' },
  },
  execute: async (
    params: { name?: string; email: string; role?: string },
    context: WebMCPExecutionContext
  ): Promise<WebMCPToolResult> => {
    // Security: reject any password field smuggled in
    const forbidden = hasForbiddenPasswordField(params);
    if (forbidden) {
      return {
        success: false,
        tool: 'create_account',
        timestamp: new Date().toISOString(),
        data: null,
        plainLanguageSummary: `Security: password must not be provided via AI tool (found field "${forbidden}"). Human must type password in browser.`,
        humanApprovalRequired: false,
        error: { code: 'PASSWORD_NOT_ALLOWED_VIA_AI', message: `Field "${forbidden}" is not allowed — password must be typed by human in browser.` },
      };
    }

    const emailRaw = (params.email || '').trim().toLowerCase();
    if (!emailRaw) {
      return {
        success: false,
        tool: 'create_account',
        timestamp: new Date().toISOString(),
        data: null,
        plainLanguageSummary: 'Email is required to create an account.',
        humanApprovalRequired: false,
        error: { code: 'INVALID_PARAMS', message: 'email is required' },
      };
    }
    if (!isValidEmail(emailRaw)) {
      return {
        success: false,
        tool: 'create_account',
        timestamp: new Date().toISOString(),
        data: null,
        plainLanguageSummary: 'Invalid email format.',
        humanApprovalRequired: false,
        error: { code: 'INVALID_PARAMS', message: 'email must be valid' },
      };
    }

    let displayName = (params.name || '').trim();
    if (!displayName) displayName = 'Anonymous';
    displayName = truncateName(displayName, 64);

    const role = params.role === 'doctor' ? 'doctor' : 'patient';

    // Check duplicate via local storage
    const users = getUsers();
    const exists = users.find((u) => (u.email || '').toLowerCase() === emailRaw);
    if (exists) {
      return {
        success: false,
        tool: 'create_account',
        timestamp: new Date().toISOString(),
        data: { existingEmail: emailRaw },
        plainLanguageSummary: `An account with ${emailRaw} already exists. Use sign_in instead to sign in. AI should call sign_in and ask human to type password.`,
        humanApprovalRequired: false,
        error: { code: 'ACCOUNT_EXISTS', message: `Account ${emailRaw} already exists` },
      };
    }

    // Also check cred email map
    try {
      if (typeof localStorage !== 'undefined') {
        const credRaw = localStorage.getItem(`carecanvas_cred_email_${emailRaw}`);
        if (credRaw) {
          return {
            success: false,
            tool: 'create_account',
            timestamp: new Date().toISOString(),
            data: { existingEmail: emailRaw },
            plainLanguageSummary: `An account with ${emailRaw} already exists. Use sign_in.`,
            humanApprovalRequired: false,
            error: { code: 'ACCOUNT_EXISTS', message: `Account ${emailRaw} already exists` },
          };
        }
      }
    } catch { /* ignore */ }

    const pendingId = `mcp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const pendingPayload = { pendingId, mode: 'create' as const, name: displayName, email: emailRaw, role };

    // Persist pending for UI bridge / gate views
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('carecanvas_mcp_auth_pending', JSON.stringify({ ...pendingPayload, timestamp: new Date().toISOString() }));
      }
    } catch { /* ignore */ }

    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('carecanvas_mcp_auth_pending', { detail: pendingPayload }));
        // Also store prefill for gate views to pick up synchronously
        window.dispatchEvent(new CustomEvent('carecanvas_mcp_prefill', { detail: { name: displayName, email: emailRaw, role } }));
      }
    } catch { /* ignore */ }

    // Dispatch toast via eventBus if available (import at runtime to avoid cycle)
    try {
      const { eventBus: bus } = await import('@/core/events/eventBus.ts');
      bus.dispatchToast({
        type: 'info',
        title: 'Complete sign-up in browser',
        message: `AI prepared account for ${displayName} (${emailRaw}) as ${role} — please type your password in the browser password field and click Create Account. Password is never shared with AI.`,
      });
      bus.emit('mcp_auth_pending' as unknown as string, pendingPayload as unknown as never);
    } catch { /* ignore — fallback window event already dispatched */ }

    try {
      context.eventBus?.dispatchToast?.({
        type: 'info',
        title: 'Complete sign-up in browser',
        message: `AI prepared account for ${displayName} (${emailRaw}) — please type password in browser to finish.`,
      });
    } catch { /* */ }

    return {
      success: true,
      tool: 'create_account',
      timestamp: new Date().toISOString(),
      data: {
        pendingId,
        mode: 'create',
        name: displayName,
        email: emailRaw,
        role,
        status: 'awaiting_human_password',
        humanActionRequired: true,
        nextStep: 'Ask human to type their password securely in the browser password field and click "Create Account" to complete. Do NOT ask AI for password. Password is human-only.',
        pendingStorageKey: 'carecanvas_mcp_auth_pending',
      },
      plainLanguageSummary: `Account prepared for ${displayName} (${emailRaw}) as ${role}. Awaiting human to type password in the browser to complete sign-up. Password is never shared with AI — human must enter it in the secure password field and click Create Account.`,
      plainLanguageExplanation: `Account prepared for ${displayName} (${emailRaw}) as ${role}. Awaiting human to type password in the browser to complete sign-up. Password is never shared with AI — human must enter it in the secure password field and click Create Account.`,
      humanApprovalRequired: true,
      approvalStatus: 'pending_approval',
      pendingApprovalId: pendingId,
    };
  },
};

export const signInTool: WebMCPToolDefinition = {
  name: 'sign_in',
  description: 'Initiates sign-in for an existing account by email. Does NOT accept password — human must type password securely in the browser. AI should call this to prefill sign-in, then instruct human: "Please type your password in the browser to sign in. Password is never shared with AI."',
  moduleOwner: 'carecircle',
  category: 'audit_proxy',
  requiresHumanApproval: false,
  approvalGateType: 'none',
  parameters: {
    type: 'object',
    properties: {
      email: { type: 'string', description: 'Email address of the existing account (required)' },
    },
    required: ['email'],
    additionalProperties: false,
  },
  returns: { type: 'object', description: 'Pending sign-in staging — awaiting human password in browser' },
  uiSideEffects: {
    toastNotification: { type: 'info', messageTemplate: 'AI prepared sign-in — please type your password in the browser to sign in.' },
  },
  execute: async (
    params: { email: string },
    context: WebMCPExecutionContext
  ): Promise<WebMCPToolResult> => {
    const forbidden = hasForbiddenPasswordField(params);
    if (forbidden) {
      return {
        success: false,
        tool: 'sign_in',
        timestamp: new Date().toISOString(),
        data: null,
        plainLanguageSummary: `Security: password must not be provided via AI (found "${forbidden}"). Human must type password in browser.`,
        humanApprovalRequired: false,
        error: { code: 'PASSWORD_NOT_ALLOWED_VIA_AI', message: `Field "${forbidden}" is not allowed — password must be typed by human.` },
      };
    }

    const emailRaw = (params.email || '').trim().toLowerCase();
    if (!emailRaw) {
      return {
        success: false,
        tool: 'sign_in',
        timestamp: new Date().toISOString(),
        data: null,
        plainLanguageSummary: 'Email is required to sign in.',
        humanApprovalRequired: false,
        error: { code: 'INVALID_PARAMS', message: 'email is required' },
      };
    }
    if (!isValidEmail(emailRaw)) {
      return {
        success: false,
        tool: 'sign_in',
        timestamp: new Date().toISOString(),
        data: null,
        plainLanguageSummary: 'Invalid email format.',
        humanApprovalRequired: false,
        error: { code: 'INVALID_PARAMS', message: 'email must be valid' },
      };
    }

    const users = getUsers();
    let found = users.find((u) => (u.email || '').toLowerCase() === emailRaw) || null;
    // Fallback to cred email map for users not in array but in cred map
    if (!found) {
      try {
        if (typeof localStorage !== 'undefined') {
          const credRaw = localStorage.getItem(`carecanvas_cred_email_${emailRaw}`);
          if (credRaw) {
            const cred = JSON.parse(credRaw);
            found = { email: emailRaw, name: emailRaw.split('@')[0], role: 'patient', userId: cred.userId } as unknown as typeof found;
          }
        }
      } catch { /* ignore */ }
    }

    if (!found) {
      return {
        success: false,
        tool: 'sign_in',
        timestamp: new Date().toISOString(),
        data: null,
        plainLanguageSummary: `No account found for ${emailRaw}. Please create an account first — AI can call create_account to help, then human types password.`,
        humanApprovalRequired: false,
        error: { code: 'ACCOUNT_NOT_FOUND', message: `No account for ${emailRaw}` },
      };
    }

    const displayName = (found.name || emailRaw.split('@')[0] || 'User').slice(0, 64);
    const role = (found.role === 'doctor' ? 'doctor' : 'patient') as 'patient' | 'doctor';
    const pendingId = `mcp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const pendingPayload = { pendingId, mode: 'signin' as const, name: displayName, email: emailRaw, role, userId: found.userId };

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('carecanvas_mcp_auth_pending', JSON.stringify({ ...pendingPayload, timestamp: new Date().toISOString() }));
      }
    } catch { /* ignore */ }

    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('carecanvas_mcp_auth_pending', { detail: pendingPayload }));
        window.dispatchEvent(new CustomEvent('carecanvas_mcp_prefill', { detail: { email: emailRaw } }));
      }
    } catch { /* ignore */ }

    try {
      const { eventBus: bus } = await import('@/core/events/eventBus.ts');
      bus.dispatchToast({
        type: 'info',
        title: 'Complete sign-in in browser',
        message: `AI prepared sign-in for ${emailRaw} — please type your password in the browser password field and click Sign In. Password is never shared with AI.`,
      });
      bus.emit('mcp_auth_pending' as unknown as string, pendingPayload as unknown as never);
    } catch { /* ignore */ }

    try {
      context.eventBus?.dispatchToast?.({
        type: 'info',
        title: 'Complete sign-in in browser',
        message: `AI prepared sign-in for ${emailRaw} — please type password in browser to finish.`,
      });
    } catch { /* */ }

    return {
      success: true,
      tool: 'sign_in',
      timestamp: new Date().toISOString(),
      data: {
        pendingId,
        mode: 'signin',
        email: emailRaw,
        name: displayName,
        role,
        userId: found.userId,
        status: 'awaiting_human_password',
        humanActionRequired: true,
        nextStep: 'Ask human to type their password securely in the browser password field and click "Sign In" to complete. Do NOT ask AI for password.',
        pendingStorageKey: 'carecanvas_mcp_auth_pending',
      },
      plainLanguageSummary: `Sign-in prepared for ${emailRaw}. Awaiting human to type password in the browser to complete. Password is never shared with AI — human must enter it in the secure password field and click Sign In.`,
      plainLanguageExplanation: `Sign-in prepared for ${emailRaw}. Awaiting human to type password in the browser to complete. Password is never shared with AI — human must enter it in the secure password field and click Sign In.`,
      humanApprovalRequired: true,
      approvalStatus: 'pending_approval',
      pendingApprovalId: pendingId,
    };
  },
};

export const authTools: WebMCPToolDefinition[] = [createAccountTool, signInTool];
