/**
 * Shared deterministic mock for the AI clinical pipeline.
 * Used by test/setup.ts (vitest) and test/harness/webmcp-test-shim.ts (tsx runner).
 *
 * NOT a test and NOT app code: it simulates AI service responses so the
 * AI-native engine is testable hermetically. Bodies mirror web-verified
 * clinical content (atorvastatin/grapefruit FDA thresholds, metronidazole
 * 3-day rule, warfarin bleeding stats, levothyroxine timing).
 */

const BRAND_TO_GENERIC: Array<[RegExp, string]> = [
  [/eliq/i, 'Apixaban'],
  [/apixaban/i, 'Apixaban'],
  [/glucophage/i, 'Metformin'],
  [/metformin/i, 'Metformin'],
  [/lipitor/i, 'Atorvastatin'],
  [/atorvastatin/i, 'Atorvastatin'],
  [/zestril/i, 'Lisinopril'],
  [/lisinopril/i, 'Lisinopril'],
  [/lasix/i, 'Furosemide'],
  [/furosemide/i, 'Furosemide'],
  [/synthroid/i, 'Levothyroxine'],
  [/levothyroxine/i, 'Levothyroxine'],
  [/coumadin/i, 'Warfarin'],
  [/warfarin/i, 'Warfarin'],
  [/aldactone/i, 'Spironolactone'],
  [/spironolactone/i, 'Spironolactone'],
  [/prilosec/i, 'Omeprazole'],
  [/omeprazole/i, 'Omeprazole'],
  [/plavix/i, 'Clopidogrel'],
  [/clopidogrel/i, 'Clopidogrel'],
  [/norvasc/i, 'Amlodipine'],
  [/amlodipine/i, 'Amlodipine'],
  [/coreg/i, 'Carvedilol'],
  [/carvedilol/i, 'Carvedilol'],
  [/tylenol/i, 'Acetaminophen'],
  [/acetaminophen/i, 'Acetaminophen'],
  [/advil|motrin/i, 'Ibuprofen'],
  [/ibuprofen/i, 'Ibuprofen'],
  [/aleve/i, 'Naproxen'],
  [/naproxen/i, 'Naproxen'],
  [/percocet/i, 'Oxycodone/Acetaminophen'],
  [/zetia/i, 'Ezetimibe'],
  [/ezetimibe/i, 'Ezetimibe'],
  [/lovaza/i, 'Omega-3'],
  [/omega-?3/i, 'Omega-3'],
  [/fish oil/i, 'Fish Oil'],
  [/ventolin/i, 'Albuterol HFA'],
  [/albuterol/i, 'Albuterol HFA'],
  [/singulair/i, 'Montelukast'],
  [/montelukast/i, 'Montelukast'],
  [/zyrtec/i, 'Cetirizine'],
  [/cetirizine/i, 'Cetirizine'],
  [/flonase/i, 'Fluticasone nasal spray'],
  [/entresto/i, 'Sacubitril/Valsartan'],
  [/calcium/i, 'Calcium Carbonate'],
  [/cipro/i, 'Ciprofloxacin'],
  [/sertraline|zoloft/i, 'Sertraline'],
  [/st\.?\s*john/i, "St. John's Wort"],
  [/aspirin/i, 'Aspirin'],
  [/metronidazole|flagyl/i, 'Metronidazole'],
  [/enoxaparin|lovenox/i, 'Enoxaparin'],
  [/rivaroxaban|xarelto/i, 'Rivaroxaban'],
  [/simvastatin|zocor/i, 'Simvastatin'],
  [/ginkgo/i, 'Ginkgo Biloba'],
  [/allopurinol|zyloprim/i, 'Allopurinol'],
  [/spiriva|tiotropium/i, 'Tiotropium'],
  [/jardiance|empagliflozin/i, 'Empagliflozin'],
  [/doxycycline|vibramycin/i, 'Doxycycline'],
];

export function mockResolveGeneric(name: string): string {
  const trimmed = (name || '').trim();
  if (!trimmed) return trimmed;
  for (const [re, generic] of BRAND_TO_GENERIC) {
    if (re.test(trimmed)) return generic;
  }
  return trimmed;
}

interface MockArc {
  drugA: string;
  drugB: string;
  severity: string;
  mechanism: string;
  clinicalGuidance: string;
}

const DDI_PAIRS: Array<{ match: string[]; arc: MockArc }> = [
  { match: ['sertraline', 'st. john'], arc: { drugA: 'Sertraline', drugB: "St. John's Wort", severity: 'MAJOR', mechanism: 'Concurrent serotonergic enhancement can precipitate potentially fatal Serotonin Syndrome.', clinicalGuidance: "Avoid combination — discontinue St. John's Wort if combined and seek urgent care at first signs." } },
  { match: ['apixaban', 'st. john'], arc: { drugA: 'Apixaban', drugB: "St. John's Wort", severity: 'MAJOR', mechanism: 'CYP3A4/P-gp induction lowers apixaban exposure, raising stroke risk.', clinicalGuidance: 'Avoid combination.' } },
  { match: ['apixaban', 'fish oil'], arc: { drugA: 'Apixaban', drugB: 'Fish Oil', severity: 'MODERATE', mechanism: 'Mild antiplatelet activity may add to bleeding risk, mainly above ~2000mg/day.', clinicalGuidance: 'Tell your doctor your dose; watch for bruising or bleeds.' } },
  { match: ['apixaban', 'omega'], arc: { drugA: 'Apixaban', drugB: 'Omega-3', severity: 'MODERATE', mechanism: 'Mild antiplatelet activity may add to bleeding risk, mainly above ~2000mg/day.', clinicalGuidance: 'Tell your doctor your dose; watch for bruising or bleeds.' } },
  { match: ['apixaban', 'aspirin'], arc: { drugA: 'Apixaban', drugB: 'Aspirin', severity: 'MAJOR', mechanism: 'Additive anticoagulant and antiplatelet inhibition raises bleeding risk.', clinicalGuidance: 'Avoid unless indicated for acute coronary syndromes.' } },
  { match: ['aspirin', 'ibuprofen'], arc: { drugA: 'Aspirin', drugB: 'Ibuprofen', severity: 'MAJOR', mechanism: 'Ibuprofen blocks platelet COX-1 binding and raises GI ulcer risk.', clinicalGuidance: 'Separate dosing; take aspirin 30 minutes before or 8 hours after ibuprofen.' } },
  { match: ['clopidogrel', 'omeprazole'], arc: { drugA: 'Clopidogrel', drugB: 'Omeprazole', severity: 'MAJOR', mechanism: 'CYP2C19 inhibition reduces active clopidogrel metabolite formation.', clinicalGuidance: 'Use pantoprazole or famotidine instead.' } },
  { match: ['carvedilol', 'furosemide'], arc: { drugA: 'Carvedilol', drugB: 'Furosemide', severity: 'MODERATE', mechanism: 'Additive hypotensive effect risks postural hypotension.', clinicalGuidance: 'Monitor standing blood pressure.' } },
  { match: ['lisinopril', 'spironolactone'], arc: { drugA: 'Lisinopril', drugB: 'Spironolactone', severity: 'MAJOR', mechanism: 'Dual aldosterone/angiotensin blockade limits potassium excretion — hyperkalemia risk.', clinicalGuidance: 'Monitor serum potassium frequently.' } },
  { match: ['ciprofloxacin', 'calcium'], arc: { drugA: 'Ciprofloxacin', drugB: 'Calcium Carbonate', severity: 'MAJOR', mechanism: 'Polyvalent cations form insoluble chelates with ciprofloxacin, cutting absorption ~40%.', clinicalGuidance: 'Separate by at least 2 hours before or 6 hours after calcium.' } },
  { match: ['ibuprofen', 'lisinopril'], arc: { drugA: 'Ibuprofen', drugB: 'Lisinopril', severity: 'MODERATE', mechanism: 'NSAID prostaglandin inhibition blunts ACE-inhibitor effect and stresses kidneys.', clinicalGuidance: 'Prefer acetaminophen; recheck BP, creatinine and potassium in 1-2 weeks.' } },
  { match: ['naproxen', 'lisinopril'], arc: { drugA: 'Naproxen', drugB: 'Lisinopril', severity: 'MODERATE', mechanism: 'NSAID prostaglandin inhibition blunts ACE-inhibitor effect and stresses kidneys.', clinicalGuidance: 'Prefer acetaminophen; recheck BP, creatinine and potassium in 1-2 weeks.' } },
  { match: ['ibuprofen', 'furosemide'], arc: { drugA: 'Ibuprofen', drugB: 'Furosemide', severity: 'MAJOR', mechanism: 'NSAIDs counteract diuretic efficacy and promote sodium and water retention.', clinicalGuidance: 'Avoid NSAIDs in heart failure and CKD patients on loop diuretics.' } },
  { match: ['warfarin', 'aspirin'], arc: { drugA: 'Warfarin', drugB: 'Aspirin', severity: 'MAJOR', mechanism: 'Dual inhibition raises major bleeding ~2x even at therapeutic INR.', clinicalGuidance: 'Reserve for strong indication with cardiology direction; check INR every 1-2 weeks.' } },
  { match: ['warfarin', 'ibuprofen'], arc: { drugA: 'Warfarin', drugB: 'Ibuprofen', severity: 'MAJOR', mechanism: 'NSAIDs double GI-bleed risk on warfarin; elderly ulcer risk markedly higher.', clinicalGuidance: 'Avoid NSAIDs; use acetaminophen if approved.' } },
  { match: ['warfarin', 'naproxen'], arc: { drugA: 'Warfarin', drugB: 'Naproxen', severity: 'MAJOR', mechanism: 'NSAIDs double GI-bleed risk on warfarin; elderly ulcer risk markedly higher.', clinicalGuidance: 'Avoid NSAIDs; use acetaminophen if approved.' } },
  { match: ['warfarin', 'ginkgo'], arc: { drugA: 'Warfarin', drugB: 'Ginkgo Biloba', severity: 'MODERATE', mechanism: 'Ginkgolides inhibit platelet-activating factor; evidence mixed and INR may look normal.', clinicalGuidance: 'Avoid starting or stopping ginkgo without clinician review; monitor INR.' } },
  { match: ['enoxaparin', 'rivaroxaban'], arc: { drugA: 'Enoxaparin', drugB: 'Rivaroxaban', severity: 'MAJOR', mechanism: 'Overlapping anticoagulation adds anti-Xa activity with hemorrhage risk.', clinicalGuidance: 'Avoid overlap except when switching; stop one before starting the other.' } },
  { match: ['levothyroxine', 'calcium'], arc: { drugA: 'Levothyroxine', drugB: 'Calcium Carbonate', severity: 'MODERATE', mechanism: 'Calcium binds levothyroxine, cutting absorption ~20-25%.', clinicalGuidance: 'Separate dosing by at least 4 hours.' } },
  { match: ['levothyroxine', 'iron'], arc: { drugA: 'Levothyroxine', drugB: 'Iron', severity: 'MODERATE', mechanism: 'Iron chelates levothyroxine, reducing absorption.', clinicalGuidance: 'Separate dosing by at least 4 hours.' } },
  { match: ['amlodipine', 'simvastatin'], arc: { drugA: 'Amlodipine', drugB: 'Simvastatin', severity: 'MODERATE', mechanism: 'CYP3A4 inhibition raises simvastatin exposure and myopathy risk.', clinicalGuidance: 'Limit simvastatin to 20mg daily with amlodipine.' } },
  { match: ['atorvastatin', 'apixaban'], arc: { drugA: 'Atorvastatin', drugB: 'Apixaban', severity: 'MODERATE', mechanism: 'CYP3A4 substrate overlap.', clinicalGuidance: 'Monitor.' } },
  { match: ['apixaban', 'carbamazepine'], arc: { drugA: 'Apixaban', drugB: 'Carbamazepine', severity: 'MAJOR', mechanism: 'CYP3A4 and P-gp induction reduces apixaban exposure.', clinicalGuidance: 'Avoid or monitor.' } },
];

const SEVERITY_COLORS: Record<string, string> = {
  CONTRAINDICATED: '#EF4444',
  MAJOR: '#F97316',
  MODERATE: '#EAB308',
  MINOR: '#22C55E',
};

function parseMedList(userText: string): string[] {
  try {
    const m = userText.match(/Medications:\s*(\[.*?\])/s) || userText.match(/Meds:\s*(\[.*?\])/s);
    if (m) {
      const arr = JSON.parse(m[1].replace(/\\"/g, '"'));
      if (Array.isArray(arr)) return arr.map(String);
    }
  } catch {}
  return [];
}

/** Matching text with brand names resolved to generics (mirrors the AI alias handling). */
function aliasAwareText(userText: string): string {
  const lower = userText.toLowerCase();
  try {
    const meds = parseMedList(userText);
    if (meds.length > 0) {
      return `${lower} ${meds.map((m) => mockResolveGeneric(m)).join(' ').toLowerCase()}`;
    }
  } catch {}
  return lower;
}

function parseJsonArray(userText: string, label: string): any[] {
  try {
    const m = userText.match(new RegExp(label + ':\\s*(\\[.*?\\])', 's'));
    if (m) {
      const arr = JSON.parse(m[1].replace(/\\"/g, '"'));
      if (Array.isArray(arr)) return arr;
    }
  } catch {}
  return [];
}

function mockDDI(userText: string): unknown {
  const lower = aliasAwareText(userText);
  const meds = parseMedList(userText);
  const knownMentioned = /sertraline|apixaban|warfarin|lisinopril|ciprofloxacin|atorvastatin|carbamazepine|clopidogrel|carvedilol|furosemide|amlodipine|simvastatin|enoxaparin|rivaroxaban|levothyroxine|aspirin|ibuprofen|naproxen|metronidazole/.test(lower);
  if (meds.length === 0 && !knownMentioned) return { interactions: [] };
  if (meds.length >= 10) {
    const many = Array.from({ length: 5 }, (_, i) => ({
      drugA: `Drug${i}`, drugB: `Drug${i + 1}`, severity: i % 2 === 0 ? 'MAJOR' : 'MODERATE',
      mechanism: 'Polypharmacy interaction (mock)', clinicalGuidance: 'Monitor', confidence: 0.9,
      arcColor: i % 2 === 0 ? '#F97316' : '#EAB308', reasoning: 'MockAI',
    }));
    return { interactions: many };
  }
  const found = DDI_PAIRS.filter((rule) => rule.match.every((k) => lower.includes(k))).map((rule) => ({
    ...rule.arc,
    confidence: 0.9,
    arcColor: SEVERITY_COLORS[rule.arc.severity] || '#EAB308',
    reasoning: 'MockAI',
  }));
  return { interactions: found };
}

function mockDiet(userText: string): unknown {
  const lower = aliasAwareText(userText);
  const out: unknown[] = [];
  const flagsGrapefruit = lower.includes('drinksgrapefruitdaily') && lower.includes('true');
  const flagsVitK = lower.includes('frequenthighvitkgreens') && lower.includes('true');
  if (lower.includes('atorvastatin') && (flagsGrapefruit || lower.includes('grapefruit'))) {
    out.push({ drugName: 'Atorvastatin', dietItem: 'Grapefruit', severity: 'MODERATE', badgeText: 'Grapefruit — limit juice', plateArcColor: '#EAB308', mechanism: 'Furanocoumarins inhibit intestinal CYP3A4; only excessive intake matters.', clinicalGuidance: 'Avoid large quantities (>1.2L/day).', confidence: 0.9, reasoning: 'MockAI' });
  }
  if (lower.includes('simvastatin') && (flagsGrapefruit || lower.includes('grapefruit'))) {
    out.push({ drugName: 'Simvastatin', dietItem: 'Grapefruit', severity: 'MAJOR', badgeText: 'Avoid Grapefruit', plateArcColor: '#EF4444', mechanism: 'Severe CYP3A4 inhibition raises simvastatin levels.', clinicalGuidance: 'Strictly avoid grapefruit.', confidence: 0.9, reasoning: 'MockAI' });
  }
  if (lower.includes('warfarin') && (flagsVitK || lower.includes('vitamin k') || lower.includes('vit k'))) {
    out.push({ drugName: 'Warfarin', dietItem: 'Vitamin K greens', severity: 'MODERATE', badgeText: 'Consistent Vit K', plateArcColor: '#EAB308', mechanism: 'Vitamin K antagonizes warfarin action.', clinicalGuidance: 'Keep leafy-green intake consistent.', confidence: 0.9, reasoning: 'MockAI' });
  }
  if (lower.includes('levothyroxine') || lower.includes('synthroid')) {
    out.push({ drugName: 'Levothyroxine', dietItem: 'Breakfast / Dairy / Coffee', severity: 'MAJOR', badgeText: 'Empty Stomach', plateArcColor: '#F97316', mechanism: 'Food and calcium cut absorption.', clinicalGuidance: 'Take 30 to 60 minutes before breakfast on an empty stomach.', confidence: 0.9, reasoning: 'MockAI' });
  }
  if (lower.includes('metronidazole') || lower.includes('flagyl')) {
    out.push({ drugName: 'Metronidazole', dietItem: 'Alcohol', severity: 'CONTRAINDICATED', badgeText: 'Zero Alcohol', plateArcColor: '#EF4444', mechanism: 'Disulfiram-like reaction to alcohol.', clinicalGuidance: 'Avoid alcohol during and for 3 days after therapy.', confidence: 0.95, reasoning: 'MockAI' });
  }
  if (lower.includes('lisinopril') && (lower.includes('potassium') || lower.includes('salt'))) {
    out.push({ drugName: 'Lisinopril', dietItem: 'High-Potassium Salt Substitutes', severity: 'MAJOR', badgeText: 'Avoid K+ Salt Substitutes', plateArcColor: '#F97316', mechanism: 'ACE inhibitors reduce potassium excretion.', clinicalGuidance: 'Do not use potassium salt substitutes.', confidence: 0.9, reasoning: 'MockAI' });
  }
  if (lower.includes('spironolactone') && (lower.includes('potassium') || lower.includes('salt'))) {
    out.push({ drugName: 'Spironolactone', dietItem: 'High-Potassium Salt Substitutes', severity: 'MAJOR', badgeText: 'Avoid K+ Salt Substitutes', plateArcColor: '#F97316', mechanism: 'Potassium retention risk.', clinicalGuidance: 'Do not use potassium salt substitutes.', confidence: 0.9, reasoning: 'MockAI' });
  }
  if (lower.includes('doxycycline') && lower.includes('dairy')) {
    out.push({ drugName: 'Doxycycline', dietItem: 'Dairy', severity: 'MODERATE', badgeText: 'Separate from Dairy (2h)', plateArcColor: '#EAB308', mechanism: 'Calcium binds doxycycline.', clinicalGuidance: 'Separate by 1 to 2 hours.', confidence: 0.9, reasoning: 'MockAI' });
  }
  return { dietInteractions: out };
}

function parseDoseMg(dose: string): number {
  const m = String(dose || '').match(/([\d.]+)\s*mg/i);
  return m ? parseFloat(m[1]) : 0;
}

function mockDuplicates(userText: string): unknown {
  const meds = parseJsonArray(userText, 'Meds') as Array<{ name?: string; dose?: string }>;
  const alerts: unknown[] = [];
  const apapMeds = meds.filter((x) => {
    const n = String(x?.name || '').toLowerCase();
    return n.includes('tylenol') || n.includes('acetaminophen') || n.includes('percocet') || n.includes('vicodin');
  });
  if (apapMeds.length >= 2) {
    let total = 0;
    const involved = apapMeds.map((x) => {
      const n = String(x?.name || '');
      const mg = n.toLowerCase().includes('percocet') ? 325 : parseDoseMg(String(x?.dose || '')) || 500;
      total += mg;
      return { name: n, dose: String(x?.dose || ''), ingredientAmountMg: mg };
    });
    alerts.push({ ingredient: 'Acetaminophen', drugsInvolved: involved, totalCumulativeDoseMg: total, maxSafeDailyDoseMg: 4000, isOverLimit: total > 4000, plainNarration: `Acetaminophen in ${involved.map((d) => d.name).join(' and ')} totals ${total}mg.`, confidence: 0.9, reasoning: 'MockAI' });
  }
  const nsaidNames = ['advil', 'motrin', 'aleve', 'naproxen', 'ibuprofen', 'celebrex', 'meloxicam', 'diclofenac'];
  const nsaidMeds = meds.filter((x) => nsaidNames.some((n) => String(x?.name || '').toLowerCase().includes(n)));
  if (nsaidMeds.length >= 2) {
    alerts.push({ ingredient: 'NSAID Class', drugsInvolved: nsaidMeds.map((x) => ({ name: String(x?.name || ''), dose: String(x?.dose || ''), ingredientAmountMg: 1 })), totalCumulativeDoseMg: nsaidMeds.length, maxSafeDailyDoseMg: 1, isOverLimit: true, plainNarration: 'Duplicate NSAID class detected.', confidence: 0.9, reasoning: 'MockAI' });
  }
  const names = meds.map((x) => String(x?.name || '').toLowerCase());
  if (names.some((n) => n.includes('lipitor')) && names.some((n) => n.includes('atorvastatin') && !n.includes('lipitor'))) {
    alerts.push({ ingredient: 'Atorvastatin', drugsInvolved: [{ name: 'Lipitor', dose: '40mg', ingredientAmountMg: 40 }, { name: 'Atorvastatin', dose: '40mg', ingredientAmountMg: 40 }], totalCumulativeDoseMg: 80, maxSafeDailyDoseMg: 80, isOverLimit: false, plainNarration: 'Brand/generic overlap: Lipitor and Atorvastatin total 80mg.', confidence: 0.9, reasoning: 'MockAI' });
  }
  return { duplicateAlerts: alerts };
}

function mockSchedule(userText: string): unknown {
  const meds = parseJsonArray(userText, 'Meds') as Array<{ id?: string; name?: string; currentSlot?: string }>;
  const shifts: unknown[] = [];
  for (const med of meds) {
    const name = String(med?.name || '');
    const lower = name.toLowerCase();
    const slot = String(med?.currentSlot || 'morning');
    if ((lower.includes('atorvastatin') || lower.includes('simvastatin') || lower.includes('lipitor')) && slot !== 'bedtime') {
      shifts.push({ medId: med?.id || 'm1', medName: name, fromSlot: slot, toSlot: 'bedtime', reason: 'Statins inhibit overnight hepatic cholesterol synthesis best at bedtime.', confidence: 0.9 });
    } else if (lower.includes('furosemide') && (slot === 'bedtime' || slot === 'evening')) {
      shifts.push({ medId: med?.id || 'm2', medName: name, fromSlot: slot, toSlot: 'morning', reason: 'Morning diuretics prevent nighttime urination and broken sleep.', confidence: 0.9 });
    } else if (lower.includes('calcium') && slot === 'morning') {
      shifts.push({ medId: med?.id || 'm4', medName: name, fromSlot: slot, toSlot: 'noon', reason: 'Separate calcium from morning Levothyroxine by 4 hours.', confidence: 0.9 });
    }
  }
  return {
    proposedShifts: shifts,
    resolvedConflictsCount: shifts.length,
    plainExplanation: shifts.length ? `Proposed ${shifts.length} timing adjustments.` : 'Current schedule looks good.',
    confidence: 0.9,
    reasoning: 'MockAI',
  };
}

function mockSimulate(userText: string): unknown {
  const medMatch = userText.match(/Medication:\s*"?([^"\n,]+)/i);
  const med = (medMatch ? medMatch[1] : 'Medication').trim();
  const ml = med.toLowerCase();
  if (ml.includes('metformin') || ml.includes('glucophage')) {
    return { medName: med, clinicalImpactSummary: 'Missing Metformin raises post-meal glucose (mock estimate).', projectedBiomarkerDelta: { biomarker: 'Fasting Glucose', estimatedChange: '+25 to +40 mg/dL' }, recoveryProtocol: 'Take as soon as remembered with food; do not double dose.', doNotDoubleDoseWarning: true, confidence: 0.8, reasoning: 'MockAI' };
  }
  if (ml.includes('apixaban') || ml.includes('warfarin') || ml.includes('eliquis') || ml.includes('coumadin')) {
    return { medName: med, clinicalImpactSummary: 'Missing an anticoagulant temporarily lowers stroke protection (mock estimate).', projectedBiomarkerDelta: { biomarker: 'Anticoagulation Blood Level', estimatedChange: '-50% within 12 hours' }, recoveryProtocol: 'Take as soon as remembered same day; do not double dose.', doNotDoubleDoseWarning: true, confidence: 0.8, reasoning: 'MockAI' };
  }
  if (ml.includes('amlodipine') || ml.includes('lisinopril') || ml.includes('carvedilol') || ml.includes('norvasc') || ml.includes('zestril')) {
    return { medName: med, clinicalImpactSummary: 'Missing blood pressure medicine can raise pressure (mock estimate).', projectedBiomarkerDelta: { biomarker: 'Systolic Blood Pressure', estimatedChange: '+12 to +18 mmHg' }, recoveryProtocol: 'Take as soon as remembered; do not double dose.', doNotDoubleDoseWarning: true, confidence: 0.8, reasoning: 'MockAI' };
  }
  return { medName: med, clinicalImpactSummary: `Missing ${med} reduces coverage for the day (mock estimate).`, recoveryProtocol: 'Take as soon as remembered unless close to the next dose; do not double dose.', doNotDoubleDoseWarning: true, confidence: 0.7, reasoning: 'MockAI' };
}

function mockDischargeEducator(userText: string): unknown {
  const medMatch = userText.match(/Med:\s*([^\n(]+)/i);
  const med = (medMatch ? medMatch[1] : 'Medication').trim();
  const statusMatch = userText.match(/Status:\s*([A-Z_]+)/);
  const status = statusMatch ? statusMatch[1] : 'CONTINUED';
  const ml = med.toLowerCase();
  let sentence: string;
  if (status === 'STOPPED' && ml.includes('lisinopril')) {
    sentence = `Lisinopril was STOPPED to protect kidney function. Do not take your old supply; your doctor will recheck kidney labs.`;
  } else if (status === 'NEW' && ml.includes('apixaban')) {
    sentence = `Apixaban is a NEW blood thinner to prevent stroke in atrial fibrillation. Take as directed and watch for bleeding.`;
  } else if (status === 'DOSE_CHANGED' && ml.includes('metformin')) {
    sentence = `Metformin was INCREASED. Take with food and watch blood sugar as directed.`;
  } else {
    sentence = `${med} — ${status}. Follow your discharge dosing schedule and ask your care team about anything unclear.`;
  }
  return { plainExplanation: sentence, confidence: 0.9, reasoning: 'MockAI' };
}

function mockCareCoordinator(userText: string): unknown {
  const lower = userText.toLowerCase();
  const medMatch = userText.match(/Med:\s*([^\n]+)/i);
  const med = (medMatch ? medMatch[1].trim().split('\n')[0] : '').trim();
  let question: string;
  if (lower.includes('lisinopril') || (lower.includes('kidney') && lower.includes('stop'))) {
    question = 'Why was my Lisinopril stopped, and when should my doctor recheck my kidney labs?';
  } else if (lower.includes('fish oil') || (lower.includes('apixaban') && lower.includes('bleed'))) {
    question = 'Can I keep taking Fish Oil with Apixaban, and what bleeding signs should I watch for?';
  } else if (med && !/unknown|general/i.test(med)) {
    question = `Could you clarify the plan for ${med} and what follow-up tests are needed?`;
  } else {
    question = 'Could you clarify my medication plan and what follow-up tests are needed?';
  }
  return { questionText: question, questions: [question], confidence: 0.9, reasoning: 'MockAI' };
}

function mockReconBatch(userText: string): unknown {
  const explanations: unknown[] = [];
  try {
    const m = userText.match(/Items:\s*(\[.*?\])\s*(?:\n|$)/s);
    if (m) {
      const items = JSON.parse(m[1].replace(/\\"/g, '"'));
      for (const it of items) {
        const medName = String(it?.medName || 'Medication');
        const status = String(it?.statusBadge || 'CONTINUED');
        explanations.push({
          medId: String(it?.medId || medName),
          plainExplanation: `${medName} — ${status}. Follow your discharge schedule (mock).`,
          questions: [`What should I watch for with ${medName} after discharge?`],
          confidence: 0.85,
          reasoning: 'MockAI',
        });
      }
    }
  } catch {}
  return { explanations };
}

/**
 * Route a mocked AI call by system-prompt markers. Returns the decoded JSON
 * body the engine expects, or null when this router has no opinion (caller
 * keeps its existing fallback behavior, e.g. extraction facts).
 *
 * NOTE: batch generic resolution ("generic names for each") must be checked
 * before the single-name marker ("generic name for" is a prefix of it).
 */
export function routeAiMock(systemPrompt: string, userText: string): unknown | null {
  const sys = (systemPrompt || '').toLowerCase();
  if (sys.includes('clinical pharmacology specialist') && sys.includes('drug-drug interactions')) {
    return mockDDI(userText);
  }
  if (sys.includes('clinical nutrition-pharmacology specialist') && sys.includes('drug-diet')) {
    return mockDiet(userText);
  }
  if (sys.includes('clinical pharmacy specialist') && sys.includes('duplicate')) {
    return mockDuplicates(userText);
  }
  if (sys.includes('clinical chronotherapy specialist')) {
    return mockSchedule(userText);
  }
  if (sys.includes('missed a dose')) {
    return mockSimulate(userText);
  }
  if (sys.includes('resolve the generic names for each')) {
    const list = parseMedListGeneric(userText);
    return { mappings: list.map((n) => ({ input: n, generic: mockResolveGeneric(n) })), confidence: 0.95, reasoning: 'MockAI' };
  }
  if (sys.includes('resolve the generic name for')) {
    const m = userText.match(/Drug name:\s*"([^"]+)"/) || userText.match(/Drug name:\s*([^\n]+)/);
    const name = (m ? m[1] : userText).trim().slice(0, 80);
    return { generic: mockResolveGeneric(name), confidence: 0.95, reasoning: 'MockAI' };
  }
  if (sys.includes('clinical discharge reconciliation specialist')) {
    return mockReconBatch(userText);
  }
  if (sys.includes('clinical discharge educator')) {
    return mockDischargeEducator(userText);
  }
  if (sys.includes('clinical care coordinator')) {
    return mockCareCoordinator(userText);
  }
  return null;
}

function parseMedListGeneric(userText: string): string[] {
  try {
    const m = userText.match(/\[.*?\]/s);
    if (m) {
      const arr = JSON.parse(m[0].replace(/\\"/g, '"'));
      if (Array.isArray(arr)) return arr.map(String);
    }
  } catch {}
  return [];
}
