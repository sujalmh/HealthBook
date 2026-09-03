
import type { WebMCPToolDefinition, WebMCPExecutionContext, WebMCPToolResult } from '../types/webmcp.ts';
import { eventBus } from '../core/events/eventBus.ts';

function truncateName(name: string, max = 64): string {
  if (name.length <= max) return name;
  return name.slice(0, max - 1).trimEnd() + '…';
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function hasForbiddenPasswordField(params: unknown): string | null {
  if (!params || typeof params !== 'object') return null;
  const obj = params as Record<string, unknown>;
  const forbidden = ['password', 'passwd', 'pwd', 'pass', 'secret', 'passcode'];
  for (const k of Object.keys(obj)) {
    const low = k.toLowerCase();
    if (forbidden.includes(low)) return k;

  }
  return null;
}

export const createAccountTool: WebMCPToolDefinition = {
  name: 'create_account',
  description: 'Prepares a new Healthbook account (name, email, role). Does NOT accept password — human must type password securely in the browser password field. AI should call this to prefill onboarding, then instruct human: "Please type your password in the browser to finish creating your account. Password is never shared with AI."',
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

    const pendingId = `mcp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const pendingPayload = { pendingId, mode: 'create' as const, name: displayName, email: emailRaw, role };

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('healthbook_mcp_auth_pending', JSON.stringify({ ...pendingPayload, timestamp: new Date().toISOString() }));
      }
    } catch {  }

    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('healthbook_mcp_auth_pending', { detail: pendingPayload }));

        window.dispatchEvent(new CustomEvent('healthbook_mcp_prefill', { detail: { name: displayName, email: emailRaw, role } }));
      }
    } catch {  }

    try {
      eventBus.dispatchToast({
        type: 'info',
        title: 'Complete sign-up in browser',
        message: `AI prepared account for ${displayName} (${emailRaw}) as ${role} — please type your password in the browser password field and click Create Account. Password is never shared with AI.`,
      });
      eventBus.emit('mcp_auth_pending' as unknown as string, pendingPayload as unknown as never);
    } catch {  }

    try {
      context.eventBus?.dispatchToast?.({
        type: 'info',
        title: 'Complete sign-up in browser',
        message: `AI prepared account for ${displayName} (${emailRaw}) — please type password in browser to finish.`,
      });
    } catch {  }

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
        pendingStorageKey: 'healthbook_mcp_auth_pending',
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

    const displayName = emailRaw.split('@')[0] || 'User';
    const role = 'patient' as const;
    const pendingId = `mcp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const pendingPayload = { pendingId, mode: 'signin' as const, name: displayName, email: emailRaw, role };

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('healthbook_mcp_auth_pending', JSON.stringify({ ...pendingPayload, timestamp: new Date().toISOString() }));
      }
    } catch {  }

    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('healthbook_mcp_auth_pending', { detail: pendingPayload }));
        window.dispatchEvent(new CustomEvent('healthbook_mcp_prefill', { detail: { email: emailRaw } }));
      }
    } catch {  }

    try {
      eventBus.dispatchToast({
        type: 'info',
        title: 'Complete sign-in in browser',
        message: `AI prepared sign-in for ${emailRaw} — please type your password in the browser password field and click Sign In. Password is never shared with AI.`,
      });
      eventBus.emit('mcp_auth_pending' as unknown as string, pendingPayload as unknown as never);
    } catch {  }

    try {
      context.eventBus?.dispatchToast?.({
        type: 'info',
        title: 'Complete sign-in in browser',
        message: `AI prepared sign-in for ${emailRaw} — please type password in browser to finish.`,
      });
    } catch {  }

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
        status: 'awaiting_human_password',
        humanActionRequired: true,
        nextStep: 'Ask human to type their password securely in the browser password field and click "Sign In" to complete. Do NOT ask AI for password.',
        pendingStorageKey: 'healthbook_mcp_auth_pending',
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

