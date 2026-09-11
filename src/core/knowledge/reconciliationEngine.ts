
import { ClinicalInteractionEngine, normalizeMedName, type DietFlags } from './interactionEngine.ts';
import type {
  PreAdmissionMedItem,
  InHospitalMedItem,
  DischargeMedItem,
  ReconciledMedChangeItem,
  ChangeStatusBadge,
  FlaggedReconciliationInteraction,
  FlaggedDietInteraction,
  TeachBackCheck,
  PatientHomeSummaryExport,
  Patient3ListDischargeDataset
} from '../../types/rxbridge.ts';
import type { TimeSlot } from '../../types/pillmap.ts';
import { callAI } from '../ai/client.ts';

async function callReconciliationAI(
  systemPrompt: string,
  userText: string,
  jsonSchema: any,
  imageDataUrl?: string
): Promise<any | null> {
  try {
    return await callAI<any>(systemPrompt, userText, {
      schema: jsonSchema,
      imageDataUrl,
    });
  } catch (err) {
    console.warn('[reconciliationEngine] AI call failed, falling back to clinical rules:', (err as any)?.message || err);
    return null;
  }
}

function genericForMatch(rawName: string, aliasMap?: Record<string, string>): string {
  const trimmed = (rawName || '').trim();
  if (!trimmed) return trimmed;
  if (aliasMap) {
    for (const [input, generic] of Object.entries(aliasMap)) {
      if (normalizeMedName(input) === normalizeMedName(trimmed) && generic.trim() !== '') {
        return generic.trim();
      }
    }
  }
  return trimmed;
}

export class ClinicalReconciliationEngine {

  public static reconcileThreeLists(dataset: Patient3ListDischargeDataset, aliasMap?: Record<string, string>): ReconciledMedChangeItem[] {
    const { preAdmissionMeds, inHospitalMeds, dischargeMeds } = dataset;
    const reconciledItems: ReconciledMedChangeItem[] = [];
    const processedGenericNames = new Set<string>();

    let seq = 0;
    const nextMedId = (generic: string): string =>
      `recon_${generic.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${seq++}`;

    for (const dMed of dischargeMeds) {
      const generic = genericForMatch(dMed.medName, aliasMap);
      processedGenericNames.add(generic.toLowerCase());

      const preMatch = preAdmissionMeds.find(
        (p) =>
          genericForMatch(p.medName, aliasMap).toLowerCase() === generic.toLowerCase() ||
          p.medName.toLowerCase().includes(generic.toLowerCase()) ||
          dMed.medName.toLowerCase().includes(p.medName.toLowerCase())
      );

      const hospMatch = inHospitalMeds.find(
        (h) =>
          genericForMatch(h.medName, aliasMap).toLowerCase() === generic.toLowerCase() ||
          h.medName.toLowerCase().includes(generic.toLowerCase()) ||
          dMed.medName.toLowerCase().includes(h.medName.toLowerCase())
      );

      const statusBadge = this.determineStatusBadge(
        preMatch?.dose,
        hospMatch?.dose || hospMatch?.statusChange,
        dMed.dose,
        dMed.status
      );

      reconciledItems.push({
        medId: nextMedId(generic),
        medName: dMed.medName,
        genericName: generic,
        preHospDose: preMatch?.dose || 'None',
        preHospFrequency: preMatch?.frequency,
        inHospAction: hospMatch ? (hospMatch.reason ? `${hospMatch.dose || ''} (${hospMatch.reason})` : hospMatch.dose) : 'Administered as needed',
        inHospReason: hospMatch?.reason,
        dischargeDose: dMed.dose,
        dischargeFrequency: dMed.frequency,
        statusBadge,
        plainLanguageExplanation: '',
        documentedReason: dMed.reason,
        isApprovedByPatient: false,
        suggestedQuestions: [],
        timingSlots: dMed.timingSlots,
        dietInstructions: dMed.dietInstructions,
        isOTC: preMatch?.isOTC || false
      });
    }

    for (const pMed of preAdmissionMeds) {
      const generic = genericForMatch(pMed.medName, aliasMap);
      if (!processedGenericNames.has(generic.toLowerCase())) {
        processedGenericNames.add(generic.toLowerCase());

        const hospMatch = inHospitalMeds.find(
          (h) =>
            genericForMatch(h.medName, aliasMap).toLowerCase() === generic.toLowerCase() ||
            h.medName.toLowerCase().includes(generic.toLowerCase()) ||
            pMed.medName.toLowerCase().includes(h.medName.toLowerCase())
        );

        const statusBadge: ChangeStatusBadge = 'STOPPED';
        reconciledItems.push({
          medId: nextMedId(generic),
          medName: pMed.medName,
          genericName: generic,
          preHospDose: pMed.dose,
          preHospFrequency: pMed.frequency,
          inHospAction: hospMatch ? `${hospMatch.dose || 'Held'} - ${hospMatch.reason || ''}` : 'Discontinued in hospital',
          inHospReason: hospMatch?.reason,
          dischargeDose: '0mg (Discontinued)',
          dischargeFrequency: 'DO NOT TAKE',
          statusBadge,
          plainLanguageExplanation: '',
          documentedReason: hospMatch?.reason || 'Omitted on discharge orders',
          isApprovedByPatient: false,
          suggestedQuestions: [],
          isOTC: pMed.isOTC || false
        });
      }
    }

    return reconciledItems;
  }

  public static async reconcileThreeListsAI(
    dataset: Patient3ListDischargeDataset,
    opts?: { imageDataUrl?: string; documentContext?: string; dietFlags?: Partial<DietFlags> }
  ): Promise<ReconciledMedChangeItem[]> {

    let aliasMap: Record<string, string> = {};
    try {
      const allNames = [
        ...dataset.preAdmissionMeds.map((m) => m.medName),
        ...dataset.inHospitalMeds.map((m) => 'dose' in m ? (m as InHospitalMedItem).medName : ''),
        ...dataset.dischargeMeds.map((m) => m.medName),
      ].filter(Boolean);
      aliasMap = await ClinicalInteractionEngine.resolveGenerics(allNames);
    } catch (e) {
      console.warn('[reconciliationEngine] alias resolution failed, matching literally:', (e as any)?.message || e);
    }

    const items = this.reconcileThreeLists(dataset, aliasMap);

    const schema = {
      type: 'object',
      properties: {
        explanations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              medId: { type: 'string' },
              plainExplanation: { type: 'string' },
              questions: { type: 'array', items: { type: 'string' } },
              confidence: { type: 'number', minimum: 0, maximum: 1 },
              reasoning: { type: 'string' }
            },
            required: ['medId', 'plainExplanation', 'questions', 'confidence', 'reasoning'],
            additionalProperties: false,
          }
        }
      },
      required: ['explanations'],
      additionalProperties: false,
    } as any;
    const systemPrompt = `You are a clinical discharge reconciliation specialist. Given 3-list medication changes, generate grounded plain-language explanations and targeted doctor questions per medication. Consider clinical transition rationale, dose modifications, acute versus chronic indications, organ system monitoring requirements, and document context. Return ONLY valid JSON with shape {"explanations": [{"medId": string, "plainExplanation": string, "questions": string[], "confidence": number, "reasoning": string}]}. Provide confidence 0-1 and grounded reasoning. Use vision+text context if provided. No markdown.`;
    const itemsSummary = items.map(i => ({
      medId: i.medId,
      medName: i.medName,
      generic: i.genericName,
      statusBadge: i.statusBadge,
      preHospDose: i.preHospDose,
      dischargeDose: i.dischargeDose,
      reason: i.documentedReason,
      preHospFrequency: i.preHospFrequency,
    }));
    const docContext = opts?.documentContext ? `Document context: ${opts.documentContext.slice(0, 2000)}` : 'No additional document context.';
    const userText = `Dataset patient ${dataset.patientId} (${dataset.patientName}) ward ${dataset.ward}\nItems: ${JSON.stringify(itemsSummary)}\n${docContext}\nGenerate grounded explanations and questions with confidence. Return JSON only.`;
    const parsed = await callReconciliationAI(systemPrompt, userText, schema, opts?.imageDataUrl);
    if (!parsed || !Array.isArray(parsed.explanations) || parsed.explanations.length === 0) {
      throw new Error('Reconciliation AI returned no usable explanations');
    }
    const map = new Map<string, any>(parsed.explanations.map((e: any) => [e.medId, e]));
    for (const item of items) {
      const ai = map.get(item.medId);
      if (ai && typeof ai.plainExplanation === 'string' && ai.plainExplanation.length > 20) {
        item.plainLanguageExplanation = ai.plainExplanation;
      }
      if (ai && Array.isArray(ai.questions) && ai.questions.length > 0) {
        item.suggestedQuestions = ai.questions;
      }
    }

    try {
      await this.enrichInteractionsAI(items, dataset, opts?.dietFlags);
    } catch (e) {
      console.warn('[reconciliationEngine] AI interaction screening failed, items keep narratives:', (e as any)?.message || e);
    }
    return items;
  }

  public static async generatePlainLanguageExplanationAI(
    medName: string,
    generic: string,
    preDose?: string,
    hospAction?: string,
    postDose?: string,
    statusBadge?: ChangeStatusBadge,
    reason?: string,
    opts?: { imageDataUrl?: string; documentContext?: string }
  ): Promise<string> {
    const schema = {
      type: 'object',
      properties: {
        plainExplanation: { type: 'string', description: 'Plain language explanation' },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        reasoning: { type: 'string' }
      },
      required: ['plainExplanation', 'confidence', 'reasoning'],
      additionalProperties: false,
    } as any;
    const systemPrompt = `You are a clinical discharge educator. Generate an accessible plain-language explanation for a medication change given pre-admission dose, in-hospital action, discharge dose, status badge, and clinical reason. Ground the explanation in therapeutic indications, safety considerations, and clinical document context if provided. Return ONLY valid JSON with shape {"plainExplanation": string, "confidence": number, "reasoning": string}. Be concise, include grounded reasoning and confidence. No markdown.`;
    const preStr = preDose && preDose !== 'None' ? preDose : 'no home dose';
    const postStr = postDose || 'discontinued';
    const docCtx = opts?.documentContext ? `Document: ${opts.documentContext.slice(0, 1500)}` : 'No document context';
    const userText = `Med: ${medName} (generic ${generic})\nPre: ${preStr}\nHosp: ${hospAction || 'none'}\nPost: ${postStr}\nStatus: ${statusBadge}\nReason: ${reason || 'clinical review'}\n${docCtx}\nGenerate JSON only.`;
    const parsed = await callReconciliationAI(systemPrompt, userText, schema, opts?.imageDataUrl);
    if (parsed && typeof parsed.plainExplanation === 'string' && parsed.plainExplanation.length > 15) {
      return parsed.plainExplanation;
    }
    throw new Error('Discharge explanation unavailable from the AI pipeline');
  }

  public static async generateDoctorQuestionsAI(
    medName: string,
    generic: string,
    statusBadge: ChangeStatusBadge,
    preDose?: string,
    postDose?: string,
    opts?: { imageDataUrl?: string; documentContext?: string }
  ): Promise<string[]> {
    const schema = {
      type: 'object',
      properties: {
        questions: { type: 'array', items: { type: 'string' }, description: 'Doctor questions' },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        reasoning: { type: 'string' }
      },
      required: ['questions', 'confidence', 'reasoning'],
      additionalProperties: false,
    } as any;
    const systemPrompt = `You are a clinical care coordinator. Generate targeted doctor questions for a medication change (status badge, doses, reason). Use vision+text document context if available. Return ONLY valid JSON with shape {"questions": string[], "confidence": number, "reasoning": string}. Questions should be actionable and focused on monitoring timelines, therapeutic efficacy, and safety precautions. Include confidence and grounded reasoning. No markdown.`;
    const docCtx = opts?.documentContext ? `Document: ${opts.documentContext.slice(0, 1500)}` : 'No document context';
    const userText = `Med: ${medName} (generic ${generic})\nStatus: ${statusBadge}\nPre: ${preDose || 'none'}\nPost: ${postDose || 'none'}\n${docCtx}\nGenerate JSON only.`;
    const parsed = await callReconciliationAI(systemPrompt, userText, schema, opts?.imageDataUrl);
    if (parsed && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
      return parsed.questions.filter((q: any) => typeof q === 'string' && q.trim().length > 5);
    }
    throw new Error('Doctor-question generation unavailable from the AI pipeline');
  }

    public static determineStatusBadge(
    preDose?: string,
    hospAction?: string,
    postDose?: string,
    explicitStatus?: ChangeStatusBadge
  ): ChangeStatusBadge {
    if (explicitStatus) {
      return explicitStatus;
    }

    const pre = (preDose || '').trim().toLowerCase();
    const post = (postDose || '').trim().toLowerCase();
    const hosp = (hospAction || '').trim().toLowerCase();

    if (post === '0mg' || post === 'discontinued' || post === 'stopped' || post === 'none' || post === '') {
      return 'STOPPED';
    }

    if (!preDose || pre === 'none' || pre === '0mg' || pre === '') {
      return 'NEW';
    }

    if (pre !== post && post !== 'none') {
      return 'DOSE_CHANGED';
    }

    if (hosp.includes('held') || hosp.includes('paused') || hosp.includes('suspended')) {
      return 'HELD_AND_RESUMED';
    }

    return 'CONTINUED';
  }

  public static async enrichInteractionsAI(
    items: ReconciledMedChangeItem[],
    dataset: Patient3ListDischargeDataset,
    dietFlags?: Partial<DietFlags>
  ): Promise<void> {
    const activeDischargeMeds = items.filter((i) => i.statusBadge !== 'STOPPED').map((i) => i.medName);
    const preOTCs = dataset.preAdmissionMeds.filter((p) => p.isOTC).map((p) => p.medName);
    const rawArcs = await ClinicalInteractionEngine.checkDrugInteractions([...activeDischargeMeds, ...preOTCs]);
    const flaggedInteractions: FlaggedReconciliationInteraction[] = rawArcs.map((arc) => {
        const isOTC = preOTCs.some(
          (otc) => arc.drugA.toLowerCase().includes(otc.toLowerCase()) || arc.drugB.toLowerCase().includes(otc.toLowerCase())
        );
        return {
          id: arc.id,
          drugA: arc.drugA,
          drugB: arc.drugB,
          severity: arc.severity as 'CONTRAINDICATED' | 'MAJOR' | 'MODERATE',
          mechanism: arc.mechanism,
          clinicalGuidance: arc.clinicalGuidance,
          isPreAdmitOTC: isOTC
        };
    });
    const dietBadges = await ClinicalInteractionEngine.checkDietInteractions(activeDischargeMeds, {
        drinksGrapefruitDaily: Boolean(dietFlags?.drinksGrapefruitDaily),
        frequentHighVitKGreens: Boolean(dietFlags?.frequentHighVitKGreens),
        dairyBreakfast: Boolean(dietFlags?.dairyBreakfast),
        usesPotassiumSaltSubstitute: Boolean(dietFlags?.usesPotassiumSaltSubstitute)
    });
    const flaggedDiet: FlaggedDietInteraction[] = dietBadges.map((badge) => ({
        id: badge.id,
        medName: badge.drugName,
        dietItem: badge.dietItem,
        severity: badge.severity as 'CONTRAINDICATED' | 'MAJOR' | 'MODERATE',
        badge: badge.badgeText,
        mechanism: badge.mechanism,
        clinicalGuidance: badge.clinicalGuidance
    }));
    for (const item of items) {
        const generic = item.genericName?.toLowerCase();
        item.interactions = flaggedInteractions.filter(
          (fi) =>
            fi.drugA.toLowerCase().includes(generic) ||
            fi.drugB.toLowerCase().includes(generic) ||
            item.medName.toLowerCase().includes(fi.drugA.toLowerCase()) ||
            item.medName.toLowerCase().includes(fi.drugB.toLowerCase())
        );
        item.dietInteractions = flaggedDiet.filter(
          (fd) =>
            fd.medName.toLowerCase().includes(generic) ||
            item.medName.toLowerCase().includes(fd.medName.toLowerCase())
        );
      }
  }

  public static evaluateTeachBack(
    patientResponse: string,
    dataset: Patient3ListDischargeDataset
  ): TeachBackCheck {
    const text = patientResponse.trim().toLowerCase();

    const stoppedMedItems = dataset.dischargeMeds.filter((d) => d.status === 'STOPPED');
    const stoppedMeds = stoppedMedItems.map((d) => normalizeMedName(d.medName));

    const isStoppedMedAffirmative = stoppedMeds.some((m) => {
      if (!text.includes(m)) return false;
      const hasNegativeIntent =
        text.includes('stop') ||
        text.includes('not take') ||
        text.includes('wont take') ||
        text.includes("won't take") ||
        text.includes('avoid') ||
        text.includes('discard') ||
        text.includes('discontinued') ||
        text.includes('do not');
      return !hasNegativeIntent;
    });

    if (isStoppedMedAffirmative) {
      const stoppedExample = stoppedMedItems.slice(0, 2).map((s) => s.medName).join(' or ') || 'discontinued medications';
      return {
        patientId: dataset.patientId,
        promptQuestion: 'Can you tell me in your own words what you will take tomorrow morning and with food or without?',
        patientResponse,
        comprehensionScore: 'misunderstood',
        feedbackNarration: `⚠️ Safety Alert: You mentioned taking a medication that was STOPPED in the hospital (e.g. ${stoppedExample}). Please do NOT take your old supply. Only take medications listed on your green and blue discharge cards.`,
        verifiedAt: new Date().toISOString()
      };
    }

    const mentionsMorning = text.includes('morning') || text.includes('breakfast') || text.includes('wake up') || text.includes('am');
    const mentionsFoodOrEmpty = text.includes('food') || text.includes('empty stomach') || text.includes('meal') || text.includes('water') || text.includes('breakfast');
    
    const activeDischargeMeds = dataset.dischargeMeds.filter((d) => d.status !== 'STOPPED' && d.dose !== '0mg');
    const mentionsKeyMed = activeDischargeMeds.some((m) => {
      const norm = normalizeMedName(m.medName);
      return (norm.length > 2 && text.includes(norm)) || text.includes(m.medName.toLowerCase());
    }) ||
      text.includes('prescription') ||
      text.includes('medicine') ||
      text.includes('medication') ||
      text.includes('pill');

    if (mentionsKeyMed && mentionsFoodOrEmpty && (mentionsMorning || text.length > 30)) {
      return {
        patientId: dataset.patientId,
        promptQuestion: 'Can you tell me in your own words what you will take tomorrow morning and with food or without?',
        patientResponse,
        comprehensionScore: 'accurate',
        feedbackNarration: '✅ Excellent! You have a clear and accurate understanding of your morning schedule, food timing rules, and discontinued medications.',
        verifiedAt: new Date().toISOString()
      };
    }

    const morningActiveMeds = activeDischargeMeds.filter(
      (m) => m.dietInstructions || (m.timingSlots && m.timingSlots.includes('morning'))
    );
    const sortedReminders = [...(morningActiveMeds.length > 0 ? morningActiveMeds : activeDischargeMeds)].sort((a, b) => {
      const aDiet = a.dietInstructions ? 1 : 0;
      const bDiet = b.dietInstructions ? 1 : 0;
      return bDiet - aDiet;
    });

    const reminderItems = sortedReminders
      .map((m) => {
        if (m.dietInstructions) return `${m.medName} (${m.dietInstructions})`;
        if (m.timingSlots?.includes('morning')) return `${m.medName} in the morning`;
        return m.medName;
      })
      .slice(0, 4)
      .join(', ');

    const reminderNarration = reminderItems
      ? `ℹ️ Almost there! Remember to check timing and food instructions for your active discharge medications: ${reminderItems}.`
      : 'ℹ️ Almost there! Remember to verify food timing and morning schedules for your prescribed medications.';

    return {
      patientId: dataset.patientId,
      promptQuestion: 'Can you tell me in your own words what you will take tomorrow morning and with food or without?',
      patientResponse,
      comprehensionScore: 'minor_confusion',
      feedbackNarration: reminderNarration,
      verifiedAt: new Date().toISOString()
    };
  }

  public static compilePatientSummary(
    dataset: Patient3ListDischargeDataset,
    questions: string[] = [],
    language: 'en' | 'es' | 'hi' = 'en'
  ): PatientHomeSummaryExport {
    const reconciled = this.reconcileThreeLists(dataset);

    const whatChanged = reconciled.map((item) => {
      let changeText = 'Continued at home dose';
      if (item.statusBadge === 'NEW') changeText = 'NEW Prescription (Started in hospital)';
      else if (item.statusBadge === 'DOSE_CHANGED') changeText = `Dose Changed (${item.preHospDose} ➔ ${item.dischargeDose})`;
      else if (item.statusBadge === 'STOPPED') changeText = 'STOPPED / Discontinued (Do not take)';
      else if (item.statusBadge === 'HELD_AND_RESUMED') changeText = 'Held in hospital & Resumed';

      return {
        medName: `${item.medName} ${item.dischargeDose !== '0mg (Discontinued)' ? item.dischargeDose : ''}`.trim(),
        change: changeText,
        reason: item.documentedReason || item.plainLanguageExplanation
      };
    });

    const morningMeds: { name: string; dose: string; instructions: string }[] = [];
    const noonMeds: { name: string; dose: string; instructions: string }[] = [];
    const eveningMeds: { name: string; dose: string; instructions: string }[] = [];
    const bedtimeMeds: { name: string; dose: string; instructions: string }[] = [];

    for (const d of dataset.dischargeMeds) {
      if (d.status === 'STOPPED' || d.dose === '0mg') continue;
      const slots = d.timingSlots || ['morning'];
      const instr = d.dietInstructions || d.frequency;

      if (slots.includes('morning')) {
        morningMeds.push({ name: d.medName, dose: d.dose, instructions: instr });
      }
      if (slots.includes('noon')) {
        noonMeds.push({ name: d.medName, dose: d.dose, instructions: instr });
      }
      if (slots.includes('evening')) {
        eveningMeds.push({ name: d.medName, dose: d.dose, instructions: instr });
      }
      if (slots.includes('bedtime')) {
        bedtimeMeds.push({ name: d.medName, dose: d.dose, instructions: instr });
      }
    }

    const schedule = [
      { slot: 'morning' as const, timeString: '08:00 AM (Breakfast)', meds: morningMeds },
      { slot: 'noon' as const, timeString: '12:00 PM (Lunch)', meds: noonMeds },
      { slot: 'evening' as const, timeString: '06:00 PM (Dinner)', meds: eveningMeds },
      { slot: 'bedtime' as const, timeString: '10:00 PM (Sleep)', meds: bedtimeMeds }
    ].filter((s) => s.meds.length > 0);

    const foodRules: string[] = [];
    for (const d of dataset.dischargeMeds) {
      if (d.status === 'STOPPED' || d.dose === '0mg') continue;
      if (d.dietInstructions) {
        foodRules.push(`${d.medName}: ${d.dietInstructions}`);
      }
    }
    for (const item of reconciled) {
      if (item.dietInteractions && !foodRules.some((r) => r.startsWith(item.medName))) {
        foodRules.push(`${item.medName}: ${item.dietInteractions}`);
      }
    }
    if (foodRules.length === 0) {
      foodRules.push(
        'Take all prescribed medications with a full glass of water unless fluid-restricted.',
        'Consult your doctor or pharmacist before taking new supplements, vitamins, or making sudden dietary changes.'
      );
    } else if (foodRules.length < 2) {
      foodRules.push('Take your medications consistently at the same times each day with water unless instructed otherwise.');
    }

    const redFlags = [
      'Unusual bruising, bleeding gums, nosebleeds, or dark tarry stools (call clinic immediately)',
      'Sudden swelling in legs, feet, or ankles, or rapid weight gain (>3 lbs in 2 days)',
      'Chest pain, shortness of breath at rest, or sudden dizziness/fainting (seek emergency care / call 911)'
    ];

    const qrPayload = JSON.stringify({
      patientId: dataset.patientId,
      dischargeDate: dataset.dischargeDate,
      activeMedsCount: dataset.dischargeMeds.filter((m) => m.status !== 'STOPPED').length,
      reconciledChecksum: `rc_${Date.now()}`
    });

    return {
      patientName: dataset.patientName,
      dischargeDate: dataset.dischargeDate,
      ward: dataset.ward,
      attendingPhysician: dataset.attendingPhysician,
      whatChangedSummary: whatChanged,
      activeDailySchedule: schedule,
      foodAndDietRules: foodRules,
      redFlagWarningSymptoms: redFlags,
      doctorQuestionBankItems: questions.length > 0 ? questions : (() => {
        const fallbacks: string[] = [];
        const stopped = reconciled.filter((r) => r.statusBadge === 'STOPPED');
        const newMeds = reconciled.filter((r) => r.statusBadge === 'NEW');
        const doseChanged = reconciled.filter((r) => r.statusBadge === 'DOSE_CHANGED');

        if (stopped.length > 0) {
          fallbacks.push(`Confirm that I should permanently stop taking ${stopped.map((s) => s.medName).join(', ')} at home.`);
        }
        if (newMeds.length > 0) {
          fallbacks.push(`What are the key side effects to watch for with my new prescription for ${newMeds.map((n) => n.medName).join(', ')}?`);
        }
        if (doseChanged.length > 0) {
          fallbacks.push(`When should my follow-up labs or vitals be checked after the dosage adjustment for ${doseChanged.map((d) => d.medName).join(', ')}?`);
        }
        if (fallbacks.length === 0) {
          fallbacks.push(
            'When should my routine follow-up labs and vital signs be rechecked by my primary care provider?',
            'Are there any OTC medications or supplements I should avoid with my current prescriptions?'
          );
        }
        return fallbacks;
      })(),
      emergencyContact: {
        clinicName: 'Healthcare Facility Outpatient Clinic',
        phone: '1-800-555-CARD',
        dischargeWardPhone: '1-800-555-WARD'
      },
      qrCodeVerificationPayload: qrPayload,
      language
    };
  }
}


