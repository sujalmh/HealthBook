/**
 * CareCanvas Fixtures: Drug Knowledge Databases
 * Brand/Generic Mapping, Drug-Drug Interactions, Drug-Diet Interactions, Duplicate Active Ingredients
 */

export interface BrandGenericMapping {
  generic: string;
  class: string;
  standardDoses: string[];
  activeIngredients: { ingredient: string; amountMg: number }[];
}

export const mockBrandGenericCatalog: Record<string, BrandGenericMapping> = {
  Eliquis: {
    generic: 'Apixaban',
    class: 'Direct Oral Anticoagulant (DOAC)',
    standardDoses: ['2.5mg', '5mg'],
    activeIngredients: [{ ingredient: 'Apixaban', amountMg: 5 }]
  },
  Glucophage: {
    generic: 'Metformin',
    class: 'Biguanide',
    standardDoses: ['500mg', '850mg', '1000mg'],
    activeIngredients: [{ ingredient: 'Metformin', amountMg: 500 }]
  },
  Lipitor: {
    generic: 'Atorvastatin',
    class: 'HMG-CoA Reductase Inhibitor',
    standardDoses: ['10mg', '20mg', '40mg', '80mg'],
    activeIngredients: [{ ingredient: 'Atorvastatin', amountMg: 40 }]
  },
  Zestril: {
    generic: 'Lisinopril',
    class: 'ACE Inhibitor',
    standardDoses: ['5mg', '10mg', '20mg', '40mg'],
    activeIngredients: [{ ingredient: 'Lisinopril', amountMg: 20 }]
  },
  Lasix: {
    generic: 'Furosemide',
    class: 'Loop Diuretic',
    standardDoses: ['20mg', '40mg', '80mg'],
    activeIngredients: [{ ingredient: 'Furosemide', amountMg: 40 }]
  },
  Synthroid: {
    generic: 'Levothyroxine',
    class: 'Thyroid Hormone',
    standardDoses: ['25mcg', '50mcg', '75mcg', '88mcg', '100mcg', '125mcg'],
    activeIngredients: [{ ingredient: 'Levothyroxine', amountMg: 0.075 }]
  },
  Plavix: {
    generic: 'Clopidogrel',
    class: 'P2Y12 Antiplatelet',
    standardDoses: ['75mg'],
    activeIngredients: [{ ingredient: 'Clopidogrel', amountMg: 75 }]
  },
  Advil: {
    generic: 'Ibuprofen',
    class: 'NSAID',
    standardDoses: ['200mg', '400mg', '600mg', '800mg'],
    activeIngredients: [{ ingredient: 'Ibuprofen', amountMg: 200 }]
  },
  Aleve: {
    generic: 'Naproxen',
    class: 'NSAID',
    standardDoses: ['220mg', '500mg'],
    activeIngredients: [{ ingredient: 'Naproxen', amountMg: 220 }]
  },
  Tylenol: {
    generic: 'Acetaminophen',
    class: 'Analgesic/Antipyretic',
    standardDoses: ['325mg', '500mg', '650mg'],
    activeIngredients: [{ ingredient: 'Acetaminophen', amountMg: 500 }]
  },
  Percocet: {
    generic: 'Oxycodone/Acetaminophen',
    class: 'Opioid / Analgesic Combo',
    standardDoses: ['5/325mg', '10/325mg'],
    activeIngredients: [
      { ingredient: 'Oxycodone', amountMg: 5 },
      { ingredient: 'Acetaminophen', amountMg: 325 }
    ]
  },
  Janumet: {
    generic: 'Sitagliptin/Metformin',
    class: 'DPP-4 Inhibitor / Biguanide Combo',
    standardDoses: ['50/500mg', '50/1000mg'],
    activeIngredients: [
      { ingredient: 'Sitagliptin', amountMg: 50 },
      { ingredient: 'Metformin', amountMg: 500 }
    ]
  },
  Entresto: {
    generic: 'Sacubitril/Valsartan',
    class: 'ARNI (Angiotensin Receptor-Neprilysin Inhibitor)',
    standardDoses: ['24/26mg', '49/51mg', '97/103mg'],
    activeIngredients: [
      { ingredient: 'Sacubitril', amountMg: 49 },
      { ingredient: 'Valsartan', amountMg: 51 }
    ]
  },
  Aldactone: {
    generic: 'Spironolactone',
    class: 'Potassium-Sparing Diuretic',
    standardDoses: ['25mg', '50mg', '100mg'],
    activeIngredients: [{ ingredient: 'Spironolactone', amountMg: 25 }]
  },
  Cipro: {
    generic: 'Ciprofloxacin',
    class: 'Fluoroquinolone Antibiotic',
    standardDoses: ['250mg', '500mg', '750mg'],
    activeIngredients: [{ ingredient: 'Ciprofloxacin', amountMg: 500 }]
  },
  Jardiance: {
    generic: 'Empagliflozin',
    class: 'SGLT2 Inhibitor',
    standardDoses: ['10mg', '25mg'],
    activeIngredients: [{ ingredient: 'Empagliflozin', amountMg: 10 }]
  },
  Coreg: {
    generic: 'Carvedilol',
    class: 'Beta Blocker',
    standardDoses: ['3.125mg', '6.25mg', '12.5mg', '25mg'],
    activeIngredients: [{ ingredient: 'Carvedilol', amountMg: 12.5 }]
  },
  Zoloft: {
    generic: 'Sertraline',
    class: 'SSRI Antidepressant',
    standardDoses: ['25mg', '50mg', '100mg'],
    activeIngredients: [{ ingredient: 'Sertraline', amountMg: 50 }]
  },
  Coumadin: {
    generic: 'Warfarin',
    class: 'Vitamin K Antagonist',
    standardDoses: ['1mg', '2mg', '2.5mg', '5mg'],
    activeIngredients: [{ ingredient: 'Warfarin', amountMg: 5 }]
  },
  Flagyl: {
    generic: 'Metronidazole',
    class: 'Nitroimidazole Antibiotic',
    standardDoses: ['250mg', '500mg'],
    activeIngredients: [{ ingredient: 'Metronidazole', amountMg: 500 }]
  },
  Vibramycin: {
    generic: 'Doxycycline',
    class: 'Tetracycline Antibiotic',
    standardDoses: ['50mg', '100mg'],
    activeIngredients: [{ ingredient: 'Doxycycline', amountMg: 100 }]
  },
  Microzide: {
    generic: 'Hydrochlorothiazide',
    class: 'Thiazide Diuretic',
    standardDoses: ['12.5mg', '25mg', '50mg'],
    activeIngredients: [{ ingredient: 'Hydrochlorothiazide', amountMg: 25 }]
  },
  Ambien: {
    generic: 'Zolpidem',
    class: 'Sedative/Hypnotic',
    standardDoses: ['5mg', '10mg'],
    activeIngredients: [{ ingredient: 'Zolpidem', amountMg: 5 }]
  },
  Norvasc: {
    generic: 'Amlodipine',
    class: 'Calcium Channel Blocker',
    standardDoses: ['2.5mg', '5mg', '10mg'],
    activeIngredients: [{ ingredient: 'Amlodipine', amountMg: 5 }]
  },
  Zocor: {
    generic: 'Simvastatin',
    class: 'HMG-CoA Reductase Inhibitor',
    standardDoses: ['10mg', '20mg', '40mg'],
    activeIngredients: [{ ingredient: 'Simvastatin', amountMg: 20 }]
  },
  Prilosec: {
    generic: 'Omeprazole',
    class: 'Proton Pump Inhibitor',
    standardDoses: ['20mg', '40mg'],
    activeIngredients: [{ ingredient: 'Omeprazole', amountMg: 20 }]
  },
  Tenormin: {
    generic: 'Atenolol',
    class: 'Beta Blocker',
    standardDoses: ['25mg', '50mg', '100mg'],
    activeIngredients: [{ ingredient: 'Atenolol', amountMg: 50 }]
  },
  Amoxil: {
    generic: 'Amoxicillin',
    class: 'Penicillin Antibiotic',
    standardDoses: ['250mg', '500mg', '875mg'],
    activeIngredients: [{ ingredient: 'Amoxicillin', amountMg: 500 }]
  },
  Glucotrol: {
    generic: 'Glipizide',
    class: 'Sulfonylurea',
    standardDoses: ['5mg', '10mg'],
    activeIngredients: [{ ingredient: 'Glipizide', amountMg: 5 }]
  },
  Zyloprim: {
    generic: 'Allopurinol',
    class: 'Xanthine Oxidase Inhibitor',
    standardDoses: ['100mg', '300mg'],
    activeIngredients: [{ ingredient: 'Allopurinol', amountMg: 100 }]
  }
};

export interface DrugDrugInteractionRule {
  drugA: string;
  drugB: string;
  severity: 'CONTRAINDICATED' | 'MAJOR' | 'MODERATE' | 'MINOR';
  arcColor: string;
  mechanism: string;
  clinicalGuidance: string;
}

export const mockDrugDrugInteractions: DrugDrugInteractionRule[] = [
  {
    drugA: 'Apixaban',
    drugB: 'Fish Oil',
    severity: 'MAJOR',
    arcColor: '#F97316',
    mechanism: 'Additive antiplatelet and anticoagulant effects increase bleeding time.',
    clinicalGuidance: 'Monitor for unusual bruising, gum bleeding, or dark stools. Consider holding high-dose fish oil (>2000mg/day).'
  },
  {
    drugA: 'Apixaban',
    drugB: 'Omega-3',
    severity: 'MAJOR',
    arcColor: '#F97316',
    mechanism: 'Additive antiplatelet and anticoagulant effects increase bleeding time.',
    clinicalGuidance: 'Monitor for unusual bruising, gum bleeding, or dark stools. Consider holding high-dose fish oil (>2000mg/day).'
  },
  {
    drugA: 'Apixaban',
    drugB: 'St. John\'s Wort',
    severity: 'MAJOR',
    arcColor: '#F97316',
    mechanism: 'CYP3A4/P-gp induction by St. John\'s Wort significantly lowers Apixaban blood levels, increasing stroke risk.',
    clinicalGuidance: 'Avoid combination. Discontinue St. John\'s Wort.'
  },
  {
    drugA: 'Sertraline',
    drugB: 'St. John\'s Wort',
    severity: 'CONTRAINDICATED',
    arcColor: '#EF4444',
    mechanism: 'Concurrent serotonergic enhancement causes potentially fatal Serotonin Syndrome.',
    clinicalGuidance: 'Immediately discontinue St. John\'s Wort. Watch for agitation, tremor, hyperreflexia, and diaphoresis.'
  },
  {
    drugA: 'Apixaban',
    drugB: 'Aspirin',
    severity: 'MAJOR',
    arcColor: '#F97316',
    mechanism: 'Additive anticoagulant and antiplatelet inhibition increases gastrointestinal and systemic bleeding risk.',
    clinicalGuidance: 'Avoid combination unless specifically indicated for acute coronary syndromes.'
  },
  {
    drugA: 'Aspirin',
    drugB: 'Ibuprofen',
    severity: 'MAJOR',
    arcColor: '#F97316',
    mechanism: 'Ibuprofen competitively inhibits platelet COX-1 binding, blocking low-dose aspirin cardioprotective effect and raising GI ulcer risk.',
    clinicalGuidance: 'Separate dosing: take immediate-release aspirin at least 30 minutes before or 8 hours after ibuprofen.'
  },
  {
    drugA: 'Clopidogrel',
    drugB: 'Omeprazole',
    severity: 'MAJOR',
    arcColor: '#F97316',
    mechanism: 'Omeprazole inhibits CYP2C19, reducing active clopidogrel metabolite formation and diminishing antiplatelet protection.',
    clinicalGuidance: 'Use pantoprazole or famotidine as gastroprotective alternative.'
  },
  {
    drugA: 'Carvedilol',
    drugB: 'Furosemide',
    severity: 'MODERATE',
    arcColor: '#EAB308',
    mechanism: 'Additive hypotensive effect increases risk of first-dose postural hypotension and dizziness.',
    clinicalGuidance: 'Monitor standing blood pressure upon initiation or dose increases.'
  },
  {
    drugA: 'Lisinopril',
    drugB: 'Spironolactone',
    severity: 'MAJOR',
    arcColor: '#F97316',
    mechanism: 'Dual blockade of aldosterone and angiotensin pathways severely limits potassium excretion.',
    clinicalGuidance: 'High risk of life-threatening hyperkalemia. Frequent serum potassium monitoring mandatory.'
  },
  {
    drugA: 'Ciprofloxacin',
    drugB: 'Calcium Carbonate',
    severity: 'MAJOR',
    arcColor: '#F97316',
    mechanism: 'Polyvalent cations form insoluble chelates with ciprofloxacin, reducing absorption by up to 75%.',
    clinicalGuidance: 'Separate administration: take ciprofloxacin at least 2 hours before or 6 hours after calcium supplements.'
  },
  {
    drugA: 'Ciprofloxacin',
    drugB: 'Calcium',
    severity: 'MAJOR',
    arcColor: '#F97316',
    mechanism: 'Polyvalent cations form insoluble chelates with ciprofloxacin, reducing absorption by up to 75%.',
    clinicalGuidance: 'Separate administration: take ciprofloxacin at least 2 hours before or 6 hours after calcium supplements.'
  },
  {
    drugA: 'Ibuprofen',
    drugB: 'Lisinopril',
    severity: 'MAJOR',
    arcColor: '#F97316',
    mechanism: 'NSAIDs inhibit renal prostaglandins, attenuating ACEi antihypertensive effect and precipitating acute kidney injury.',
    clinicalGuidance: 'Avoid routine NSAID use in patients with underlying renal disease or ACE inhibitor therapy.'
  },
  {
    drugA: 'Ibuprofen',
    drugB: 'Furosemide',
    severity: 'MAJOR',
    arcColor: '#F97316',
    mechanism: 'NSAIDs counteract diuretic efficacy and promote sodium and water retention.',
    clinicalGuidance: 'Avoid NSAIDs in heart failure and CKD patients taking loop diuretics.'
  },
  {
    drugA: 'Warfarin',
    drugB: 'Aspirin',
    severity: 'CONTRAINDICATED',
    arcColor: '#EF4444',
    mechanism: 'Dual anticoagulant and antiplatelet inhibition exponentially raises gastrointestinal and intracranial hemorrhage risk.',
    clinicalGuidance: 'Do not combine without explicit high-risk cardiology specialist authorization.'
  },
  {
    drugA: 'Warfarin',
    drugB: 'Ibuprofen',
    severity: 'CONTRAINDICATED',
    arcColor: '#EF4444',
    mechanism: 'Severe gastrointestinal bleeding risk due to platelet inhibition and gastric mucosal irritation.',
    clinicalGuidance: 'Avoid NSAIDs while on Warfarin. Use Acetaminophen for mild pain if approved.'
  },
  {
    drugA: 'Warfarin',
    drugB: 'Ginkgo Biloba',
    severity: 'CONTRAINDICATED',
    arcColor: '#EF4444',
    mechanism: 'Ginkgolides inhibit platelet-activating factor, amplifying anticoagulation and bleeding hazard.',
    clinicalGuidance: 'Discontinue herbal supplement Ginkgo Biloba.'
  },
  {
    drugA: 'Amlodipine',
    drugB: 'Simvastatin',
    severity: 'MODERATE',
    arcColor: '#EAB308',
    mechanism: 'CYP3A4 inhibition by Amlodipine increases Simvastatin exposure and myopathy/rhabdomyolysis risk.',
    clinicalGuidance: 'Limit Simvastatin dosage to a maximum of 20mg daily when co-administered with Amlodipine.'
  },
  {
    drugA: 'Enoxaparin',
    drugB: 'Rivaroxaban',
    severity: 'CONTRAINDICATED',
    arcColor: '#EF4444',
    mechanism: 'Concurrent dual full-dose anticoagulation causes critical hemorrhagic danger.',
    clinicalGuidance: 'Hold Rivaroxaban until Enoxaparin is completely cleared or vice versa.'
  },
  {
    drugA: 'Levothyroxine',
    drugB: 'Calcium Carbonate',
    severity: 'MAJOR',
    arcColor: '#F97316',
    mechanism: 'Calcium binds levothyroxine in the gastrointestinal tract, preventing adequate absorption.',
    clinicalGuidance: 'Separate dosing by at least 4 hours.'
  },
  {
    drugA: 'Levothyroxine',
    drugB: 'Iron',
    severity: 'MAJOR',
    arcColor: '#F97316',
    mechanism: 'Iron salts form an insoluble chelate with levothyroxine in the gut, reducing thyroid hormone absorption.',
    clinicalGuidance: 'Separate dosing by at least 4 hours.'
  }
];

export interface DrugDietInteractionRule {
  drugName: string;
  dietItem: string;
  severity: 'CONTRAINDICATED' | 'MAJOR' | 'MODERATE';
  badge: string;
  plateArcColor: string;
  mechanism: string;
  clinicalGuidance: string;
}

export const mockDrugDietInteractions: DrugDietInteractionRule[] = [
  {
    drugName: 'Atorvastatin',
    dietItem: 'Grapefruit',
    severity: 'MAJOR',
    badge: '🚫 Avoid Grapefruit',
    plateArcColor: '#F97316',
    mechanism: 'Furanocoumarins in grapefruit irreversibly inhibit intestinal CYP3A4, increasing statin AUC by >200%.',
    clinicalGuidance: 'Avoid consuming grapefruit or grapefruit juice while taking atorvastatin to prevent muscle toxicity (rhabdomyolysis).'
  },
  {
    drugName: 'Simvastatin',
    dietItem: 'Grapefruit',
    severity: 'MAJOR',
    badge: '🚫 Avoid Grapefruit',
    plateArcColor: '#EF4444',
    mechanism: 'Severe CYP3A4 inhibition dramatically raises simvastatin blood concentration.',
    clinicalGuidance: 'Strictly avoid grapefruit products while on simvastatin.'
  },
  {
    drugName: 'Warfarin',
    dietItem: 'Vitamin K (Spinach, Kale, Broccoli, Collards)',
    severity: 'MODERATE',
    badge: '🥬 Consistent Vit K',
    plateArcColor: '#EAB308',
    mechanism: 'Vitamin K directly antagonizes warfarin anticoagulant action, decreasing INR and increasing clot risk.',
    clinicalGuidance: 'Maintain consistent weekly intake of leafy greens rather than making sudden large changes.'
  },
  {
    drugName: 'Levothyroxine',
    dietItem: 'Breakfast / Dairy / Coffee / Espresso',
    severity: 'MAJOR',
    badge: '🍽️ Empty Stomach (30m)',
    plateArcColor: '#F97316',
    mechanism: 'Food, calcium, and coffee bind levothyroxine in the gut, decreasing bioavailability by up to 40%.',
    clinicalGuidance: 'Take first thing in the morning with a full glass of water, 30 to 60 minutes before breakfast or coffee.'
  },
  {
    drugName: 'Metronidazole',
    dietItem: 'Alcohol / Ethanol',
    severity: 'CONTRAINDICATED',
    badge: '🚫 Zero Alcohol',
    plateArcColor: '#EF4444',
    mechanism: 'Inhibits aldehyde dehydrogenase causing toxic acetaldehyde buildup (flushing, nausea, tachycardia).',
    clinicalGuidance: 'Completely avoid alcohol during therapy and for at least 48 hours after the last dose.'
  },
  {
    drugName: 'Lisinopril',
    dietItem: 'High Potassium Salt Substitutes',
    severity: 'MAJOR',
    badge: '🧂 Avoid K+ Salt Substitutes',
    plateArcColor: '#F97316',
    mechanism: 'ACE inhibitors reduce potassium excretion; salt substitutes with KCl can precipitate severe hyperkalemia.',
    clinicalGuidance: 'Do not use potassium-based salt substitutes without consulting your physician.'
  },
  {
    drugName: 'Doxycycline',
    dietItem: 'Dairy / Milk / Yogurt / Cheese',
    severity: 'MODERATE',
    badge: '🥛 Separate from Dairy (2h)',
    plateArcColor: '#EAB308',
    mechanism: 'Calcium in dairy binds doxycycline, reducing antibiotic bioavailability.',
    clinicalGuidance: 'Take doxycycline 1 to 2 hours before or after consuming dairy products.'
  },
  {
    drugName: 'Hydrochlorothiazide',
    dietItem: 'Black Licorice (Glycyrrhizin)',
    severity: 'MODERATE',
    badge: '🍬 Avoid Black Licorice',
    plateArcColor: '#EAB308',
    mechanism: 'Glycyrrhizin causes pseudoaldosteronism, exacerbating hypokalemia and hypertension.',
    clinicalGuidance: 'Avoid excessive intake of natural black licorice.'
  }
];

export interface DuplicateIngredientRule {
  ingredient: string;
  maxDailySafeMg: number;
  drugNames: string[];
}

export const mockDuplicateIngredientRules: DuplicateIngredientRule[] = [
  {
    ingredient: 'Acetaminophen',
    maxDailySafeMg: 4000,
    drugNames: ['Tylenol', 'Percocet', 'Vicodin', 'Excedrin', 'NyQuil', 'DayQuil', 'Fioricet']
  },
  {
    ingredient: 'Ibuprofen',
    maxDailySafeMg: 3200,
    drugNames: ['Advil', 'Motrin', 'Midol Liquid Gels']
  },
  {
    ingredient: 'NSAID Class',
    maxDailySafeMg: 1, // Concurrent dual NSAID count
    drugNames: ['Advil', 'Motrin', 'Aleve', 'Naproxen', 'Celebrex', 'Meloxicam', 'Diclofenac', 'Ketorolac', 'Ibuprofen']
  },
  {
    ingredient: 'Atorvastatin',
    maxDailySafeMg: 80,
    drugNames: ['Lipitor', 'Atorvastatin', 'Caduet']
  },
  {
    ingredient: 'Metformin',
    maxDailySafeMg: 2550,
    drugNames: ['Glucophage', 'Fortamet', 'Glumetza', 'Janumet', 'Synjardy', 'Kombiglyze', 'Metformin']
  }
];
