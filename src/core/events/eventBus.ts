/**
 * CareCanvas Core: Reactive Event Bus & Telemetry Logger (M2)
 *
 * =============================================================================
 * RELEVANCE MATRIX — Relevant-Only Reactive Sync (ws-02-01)
 * =============================================================================
 * Canonical EventName union below is the single source of truth for cross-feature
 * reactivity. Each view subscribes ONLY to its relevant subset to avoid spurious
 * rerenders. Payloads always include patientId where applicable for filtering.
 *
 * | Event                         | PillMap | LabStory | HomeLab | Safety | Dossier | RxBridge | CareCircle | Notes |
 * |-------------------------------|---------|----------|---------|--------|---------|----------|------------|-------|
 * | medication_added              |   ✅    |    ⬚*    |         |        |    ✅   |    ✅    |            | PillMap arcs/badges; Dossier timeline; RxBridge eGFR flags; LabStory overlay *optional |
 * | medication_updated            |   ✅    |    ✅    |         |        |    ✅   |    ✅    |            | PillMap + LabStory overlay bands; dosage changes |
 * | proposal_created (alias: proposal_submitted) |   ⬚    |          |    ✅   |   ✅   |    ✅   |    ✅    |            | HomeLab + Safety + Dossier + RxBridge |
 * | proposal_status_changed       |   ✅    |          |    ✅   |        |    ✅   |    ✅    |    ⬚     | PillMap Day0, HomeLab due, Dossier, RxBridge, CareCircle audit snippet |
 * | lab_added (alias: lab_extracted) |         |    ✅    |    ✅   |        |    ✅   |    ✅    |            | LabStory chart, HomeLab due, Dossier, RxBridge eGFR flag |
 * | lab_extracted                 |         |    ✅    |    ✅   |        |    ✅   |    ✅    |            | Alias for lab_added |
 * | fact_added                    |         |          |         |        |    ✅   |          |            | Dossier timeline source grounding |
 * | fact_extracted                |         |    ⬚    |         |        |    ✅   |          |            | Dossier + LabStory fallback |
 * | fact_confirmed (alias: fact_status_changed=confirmed) |         |    ✅    |    ✅   |        |    ✅   |          |            | LabStory + HomeLab due + Dossier |
 * | fact_status_changed           |         |    ✅    |         |        |    ✅   |          |            | Includes confirmed |
 * | danger_report_added (alias: danger_reported) |   ⬚    |          |         |    ✅  |    ✅   |          |            | Safety triage, PillMap interaction? calendar; Dossier trail |
 * | danger_reported               |         |          |         |    ✅  |    ✅   |          |            | Alias |
 * | calendar_event_added          |   ⬚    |          |         |    ✅  |    ✅   |          |            | Safety calendar + Dossier + PillMap reminders |
 * | due_card_added                |         |          |    ✅   |        |    ✅   |          |            | HomeLab + Dossier |
 * | due_card_updated              |         |          |    ✅   |        |    ✅   |          |            | HomeLab |
 * | doctor_grant_added            |         |          |         |        |    ✅   |          |    ✅      | Dossier grants, CareCircle |
 * | doctor_grant_revoked          |         |          |         |        |    ✅   |          |    ✅      | Revocation sync |
 * | caregiver_linked              |         |          |         |        |    ✅   |          |    ✅      | CareCircle roster, Dossier audit |
 * | question_added (alias: question_bank) |         |          |         |        |    ✅   |    ⬚    |            | Dossier question bank; RxBridge may read |
 * | question_bank                 |         |          |         |        |    ✅   |          |            | Alias |
 * | audit_logged                  |         |          |         |        |    ✅   |          |    ✅      | Dossier + CareCircle audit trail |
 * | toast                         |  global |  global  |  global | global |  global |  global  |   global   | ToastContainer |
 * | highlight_document            |  global |  global  |  global | global |  global |  global  |   global   | BoundingBoxViewer |
 *
 * ✅ = must subscribe, ⬚ = optional/conditional, blank = must NOT subscribe (spurious guard)
 *
 * Views must filter by active patientId in handlers where payload.patientId exists.
 * Irrelevant events MUST NOT trigger reload — verified via telemetry/render counters (M4 tier3 cohesion).
 * =============================================================================
 */

import type { BoundingBox } from '../../types/vault.ts';

export type EventHandler<T = any> = (payload: T) => void;

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
// All emit/on calls should use this union (string still accepted for extensibility but typed helpers preferred).
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
  | 'caregiver_linked'
  | 'question_added'
  | 'question_bank'
  | 'audit_logged'
  | 'toast'
  | 'highlight_document'
  // legacy / tooling events (kept but not in relevance matrix)
  | 'tool_registered'
  | 'tool_unregistered'
  | 'approval_required'
  | 'approval_confirmed'
  | 'approval_resolved'
  | 'toast_notification'
  | 'canvas_rerender';

// Optional payload map for typed helpers (payload is intentionally permissive: most payloads contain patientId).
export interface EventPayloadMap {
  medication_added: { patientId: string; id?: string; genericName?: string; [k: string]: any };
  medication_updated: { patientId: string; id?: string; [k: string]: any };
  proposal_created: { patientId: string; id?: string; [k: string]: any };
  proposal_submitted: { patientId: string; id?: string; [k: string]: any };
  proposal_status_changed: { patientId: string; id?: string; status?: string; [k: string]: any };
  lab_added: { patientId: string; id?: string; marker?: string; [k: string]: any };
  lab_extracted: { patientId: string; id?: string; marker?: string; [k: string]: any };
  lab_status_changed: { patientId: string; labId?: string; [k: string]: any };
  fact_added: { patientId: string; id?: string; [k: string]: any };
  fact_extracted: { patientId: string; id?: string; [k: string]: any };
  fact_confirmed: { patientId: string; id?: string; [k: string]: any };
  fact_status_changed: { patientId: string; id: string; status: string; fact?: any; [k: string]: any };
  danger_report_added: { patientId: string; reportId?: string; [k: string]: any };
  danger_reported: { patientId: string; reportId?: string; [k: string]: any };
  calendar_event_added: { patientId: string; id?: string; [k: string]: any };
  due_card_added: { patientId: string; id?: string; [k: string]: any };
  due_card_updated: { patientId: string; id?: string; [k: string]: any };
  doctor_grant_added: { patientId: string; grantId?: string; [k: string]: any };
  doctor_grant_revoked: { patientId: string; grantId?: string; [k: string]: any };
  caregiver_linked: { patientId: string; linkId?: string; [k: string]: any };
  question_added: { patientId: string; id?: string; [k: string]: any };
  question_bank: { patientId: string; [k: string]: any };
  audit_logged: { patientId?: string; id?: string; action?: string; [k: string]: any };
  toast: ToastMessage;
  highlight_document: HighlightDocumentPayload;
  [key: string]: any;
}

// Alias equivalence groups — emitting one notifies listeners of aliases to preserve backward compat.
// This ensures relevant-only matrix holds even when legacy code emits alias name.
// Fact family merged into single canonical group so fact_extracted reaches fact_confirmed listeners (transitive).
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
  public emittedEvents: { event: string; payload: any; timestamp: string }[] = [];

  public on<T = any>(event: string, handler: EventHandler<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);

    return () => {
      this.listeners.get(event)?.delete(handler);
    };
  }

  public emit<T = any>(event: string, payload: T): void {
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
            handler(payload);
          } catch (err) {
            console.error(`[EventBus] Error in handler for event "${evt}":`, err);
          }
        });
      }
    };

    dispatch(event);
    // Notify alias listeners for backward compat (relevant-only: same data, different subscription string)
    const aliases = getAliasEvents(event);
    for (const alias of aliases) {
      dispatch(alias);
    }
  }

  // Typed helper emitters — wrap emit with canonical name and ensure patientId present where applicable.
  public emitMedicationAdded(payload: EventPayloadMap['medication_added']): void {
    this.emit('medication_added', payload);
  }
  public emitMedicationUpdated(payload: EventPayloadMap['medication_updated']): void {
    this.emit('medication_updated', payload);
  }
  public emitProposalCreated(payload: EventPayloadMap['proposal_created']): void {
    this.emit('proposal_created', payload);
  }
  public emitProposalStatusChanged(payload: EventPayloadMap['proposal_status_changed']): void {
    this.emit('proposal_status_changed', payload);
  }
  public emitLabAdded(payload: EventPayloadMap['lab_added']): void {
    this.emit('lab_added', payload);
  }
  public emitLabExtracted(payload: EventPayloadMap['lab_extracted']): void {
    this.emit('lab_extracted', payload);
  }
  public emitFactConfirmed(payload: EventPayloadMap['fact_confirmed']): void {
    this.emit('fact_confirmed', payload);
  }
  public emitFactAdded(payload: EventPayloadMap['fact_added']): void {
    this.emit('fact_added', payload);
  }
  public emitDangerReportAdded(payload: EventPayloadMap['danger_report_added']): void {
    this.emit('danger_report_added', payload);
  }
  public emitCalendarEventAdded(payload: EventPayloadMap['calendar_event_added']): void {
    this.emit('calendar_event_added', payload);
  }
  public emitDueCardAdded(payload: EventPayloadMap['due_card_added']): void {
    this.emit('due_card_added', payload);
  }
  public emitDueCardUpdated(payload: EventPayloadMap['due_card_updated']): void {
    this.emit('due_card_updated', payload);
  }
  public emitDoctorGrantAdded(payload: EventPayloadMap['doctor_grant_added']): void {
    this.emit('doctor_grant_added', payload);
  }
  public emitDoctorGrantRevoked(payload: EventPayloadMap['doctor_grant_revoked']): void {
    this.emit('doctor_grant_revoked', payload);
  }
  public emitCaregiverLinked(payload: EventPayloadMap['caregiver_linked']): void {
    this.emit('caregiver_linked', payload);
  }
  public emitQuestionAdded(payload: EventPayloadMap['question_added']): void {
    this.emit('question_added', payload);
  }
  public emitAuditLogged(payload: EventPayloadMap['audit_logged']): void {
    this.emit('audit_logged', payload);
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
      this.emit('highlight_document', payloadOrDocId);
    }
  }

  public onHighlightDocument(handler: (payload: HighlightDocumentPayload) => void): () => void {
    return this.on('highlight_document', handler);
  }

  public clearHistory(): void {
    this.emittedEvents = [];
  }

  public getEvents(eventName?: string): any[] {
    if (eventName) {
      return this.emittedEvents.filter(e => e.event === eventName);
    }
    return this.emittedEvents;
  }

  // Telemetry helper for M4 cohesion tests: count events per name
  public getEventCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const e of this.emittedEvents) {
      counts[e.event] = (counts[e.event] || 0) + 1;
    }
    return counts;
  }
}

export const eventBus = new WebMCPEventBus();
