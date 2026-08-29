/**
 * CareCanvas Fixtures: 3-List Discharge Datasets (Pre-admission, In-hospital, Discharge)
 */

import type {  PreAdmissionMedItem, InHospitalMedItem, DischargeMedItem  } from '../types/rxbridge.ts';

export interface Patient3ListDischargeDataset {
  patientId: string;
  patientName: string;
  admissionDate: string;
  dischargeDate: string;
  ward: string;
  attendingPhysician: string;
  preAdmissionMeds: PreAdmissionMedItem[];
  inHospitalMeds: InHospitalMedItem[];
  dischargeMeds: DischargeMedItem[];
}

export const mockShantiDevi3ListDataset: Patient3ListDischargeDataset = {
  patientId: 'patient-s-devi',
  patientName: 'Smt. Shanti Devi',
  admissionDate: '2026-08-20',
  dischargeDate: '2026-08-25',
  ward: 'Cardiology Ward 4B',
  attendingPhysician: 'Dr. A. Patel, MD, FACC',
  preAdmissionMeds: [
    { medName: 'Metformin', dose: '500mg', frequency: 'Once daily with dinner', indication: 'Type 2 Diabetes', isOTC: false },
    { medName: 'Lisinopril', dose: '20mg', frequency: 'Once daily in morning', indication: 'Hypertension', isOTC: false },
    { medName: 'Atorvastatin', dose: '20mg', frequency: 'Once daily at bedtime', indication: 'Hyperlipidemia', isOTC: false },
    { medName: 'Levothyroxine', dose: '75mcg', frequency: 'Once daily before breakfast', indication: 'Hypothyroidism', isOTC: false },
    { medName: 'Aspirin', dose: '81mg', frequency: 'Once daily with breakfast', indication: 'Cardioprotection', isOTC: false },
    { medName: 'OTC Fish Oil', dose: '1000mg', frequency: 'Once daily in morning', indication: 'General Wellness', isOTC: true },
    { medName: 'OTC Calcium + Vit D', dose: '600mg/400IU', frequency: 'Once daily with lunch', indication: 'Bone Health', isOTC: true }
  ],
  inHospitalMeds: [
    { medName: 'Metformin', dose: 'Held', reason: 'Held for IV contrast coronary catheterization; restarted at 1000mg BID on ward' },
    { medName: 'Lisinopril', dose: 'Held / Stopped', reason: 'Held due to acute rise in serum creatinine from 1.3 to 1.8 mg/dL' },
    { medName: 'Atorvastatin', dose: '40mg', reason: 'Dose titrated from 20mg to 40mg post-angiography' },
    { medName: 'Apixaban', dose: '5mg BID', reason: 'Initiated for new-onset paroxysmal atrial fibrillation' },
    { medName: 'Aspirin', dose: 'Discontinued', reason: 'Stopped to avoid dual antithrombotic bleeding risk with Apixaban' },
    { medName: 'IV Heparin', dose: 'Titrated infusion', reason: 'Bridging therapy in CCU; stopped prior to discharge' }
  ],
  dischargeMeds: [
    {
      medName: 'Apixaban',
      dose: '5mg',
      frequency: 'Twice daily (08:00, 20:00)',
      status: 'NEW',
      reason: 'Atrial Fibrillation Stroke Prevention',
      timingSlots: ['morning', 'evening']
    },
    {
      medName: 'Metformin',
      dose: '1000mg',
      frequency: 'Twice daily with meals (08:00, 18:00)',
      status: 'DOSE_CHANGED',
      reason: 'Glycemic Control Optimization',
      timingSlots: ['morning', 'evening'],
      dietInstructions: 'Take with meals to reduce GI upset'
    },
    {
      medName: 'Atorvastatin',
      dose: '40mg',
      frequency: 'Once daily at bedtime (22:00)',
      status: 'DOSE_CHANGED',
      reason: 'Plaque Stabilization / Post-PCI',
      timingSlots: ['bedtime'],
      dietInstructions: 'Avoid grapefruit and grapefruit juice'
    },
    {
      medName: 'Levothyroxine',
      dose: '75mcg',
      frequency: 'Once daily on empty stomach (07:30)',
      status: 'CONTINUED',
      reason: 'Hypothyroidism',
      timingSlots: ['morning'],
      dietInstructions: 'Take 30-60m before breakfast; separate 4h from calcium'
    },
    {
      medName: 'Lisinopril',
      dose: '0mg',
      frequency: 'DISCONTINUED',
      status: 'STOPPED',
      reason: 'Renal Protection / Elevated Creatinine'
    },
    {
      medName: 'Aspirin',
      dose: '0mg',
      frequency: 'DISCONTINUED',
      status: 'STOPPED',
      reason: 'Replaced by Apixaban to minimize bleeding risk'
    }
  ]
};

export const mockHaroldJenkins3ListDataset: Patient3ListDischargeDataset = {
  patientId: 'p_jenkins_72',
  patientName: 'Harold Jenkins',
  admissionDate: '2026-08-10',
  dischargeDate: '2026-08-15',
  ward: 'Heart Failure Ward 3A',
  attendingPhysician: 'Dr. E. Evans, MD (Heart Failure)',
  preAdmissionMeds: [
    { medName: 'Metformin', dose: '1000mg', frequency: 'Twice daily with meals', indication: 'Type 2 Diabetes', isOTC: false },
    { medName: 'Empagliflozin', dose: '10mg', frequency: 'Once daily in morning', indication: 'Type 2 Diabetes / CKD', isOTC: false },
    { medName: 'Lisinopril', dose: '40mg', frequency: 'Once daily in morning', indication: 'Hypertension / HFpEF', isOTC: false },
    { medName: 'Furosemide', dose: '20mg', frequency: 'Once daily in morning', indication: 'Edema / HFpEF', isOTC: false },
    { medName: 'Carvedilol', dose: '12.5mg', frequency: 'Twice daily', indication: 'Heart Failure', isOTC: false },
    { medName: 'Atorvastatin', dose: '40mg', frequency: 'Once daily at bedtime', indication: 'Hyperlipidemia', isOTC: false },
    { medName: 'Allopurinol', dose: '100mg', frequency: 'Once daily in morning', indication: 'Gout', isOTC: false },
    { medName: 'OTC St. John\'s Wort', dose: '300mg', frequency: 'Once daily in morning', indication: 'Mood support', isOTC: true },
    { medName: 'OTC Ibuprofen', dose: '400mg', frequency: 'PRN for knee arthritis pain', indication: 'Osteoarthritis', isOTC: true }
  ],
  inHospitalMeds: [
    { medName: 'Lisinopril', dose: 'Discontinued', reason: 'Switched to Sacubitril/Valsartan (Entresto) 49/51mg BID for HFpEF decompensation' },
    { medName: 'Entresto', dose: '49/51mg BID', reason: 'Initiated 36 hours after Lisinopril washout to avoid angioedema' },
    { medName: 'Furosemide', dose: '40mg IV -> 40mg oral', reason: 'Diuresis for 8lb acute fluid gain; stabilized' },
    { medName: 'Ibuprofen', dose: 'Discontinued', reason: 'Strictly prohibited due to CKD 3b and acute fluid overload' }
  ],
  dischargeMeds: [
    {
      medName: 'Sacubitril/Valsartan (Entresto)',
      dose: '49/51mg',
      frequency: 'Twice daily (08:00, 20:00)',
      status: 'NEW',
      reason: 'Heart Failure with Preserved Ejection Fraction (HFpEF)',
      timingSlots: ['morning', 'evening']
    },
    {
      medName: 'Furosemide',
      dose: '40mg',
      frequency: 'Once daily in morning (08:00)',
      status: 'DOSE_CHANGED',
      reason: 'Volume Management / HFpEF',
      timingSlots: ['morning']
    },
    {
      medName: 'Carvedilol',
      dose: '12.5mg',
      frequency: 'Twice daily with food (08:00, 20:00)',
      status: 'CONTINUED',
      reason: 'Heart Failure / Blood Pressure Control',
      timingSlots: ['morning', 'evening']
    },
    {
      medName: 'Metformin',
      dose: '1000mg',
      frequency: 'Twice daily with meals (08:00, 18:00)',
      status: 'CONTINUED',
      reason: 'Type 2 Diabetes Mellitus',
      timingSlots: ['morning', 'evening']
    },
    {
      medName: 'Empagliflozin',
      dose: '10mg',
      frequency: 'Once daily in morning (08:00)',
      status: 'CONTINUED',
      reason: 'Cardio-Renal Protection & Diabetes',
      timingSlots: ['morning']
    },
    {
      medName: 'Atorvastatin',
      dose: '40mg',
      frequency: 'Once daily at bedtime (22:00)',
      status: 'CONTINUED',
      reason: 'Cardiovascular Risk Reduction',
      timingSlots: ['bedtime']
    },
    {
      medName: 'Allopurinol',
      dose: '100mg',
      frequency: 'Once daily in morning (08:00)',
      status: 'CONTINUED',
      reason: 'Gout Prevention',
      timingSlots: ['morning']
    },
    {
      medName: 'Lisinopril',
      dose: '0mg',
      frequency: 'DISCONTINUED',
      status: 'STOPPED',
      reason: 'Replaced by Sacubitril/Valsartan'
    }
  ]
};
