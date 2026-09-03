/**
 * Healthbook Core: Reactive Event Bus & Telemetry Logger
 * Relevant-only sync: views subscribe only to relevant events; aliases preserve backward compat.
 * Why alias groups: legacy emit names map to canonical events without duplicate subscriptions.
 */

import type { BoundingBox } from '../../types/vault.ts';

function deriveBusPatientId(): string {
  try {
    const g = typeof globalThis !== 'undefined' ? (globalThis as unknown as { localStorage?: Storage }) : undefined;
    const ls = g?.localStorage || (typeof localStorage !== 'undefined' ? localStorage : undefined);
    if (ls) {
      const raw = ls.getItem('healthbook_active_user');
      if (raw) {
        const parsed = JSON.parse(raw) as unknown as { userId?: unknown; id?: unknown; patientId?: unknown };
        const pid = (parsed as { userId?: unknown; id?: unknown; patientId?: unknown })?.userId
          ?? (parsed as { userId?: unknown; id?: unknown; patientId?: unknown })?.id
          ?? (parsed as { patientId?: unknown })?.patientId;
        if (typeof pid === 'string' && pid.trim() !== '' && pid.trim() !== 'patient-s-devi') return pid.trim();
      }
    }
  } catch { /* intentionally empty */ }
  return '';
}

function ensureBusPatientId<T>(payload: T): T {
  if (!payload || typeof payload !== 'object') return payload;
  const obj = payload as unknown as { patientId?: unknown };
  if (typeof obj.patientId === 'string' && obj.patientId.trim() !== '' && obj.patientId.trim() !== 'patient-s-devi') return payload;
  const derived = deriveBusPatientId();
  if (derived && derived.trim() !== '' && derived.trim() !== 'patient-s-devi') return { ...(payload as object), patientId: derived } as T;
  return payload;
}

export type EventHandler<T = unknown> = (payload: T) => void;

export interface ToastMessage {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  message: string;
  duration?: number;
  timestamp: string;
}

export interface HighlightDocumentPayload {
  documentId: string;
  boundingBox?: BoundingBox;
}

// Canonical typed event names — keep aliases for backward compat.
export type EventName =
  | 'medication_added'
  | 'medication_created'
  | 'medication_updated'
  | 'proposal_created'
  | 'proposal_submitted'
  | 'proposal_status_changed'
  | 'lab_added'
  | 'lab_extracted'
  | 'lab_status_changed'
  | 'fact_added'
  | 'fact_extracted'
  | 'fact_confirmed'
  | 'fact_status_changed'
  | 'danger_report_added'
  | 'danger_reported'
  | 'calendar_event_added'
  | 'due_card_added'
  | 'due_card_updated'
  | 'doctor_grant_added'
  | 'doctor_grant_revoked'
  | 'doctor_linked'
  | 'doctor_revoked'
  | 'caregiver_linked'
  | 'question_added'
  | 'question_bank'
  | 'audit_logged'
  | 'toast'
  | 'highlight_document'
  | 'tool_registered'
  | 'tool_unregistered'
  | 'approval_required'
  | 'approval_confirmed'
  | 'approval_resolved'
  | 'toast_notification'
  | 'canvas_rerender';

export interface EventPayloadMap {
  medication_added: { patientId: string; id?: string; genericName?: string; [k: string]: unknown };
  medication_updated: { patientId: string; id?: string; [k: string]: unknown };
  proposal_created: { patientId: string; id?: string; [k: string]: unknown };
  proposal_submitted: { patientId: string; id?: string; [k: string]: unknown };
  proposal_status_changed: { patientId: string; id?: string; status?: string; [k: string]: unknown };
  lab_added: { patientId: string; id?: string; marker?: string; [k: string]: unknown };
  lab_extracted: { patientId: string; id?: string; marker?: string; [k: string]: unknown };
  lab_status_changed: { patientId: string; labId?: string; [k: string]: unknown };
  fact_added: { patientId: string; id?: string; [k: string]: unknown };
  fact_extracted: { patientId: string; id?: string; [k: string]: unknown };
  fact_confirmed: { patientId: string; id?: string; [k: string]: unknown };
  fact_status_changed: { patientId: string; id: string; status: string; fact?: unknown; [k: string]: unknown };
  danger_report_added: { patientId: string; reportId?: string; [k: string]: unknown };
  danger_reported: { patientId: string; reportId?: string; [k: string]: unknown };
  calendar_event_added: { patientId: string; id?: string; [k: string]: unknown };
  due_card_added: { patientId: string; id?: string; [k: string]: unknown };
  due_card_updated: { patientId: string; id?: string; [k: string]: unknown };
  doctor_grant_added: { patientId: string; grantId?: string; [k: string]: unknown };
  doctor_grant_revoked: { patientId: string; grantId?: string; [k: string]: unknown };
  doctor_linked: { patientId: string; linkId?: string; doctorId?: string; [k: string]: unknown };
  doctor_revoked: { patientId: string; linkId?: string; doctorId?: string; [k: string]: unknown };
  caregiver_linked: { patientId: string; linkId?: string; [k: string]: unknown };
  question_added: { patientId: string; id?: string; [k: string]: unknown };
  question_bank: { patientId: string; [k: string]: unknown };
  audit_logged: { patientId?: string; id?: string; action?: string; [k: string]: unknown };
  toast: ToastMessage;
  highlight_document: HighlightDocumentPayload;
  [key: string]: unknown;
}

const EVENT_ALIAS_GROUPS: string[][] = [
  ['danger_report_added', 'danger_reported'],
  ['proposal_created', 'proposal_submitted'],
  ['fact_confirmed', 'fact_status_changed', 'fact_added', 'fact_extracted'],
  ['lab_added', 'lab_extracted'],
  ['question_added', 'question_bank'],
  ['medication_added', 'medication_created'],
];

function getAliasEvents(event: string): string[] {
  const set = new Set<string>();
  for (const group of EVENT_ALIAS_GROUPS) {
    if (group.includes(event)) {
      for (const e of group) {
        if (e !== event) set.add(e);
      }
    }
  }
  return Array.from(set);
}

export class WebMCPEventBus {
  private listeners: Map<string, Set<EventHandler>> = new Map();
  public emittedEvents: Array<{ event: string; payload: ReturnType<typeof JSON.parse>; timestamp: string }> = [];

  public on<T = unknown>(event: string, handler: EventHandler<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const set = this.listeners.get(event);
    if (set) set.add(handler as EventHandler);

    return () => {
      this.listeners.get(event)?.delete(handler as EventHandler);
    };
  }

  public emit<T = unknown>(event: string, payload: T): void {
    this.emittedEvents.push({
      event,
      payload,
      timestamp: new Date().toISOString()
    });

    const dispatch = (evt: string) => {
      const handlers = this.listeners.get(evt);
      if (handlers) {
        handlers.forEach(handler => {
          try {
            handler(payload as unknown);
          } catch (err) {
            console.error(`[EventBus] Error in handler for event "${evt}":`, err);
          }
        });
      }
    };

    dispatch(event);
    const aliases = getAliasEvents(event);
    for (const alias of aliases) {
      dispatch(alias);
    }
  }

  public emitMedicationAdded(payload: EventPayloadMap['medication_added']): void {
    this.emit('medication_added', ensureBusPatientId(payload));
  }
  public emitMedicationUpdated(payload: EventPayloadMap['medication_updated']): void {
    this.emit('medication_updated', ensureBusPatientId(payload));
  }
  public emitProposalCreated(payload: EventPayloadMap['proposal_created']): void {
    this.emit('proposal_created', ensureBusPatientId(payload));
  }
  public emitProposalStatusChanged(payload: EventPayloadMap['proposal_status_changed']): void {
    this.emit('proposal_status_changed', ensureBusPatientId(payload));
  }
  public emitLabAdded(payload: EventPayloadMap['lab_added']): void {
    this.emit('lab_added', ensureBusPatientId(payload));
  }
  public emitLabExtracted(payload: EventPayloadMap['lab_extracted']): void {
    this.emit('lab_extracted', ensureBusPatientId(payload));
  }
  public emitFactConfirmed(payload: EventPayloadMap['fact_confirmed']): void {
    this.emit('fact_confirmed', ensureBusPatientId(payload));
  }
  public emitFactAdded(payload: EventPayloadMap['fact_added']): void {
    this.emit('fact_added', ensureBusPatientId(payload));
  }
  public emitDangerReportAdded(payload: EventPayloadMap['danger_report_added']): void {
    this.emit('danger_report_added', ensureBusPatientId(payload));
  }
  public emitCalendarEventAdded(payload: EventPayloadMap['calendar_event_added']): void {
    this.emit('calendar_event_added', ensureBusPatientId(payload));
  }
  public emitDueCardAdded(payload: EventPayloadMap['due_card_added']): void {
    this.emit('due_card_added', ensureBusPatientId(payload));
  }
  public emitDueCardUpdated(payload: EventPayloadMap['due_card_updated']): void {
    this.emit('due_card_updated', ensureBusPatientId(payload));
  }
  public emitDoctorGrantAdded(payload: EventPayloadMap['doctor_grant_added']): void {
    this.emit('doctor_grant_added', ensureBusPatientId(payload));
  }
  public emitDoctorGrantRevoked(payload: EventPayloadMap['doctor_grant_revoked']): void {
    this.emit('doctor_grant_revoked', ensureBusPatientId(payload));
  }
  public emitDoctorLinked(payload: EventPayloadMap['doctor_linked']): void {
    this.emit('doctor_linked', ensureBusPatientId(payload));
  }
  public emitDoctorRevoked(payload: EventPayloadMap['doctor_revoked']): void {
    this.emit('doctor_revoked', ensureBusPatientId(payload));
  }
  public emitCaregiverLinked(payload: EventPayloadMap['caregiver_linked']): void {
    this.emit('caregiver_linked', ensureBusPatientId(payload));
  }
  public emitQuestionAdded(payload: EventPayloadMap['question_added']): void {
    this.emit('question_added', ensureBusPatientId(payload));
  }
  public emitAuditLogged(payload: EventPayloadMap['audit_logged']): void {
    this.emit('audit_logged', ensureBusPatientId(payload));
  }

  public dispatchToast(toast: Omit<ToastMessage, 'id' | 'timestamp'> & { id?: string }): void {
    const payload: ToastMessage = {
      id: toast.id || `toast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type: toast.type,
      title: toast.title,
      message: toast.message,
      duration: toast.duration,
      timestamp: new Date().toISOString()
    };
    this.emit('toast', payload);
  }

  public onToast(handler: (toast: ToastMessage) => void): () => void {
    return this.on('toast', handler);
  }

  public highlightSourceDocument(payloadOrDocId: string | { documentId: string; boundingBox?: BoundingBox }, boundingBox?: BoundingBox): void {
    if (typeof payloadOrDocId === 'string') {
      this.emit('highlight_document', { documentId: payloadOrDocId, boundingBox });
    } else if (payloadOrDocId && typeof payloadOrDocId === 'object') {
      const obj = payloadOrDocId as unknown as { documentId: string; boundingBox?: BoundingBox };
      this.emit('highlight_document', { documentId: obj.documentId, boundingBox: obj.boundingBox || boundingBox });
    }
  }

  public onHighlightDocument(handler: (payload: HighlightDocumentPayload) => void): () => void {
    return this.on('highlight_document', handler);
  }

  public clearHistory(): void {
    this.emittedEvents = [];
  }

  public getEvents(eventName?: string): Array<{ event: string; payload: ReturnType<typeof JSON.parse>; timestamp: string }> {
    if (eventName) {
      return this.emittedEvents.filter(e => e.event === eventName);
    }
    return this.emittedEvents;
  }

  public getEventCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const e of this.emittedEvents) {
      counts[e.event] = (counts[e.event] || 0) + 1;
    }
    return counts;
  }
}

export const eventBus = new WebMCPEventBus();
