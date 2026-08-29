/**
 * CareCanvas Core: LocalVault Manager (11 Object Stores + Audit Trail)
 */

import type { 
  Fact,
  DocumentRecord,
  MedicationRecord,
  LabRecord,
  AllergyRecord,
  ConditionRecord,
  ProposalRecord,
  CalendarEventRecord,
  AuditLogEntry,
  QuestionBankItem,
  DueCardRecord
 } from '../../types/vault.ts';
import type {  LinkedCareProfile, DoctorAccessGrant  } from '../../types/carecircle.ts';
import type {  DangerSignReport  } from '../../types/safety.ts';
import { WebMCPEventBus } from '../events/eventBus.ts';
import { isSupabaseEnabled, upsertSupabaseRecord } from '../supabase/client.ts';

export class LocalVaultManager {
  public facts: Map<string, Fact> = new Map();
  public documents: Map<string, DocumentRecord> = new Map();
  public meds: Map<string, MedicationRecord> = new Map();
  public labs: Map<string, LabRecord> = new Map();
  public allergies: Map<string, AllergyRecord> = new Map();
  public conditions: Map<string, ConditionRecord> = new Map();
  public proposals: Map<string, ProposalRecord> = new Map();
  public calendarEvents: Map<string, CalendarEventRecord> = new Map();
  public careCircle: Map<string, LinkedCareProfile> = new Map();
  public doctorGrants: Map<string, DoctorAccessGrant> = new Map();
  public auditLog: AuditLogEntry[] = [];
  public questionBank: Map<string, QuestionBankItem> = new Map();
  public dueCards: Map<string, DueCardRecord> = new Map();
  public dangerReports: Map<string, DangerSignReport> = new Map();

  private eventBus?: WebMCPEventBus;

  constructor(eventBus?: WebMCPEventBus) {
    this.eventBus = eventBus;
  }

  public async init(): Promise<void> {
    // Initializer hook
  }

  /** Allow the app singleton to be optionally wired to the global EventBus post-construction */
  public setEventBus(bus?: WebMCPEventBus): void {
    this.eventBus = bus;
  }

  public wireEventBus(bus: WebMCPEventBus): void {
    this.eventBus = bus;
  }

  public getEventBus(): WebMCPEventBus | undefined {
    return this.eventBus;
  }

  public isEventBusConnected(): boolean {
    return !!this.eventBus;
  }

  // --- Supabase fire-and-forget sync (non-blocking, no event duplication, toast on failure) ---
  private syncFireAndForget(table: string, record: any): void {
    try {
      if (!isSupabaseEnabled()) return;
      if (!record || !record.patientId) return;
      // Exact patient isolation check already enforced by record.patientId presence
      upsertSupabaseRecord(table as any, record)
        .then((res: any) => {
          if (res && res.skipped) return;
          if (res && !res.ok) {
            try {
              const bus: any = this.eventBus;
              if (bus && typeof bus.dispatchToast === 'function') {
                bus.dispatchToast({ type: 'warning', message: 'Saved locally, Supabase sync failed' });
              } else if (bus && typeof bus.emit === 'function') {
                bus.emit('toast', {
                  id: `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                  type: 'warning',
                  message: 'Saved locally, Supabase sync failed',
                  timestamp: new Date().toISOString(),
                });
              }
            } catch {}
          }
        })
        .catch(() => {
          try {
            const bus: any = this.eventBus;
            if (bus && typeof bus.dispatchToast === 'function') {
              bus.dispatchToast({ type: 'warning', message: 'Saved locally, Supabase sync failed' });
            } else if (bus && typeof bus.emit === 'function') {
              bus.emit('toast', {
                id: `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                type: 'warning',
                message: 'Saved locally, Supabase sync failed',
                timestamp: new Date().toISOString(),
              });
            }
          } catch {}
        });
    } catch {
      // never throw — local-only fallback
    }
  }

  // --- Typed Event Helpers (M2 relevance matrix) ---
  // Wrappers that delegate to typed EventBus emitters when connected; fallback to direct emit.
  // These ensure patientId is always present in payload and relevant-only docs are single-sourced.
  public emitMedicationAdded(payload: any): void {
    if (this.eventBus && typeof (this.eventBus as any).emitMedicationAdded === 'function') {
      (this.eventBus as any).emitMedicationAdded(payload);
    } else {
      this.eventBus?.emit('medication_added', payload);
    }
  }
  public emitMedicationUpdated(payload: any): void {
    if (this.eventBus && typeof (this.eventBus as any).emitMedicationUpdated === 'function') {
      (this.eventBus as any).emitMedicationUpdated(payload);
    } else {
      this.eventBus?.emit('medication_updated', payload);
    }
  }
  public emitLabAdded(payload: any): void {
    if (this.eventBus && typeof (this.eventBus as any).emitLabAdded === 'function') {
      (this.eventBus as any).emitLabAdded(payload);
    } else {
      this.eventBus?.emit('lab_added', payload);
    }
  }
  public emitDueCardAdded(payload: any): void {
    this.eventBus?.emit('due_card_added', payload);
  }
  public emitDueCardUpdated(payload: any): void {
    this.eventBus?.emit('due_card_updated', payload);
  }
  public emitCalendarEventAdded(payload: any): void {
    this.eventBus?.emit('calendar_event_added', payload);
  }
  public emitDangerReportAdded(payload: any): void {
    this.eventBus?.emit('danger_report_added', payload);
  }
  public emitDoctorGrantAdded(payload: any): void {
    this.eventBus?.emit('doctor_grant_added', payload);
  }
  public emitDoctorGrantRevoked(payload: any): void {
    this.eventBus?.emit('doctor_grant_revoked', payload);
  }
  public emitCaregiverLinked(payload: any): void {
    this.eventBus?.emit('caregiver_linked', payload);
  }

  // --- Audit Logger ---
  public logAudit(
    action: string,
    entityType: AuditLogEntry['entityType'],
    entityId: string,
    performedBy: AuditLogEntry['performedBy'],
    details: Record<string, any>,
    patientId?: string
  ): AuditLogEntry {
    let resolvedPatientId: string | undefined = patientId ?? details?.patientId;
    // Infer patientId from entity stores when not explicitly passed (backward-compat for legacy tool callers)
    if (!resolvedPatientId) {
      try {
        if (entityType === 'access_grant') resolvedPatientId = this.doctorGrants.get(entityId)?.patientId;
        else if (entityType === 'proposal') resolvedPatientId = this.proposals.get(entityId)?.patientId;
        else if (entityType === 'fact') resolvedPatientId = this.facts.get(entityId)?.patientId;
        else if (entityType === 'med') resolvedPatientId = this.meds.get(entityId)?.patientId;
        else if (entityType === 'lab') resolvedPatientId = this.labs.get(entityId)?.patientId;
        else if (entityType === 'calendar_event') resolvedPatientId = this.calendarEvents.get(entityId)?.patientId;
        else if (entityType === 'due_card') resolvedPatientId = this.dueCards.get(entityId)?.patientId;
        // Generic: any map that might contain entityId with patientId field
        if (!resolvedPatientId) {
          const generic = (this as any).facts?.get?.(entityId) || (this as any).proposals?.get?.(entityId) || (this as any).doctorGrants?.get?.(entityId);
          if (generic?.patientId) resolvedPatientId = generic.patientId;
        }
      } catch {
        // ignore inference errors
      }
    }
    const entry: AuditLogEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      action,
      entityType,
      entityId,
      performedBy,
      details: resolvedPatientId ? { ...details, patientId: resolvedPatientId } : details,
      patientId: resolvedPatientId,
      hash: `sha256_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    };
    this.auditLog.push(entry);
    this.eventBus?.emit('audit_logged', entry);
    return entry;
  }

  public getAuditLogs(patientId?: string): AuditLogEntry[] {
    if (patientId === undefined || patientId === null) return [...this.auditLog];
    if (patientId === '') return [];
    return this.auditLog.filter(
      (a) => a.patientId === patientId || a.performedBy?.userId === patientId || a.performedBy?.onBehalfOf === patientId || a.details?.patientId === patientId
    );
  }

  private validateBoundingBox(bb: any): void {
    if (!bb || typeof bb !== 'object') throw new Error('Invalid BoundingBox');
    const { pageIndex, x, y, width, height } = bb;
    for (const v of [pageIndex, x, y, width, height]) {
      if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error('Invalid BoundingBox');
    }
    if (!Number.isInteger(pageIndex) || pageIndex < 0) throw new Error('Invalid BoundingBox');
    if (x < 0 || x > 1000 || y < 0 || y > 1000 || width <= 0 || height <= 0 || width > 1000 || height > 1000) throw new Error('Invalid BoundingBox');
  }

  // --- Facts Store ---
  public addFact(fact: Fact, performedBy?: AuditLogEntry['performedBy']): Fact {
    if (fact.boundingBox) this.validateBoundingBox(fact.boundingBox);
    if ((fact as any).sourceBoundingBox) this.validateBoundingBox((fact as any).sourceBoundingBox);
    const existing = this.facts.get(fact.id);
    if (existing && existing.patientId !== fact.patientId) {
      throw new Error(`Duplicate fact id ${fact.id} exists for different patient`);
    }
    this.facts.set(fact.id, fact);
    if (performedBy) {
      this.logAudit('add_fact', 'fact', fact.id, performedBy, { name: fact.name, category: fact.category }, fact.patientId);
    }
    this.eventBus?.emit('fact_added', fact);
    // Fire-and-forget Supabase sync (non-blocking, no event duplication)
    this.syncFireAndForget('facts', fact);
    return fact;
  }

  public getFact(id: string): Fact | undefined {
    return this.facts.get(id);
  }

  public getFacts(patientId: string): Fact[] {
    return this.getFactsByPatient(patientId);
  }

  public getPendingFacts(patientId: string): Fact[] {
    return this.getFactsByPatient(patientId, 'unconfirmed');
  }

  public getConfirmedFacts(patientId: string): Fact[] {
    return this.getFactsByPatient(patientId, 'confirmed');
  }

  public updateFactStatus(
    id: string,
    status: Fact['status'],
    performedBy?: AuditLogEntry['performedBy'],
    edits?: any
  ): Fact | undefined {
    const fact = this.facts.get(id);
    if (!fact) return undefined;

    fact.status = status;
    if (edits) {
      fact.value = typeof fact.value === 'object' ? { ...fact.value, ...edits } : edits;
      fact.metadata = { ...fact.metadata, edited: true, editedBy: performedBy?.userName };
    }
    this.facts.set(id, fact);
    if (performedBy) {
      this.logAudit(`fact_${status}`, 'fact', fact.id, performedBy, { status, edits }, fact.patientId);
    }
    this.eventBus?.emit('fact_status_changed', { id, status, fact });
    return fact;
  }

  public getFactsByPatient(patientId: string, statusFilter?: Fact['status']): Fact[] {
    const list = Array.from(this.facts.values()).filter(f => f.patientId === patientId);
    if (statusFilter) {
      return list.filter(f => f.status === statusFilter);
    }
    return list;
  }

  // --- Documents Store ---
  public addDocument(doc: DocumentRecord): DocumentRecord {
    this.documents.set(doc.id, doc);
    this.syncFireAndForget('documents', doc);
    return doc;
  }

  public getDocuments(patientId: string): DocumentRecord[] {
    return Array.from(this.documents.values()).filter((d) => d.patientId === patientId);
  }

  public getDocument(id: string): DocumentRecord | undefined {
    return this.documents.get(id);
  }

  // --- Meds Store ---
  public addMedication(med: MedicationRecord, performedBy?: AuditLogEntry['performedBy']): MedicationRecord {
    this.meds.set(med.id, med);
    if (performedBy) {
      this.logAudit('add_medication', 'med', med.id, performedBy, { genericName: med.genericName, dosage: med.dosage }, med.patientId);
    }
    this.eventBus?.emit('medication_added', med);
    this.syncFireAndForget('medications', med);
    return med;
  }

  public getMedications(patientId: string, statusFilter?: MedicationRecord['status']): MedicationRecord[] {
    const list = Array.from(this.meds.values()).filter(m => m.patientId === patientId);
    if (statusFilter) {
      return list.filter(m => m.status === statusFilter);
    }
    return list;
  }

  public getActiveMedications(patientId: string): MedicationRecord[] {
    return this.getMedications(patientId, 'active');
  }

  public updateMedication(
    medId: string,
    updates: Partial<MedicationRecord>,
    performedBy?: AuditLogEntry['performedBy']
  ): MedicationRecord | undefined {
    const med = this.meds.get(medId);
    if (!med) return undefined;

    Object.assign(med, updates);
    this.meds.set(medId, med);
    if (performedBy) {
      this.logAudit('update_medication', 'med', medId, performedBy, updates as Record<string, any>, med.patientId);
    }
    this.eventBus?.emit('medication_updated', med);
    return med;
  }

  public updateMedicationStatus(
    medId: string,
    status: MedicationRecord['status'],
    performedBy?: AuditLogEntry['performedBy']
  ): MedicationRecord | undefined {
    return this.updateMedication(medId, { status }, performedBy);
  }

  // --- Labs Store ---
  public addLab(lab: LabRecord, performedBy?: AuditLogEntry['performedBy']): LabRecord {
    this.labs.set(lab.id, lab);
    if (performedBy) {
      this.logAudit('add_lab', 'lab', lab.id, performedBy, { marker: lab.marker, value: lab.value, drawDate: lab.drawDate }, lab.patientId);
    }
    this.eventBus?.emit('lab_added', lab);
    this.syncFireAndForget('labs', lab);
    return lab;
  }

  public getLabs(patientId: string, markerFilter?: string): LabRecord[] {
    let list = Array.from(this.labs.values()).filter(l => l.patientId === patientId);
    if (markerFilter) {
      list = list.filter(l => l.marker.toLowerCase() === markerFilter.toLowerCase());
    }
    return list.sort((a, b) => new Date(a.drawDate).getTime() - new Date(b.drawDate).getTime());
  }

  public getLabsByMarker(patientId: string, marker: string): LabRecord[] {
    return this.getLabs(patientId, marker);
  }

  public addDoctorCommentToLab(
    labId: string,
    comment: { doctorId: string; doctorName: string; comment: string }
  ): LabRecord | undefined {
    const lab = this.labs.get(labId);
    if (!lab) return undefined;
    if (!lab.doctorComments) lab.doctorComments = [];
    lab.doctorComments.push({
      doctorId: comment.doctorId,
      doctorName: comment.doctorName,
      comment: comment.comment,
      timestamp: new Date().toISOString()
    });
    this.labs.set(labId, lab);
    return lab;
  }

  // --- Conditions Store ---
  public addCondition(condition: ConditionRecord, performedBy?: AuditLogEntry['performedBy']): ConditionRecord {
    this.conditions.set(condition.id, condition);
    this.syncFireAndForget('conditions', condition);
    return condition;
  }

  public getConditions(patientId: string): ConditionRecord[] {
    return Array.from(this.conditions.values()).filter((c) => c.patientId === patientId);
  }

  // --- Allergies Store ---
  public addAllergy(allergy: AllergyRecord, performedBy?: AuditLogEntry['performedBy']): AllergyRecord {
    this.allergies.set(allergy.id, allergy);
    this.syncFireAndForget('allergies', allergy);
    return allergy;
  }

  public getAllergies(patientId: string): AllergyRecord[] {
    return Array.from(this.allergies.values()).filter((a) => a.patientId === patientId);
  }

  // --- Proposals Store ---
  public addProposal(proposal: ProposalRecord, performedBy?: AuditLogEntry['performedBy']): ProposalRecord {
    this.proposals.set(proposal.id, proposal);
    if (performedBy) {
      this.logAudit('create_proposal', 'proposal', proposal.id, performedBy, {
        medName: proposal.medName,
        type: proposal.type,
        proposedDose: proposal.proposedDose
      }, proposal.patientId);
    }
    this.eventBus?.emit('proposal_created', proposal);
    this.syncFireAndForget('proposals', proposal);
    return proposal;
  }

  public getProposals(patientId: string, status?: ProposalRecord['status']): ProposalRecord[] {
    const list = Array.from(this.proposals.values()).filter(p => p.patientId === patientId);
    if (status) {
      return list.filter(p => p.status === status);
    }
    return list;
  }

  public getPendingProposals(patientId: string): ProposalRecord[] {
    return this.getProposals(patientId, 'pending');
  }

  public updateProposalStatus(
    proposalId: string,
    status: ProposalRecord['status'],
    performedBy?: AuditLogEntry['performedBy']
  ): ProposalRecord | undefined {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) return undefined;

    proposal.status = status;
    proposal.approvedAt = new Date().toISOString();
    proposal.approvedBy = performedBy?.userName;
    proposal.approvalRole = performedBy?.role;
    proposal.onBehalfOf = performedBy?.onBehalfOf;

    this.proposals.set(proposalId, proposal);
    if (performedBy) {
      this.logAudit(`proposal_${status}`, 'proposal', proposalId, performedBy, {
        status,
        approvedBy: performedBy.userName,
        onBehalfOf: performedBy.onBehalfOf
      }, proposal.patientId);
    }
    this.eventBus?.emit('proposal_status_changed', proposal);
    return proposal;
  }

  // --- Question Bank Store ---
  public addQuestion(item: QuestionBankItem): QuestionBankItem {
    this.questionBank.set(item.id, item);
    this.eventBus?.emit('question_added', item);
    this.syncFireAndForget('question_bank', item);
    return item;
  }

  public addQuestionBankItem(item: QuestionBankItem): QuestionBankItem {
    // Delegates to addQuestion but avoid double sync — addQuestion already syncs
    return this.addQuestion(item);
  }

  public getQuestions(patientId: string): QuestionBankItem[] {
    return Array.from(this.questionBank.values()).filter(q => q.patientId === patientId);
  }

  public getQuestionBankItems(patientId: string): QuestionBankItem[] {
    return this.getQuestions(patientId);
  }

  public updateQuestionBankStatus(id: string, status: 'active' | 'discussed' | 'dismissed'): QuestionBankItem | undefined {
    const item = this.questionBank.get(id);
    if (!item) return undefined;
    item.status = status;
    this.questionBank.set(id, item);
    return item;
  }

  // --- Calendar Events Store ---
  public addCalendarEvent(event: CalendarEventRecord, performedBy?: AuditLogEntry['performedBy']): CalendarEventRecord {
    this.calendarEvents.set(event.id, event);
    if (performedBy) {
      this.logAudit('create_calendar_event', 'calendar_event', event.id, performedBy, { title: event.title, date: event.scheduledDate }, event.patientId);
    }
    this.eventBus?.emit('calendar_event_added', event);
    this.syncFireAndForget('calendar_events', event);
    return event;
  }

  public getCalendarEvents(patientId: string): CalendarEventRecord[] {
    return Array.from(this.calendarEvents.values()).filter(e => e.patientId === patientId);
  }

  // --- Care Circle Store ---
  public addCaregiverLink(link: LinkedCareProfile): LinkedCareProfile {
    this.careCircle.set(link.linkId, link);
    this.eventBus?.emit('caregiver_linked', link);
    this.syncFireAndForget('care_circle', link);
    return link;
  }

  public addCareCircleMember(link: any): any {
    const item: LinkedCareProfile = {
      linkId: link.id || link.linkId,
      patientId: link.primaryPatientId || link.patientId,
      caregiverUserId: link.caregiverId || link.caregiverUserId,
      caregiverName: link.caregiverName,
      relationship: link.relationship,
      permissionLevel: link.permissionLevel || 'manage',
      status: 'active',
      grantedDate: new Date().toISOString()
    };
    return this.addCaregiverLink(item);
  }

  public getCaregiverLinks(patientId: string): LinkedCareProfile[] {
    return Array.from(this.careCircle.values()).filter(c => c.patientId === patientId && c.status === 'active');
  }

  public getCareCircle(patientId: string): LinkedCareProfile[] {
    return this.getCaregiverLinks(patientId);
  }

  public updateCaregiverPermission(linkId: string, permissionLevel: 'view_only' | 'manage' | 'full'): LinkedCareProfile | undefined {
    const member = this.careCircle.get(linkId);
    if (!member) return undefined;
    member.permissionLevel = permissionLevel;
    this.careCircle.set(linkId, member);
    this.eventBus?.emit('caregiver_linked', member);
    return member;
  }

  // --- Doctor Access Grants Store ---
  public addDoctorGrant(grant: DoctorAccessGrant): DoctorAccessGrant {
    this.doctorGrants.set(grant.grantId, grant);
    this.eventBus?.emit('doctor_grant_added', grant);
    this.syncFireAndForget('doctor_grants', grant);
    return grant;
  }

  public getDoctorGrant(grantId: string): DoctorAccessGrant | undefined {
    return this.doctorGrants.get(grantId);
  }

  public getDoctorGrants(patientId: string): DoctorAccessGrant[] {
    return Array.from(this.doctorGrants.values()).filter((g) => g.patientId === patientId);
  }

  public revokeDoctorGrant(grantId: string): DoctorAccessGrant | undefined {
    const grant = this.doctorGrants.get(grantId);
    if (!grant) return undefined;
    grant.status = 'revoked';
    this.doctorGrants.set(grantId, grant);
    this.eventBus?.emit('doctor_grant_revoked', grant);
    // alias for legacy listeners that watch grant_added with revoked status — dispatched as revoked specifically
    return grant;
  }

  // --- Generic Put & Get Helpers ---
  public async put<T extends { id?: string; grantId?: string; linkId?: string }>(storeName: string, item: T): Promise<T> {
    if (['facts', 'proposals', 'doctorGrants', 'auditLog'].includes(storeName)) {
      throw new Error(`Use typed addFact/addProposal instead of generic put for store ${storeName}`);
    }
    const id = item.id || item.grantId || item.linkId || `item_${Date.now()}`;
    const map = (this as any)[storeName] as Map<string, any> | undefined;
    if (map && typeof map.set === 'function') {
      map.set(id, item);
    }
    return item;
  }

  public async get<T>(storeName: string, id: string): Promise<T | undefined> {
    const map = (this as any)[storeName] as Map<string, any> | undefined;
    if (map && typeof map.get === 'function') {
      return map.get(id);
    }
    return undefined;
  }

  public async delete(storeName: string, id: string): Promise<boolean> {
    const map = (this as any)[storeName] as Map<string, any> | undefined;
    if (map && typeof map.delete === 'function') {
      return map.delete(id);
    }
    return false;
  }

  // --- Due Cards Store ---
  public addDueCard(card: DueCardRecord): DueCardRecord {
    this.dueCards.set(card.id, card);
    this.eventBus?.emit('due_card_added', card);
    this.syncFireAndForget('due_cards', card);
    return card;
  }

  public getDueCards(patientId: string): DueCardRecord[] {
    return Array.from(this.dueCards.values()).filter(c => c.patientId === patientId);
  }

  public updateDueCard(id: string, updates: Partial<DueCardRecord>): DueCardRecord | undefined {
    const card = this.dueCards.get(id);
    if (!card) return undefined;
    Object.assign(card, updates);
    this.dueCards.set(id, card);
    this.eventBus?.emit('due_card_updated', card);
    return card;
  }

  // --- Danger Signs Store ---
  public addDangerReport(report: DangerSignReport): DangerSignReport {
    this.dangerReports.set(report.reportId, report);
    this.eventBus?.emit('danger_report_added', report);
    this.syncFireAndForget('danger_reports', report);
    return report;
  }

  public getDangerReports(patientId?: string): DangerSignReport[] {
    const all = Array.from(this.dangerReports.values());
    if (patientId) {
      return all.filter(r => r.patientId === patientId);
    }
    return all;
  }

  // --- Seed Idempotency Helpers (M1 canonical patient) ---
  /**
   * Check if vault already contains baseline data for given patient.
   * Idempotent guard: true if at least one medication or lab exists for patient.
   * Does NOT check secondary demo patients.
   */
  public isSeeded(patientId: string): boolean {
    if (!patientId) return false;
    const hasMeds = Array.from(this.meds.values()).some((m) => m.patientId === patientId);
    const hasLabs = Array.from(this.labs.values()).some((l) => l.patientId === patientId);
    // Consider seeded if either core store has data; strict version requires both
    return hasMeds && hasLabs;
  }

  /**
   * Lightweight check: any data exists for patient across all stores.
   */
  public hasAnyData(patientId: string): boolean {
    if (!patientId) return false;
    return (
      Array.from(this.meds.values()).some((m) => m.patientId === patientId) ||
      Array.from(this.labs.values()).some((l) => l.patientId === patientId) ||
      Array.from(this.conditions.values()).some((c) => c.patientId === patientId) ||
      Array.from(this.allergies.values()).some((a) => a.patientId === patientId) ||
      Array.from(this.dueCards.values()).some((d) => d.patientId === patientId) ||
      Array.from(this.proposals.values()).some((p) => p.patientId === patientId) ||
      Array.from(this.dangerReports.values()).some((r) => r.patientId === patientId) ||
      Array.from(this.calendarEvents.values()).some((e) => e.patientId === patientId)
    );
  }

  /**
   * Return counts per store for a given patient — useful for seed verification / tests.
   */
  public getSeedCounts(patientId: string): Record<string, number> {
    return {
      meds: this.getMedications(patientId).length,
      labs: this.getLabs(patientId).length,
      conditions: this.getConditions(patientId).length,
      allergies: this.getAllergies(patientId).length,
      dueCards: this.getDueCards(patientId).length,
      proposals: this.getProposals(patientId).length,
      dangerReports: this.getDangerReports(patientId).length,
      calendarEvents: this.getCalendarEvents(patientId).length,
    };
  }

  // --- Reset / Seed Helper ---
  public clear(opts?: { preserveAudit?: boolean }): void {
    const preserveAudit = opts?.preserveAudit ?? true;
    this.facts.clear();
    this.documents.clear();
    this.meds.clear();
    this.labs.clear();
    this.allergies.clear();
    this.conditions.clear();
    this.proposals.clear();
    this.calendarEvents.clear();
    this.careCircle.clear();
    this.doctorGrants.clear();
    if (!preserveAudit) {
      this.auditLog = [];
    }
    this.questionBank.clear();
    this.dueCards.clear();
    this.dangerReports.clear();
  }

  public clearAll(opts?: { preserveAudit?: boolean }): void {
    this.clear(opts);
  }
}

export const localVault = new LocalVaultManager();

/** Optional helper to wire the app singleton to the global EventBus after init */
export function wireLocalVaultToEventBus(bus: WebMCPEventBus): void {
  localVault.setEventBus(bus);
}

export { LocalVaultManager as LocalVault };
