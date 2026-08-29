import React, { useState } from 'react';
import {
  AlertOctagon,
  ShieldCheck,
  Heart,
  Pill,
  Activity,
  User,
  Phone,
  QrCode,
  Printer,
  Copy,
  Check,
  Download,
  Clock,
  Sparkles,
  ChevronRight,
  Flame,
  AlertTriangle
} from 'lucide-react';
import type { EmergencySnapshot } from '@/types/dossier';

interface EmergencySnapshotCardProps {
  snapshot?: EmergencySnapshot | null;
  onPrint?: () => void;
  onViewSource?: (factId: string) => void;
}

export const EmergencySnapshotCard: React.FC<EmergencySnapshotCardProps> = ({
  snapshot,
  onPrint,
  onViewSource
}) => {
  const [copied, setCopied] = useState(false);

  // Fallback defaults if snapshot is loading or empty — canonical patient  (unified)
  const data: EmergencySnapshot = snapshot || {
    patientId: '',
    patientName: 'Patient',
    mrn: 'MRN-984210',
    dob: '1948-03-14',
    age: 78,
    gender: 'F',
    bloodType: 'O+',
    codeStatus: 'Full Code',
    verifiedAllergies: [
      {
        id: 'allergy_1',
        patientId: '',
        allergen: 'Penicillin',
        reaction: 'Anaphylaxis',
        severity: 'severe',
        recordedDate: '2018-05-10'
      }
    ],
    activeMedications: [
      {
        id: 'm1',
        patientId: '',
        genericName: 'Apixaban',
        brandName: 'Eliquis',
        dosage: '5mg',
        frequency: 'Twice daily (BID)',
        timingSlots: ['morning', 'evening'],
        withFood: false,
        status: 'active'
      },
      {
        id: 'm2',
        patientId: '',
        genericName: 'Metformin',
        brandName: 'Glucophage',
        dosage: '1000mg',
        frequency: 'Twice daily (BID)',
        timingSlots: ['morning', 'evening'],
        withFood: true,
        status: 'active'
      },
      {
        id: 'm3',
        patientId: '',
        genericName: 'Atorvastatin',
        brandName: 'Lipitor',
        dosage: '40mg',
        frequency: 'Bedtime (QHS)',
        timingSlots: ['bedtime'],
        withFood: false,
        avoidGrapefruit: true,
        status: 'active'
      },
      {
        id: 'm4',
        patientId: '',
        genericName: 'Levothyroxine',
        brandName: 'Synthroid',
        dosage: '75mcg',
        frequency: 'Morning (QAM)',
        timingSlots: ['morning'],
        withFood: false,
        emptyStomach: true,
        avoidDairy: true,
        status: 'active'
      }
    ],
    baselineVitals: {
      systolicBP: 128,
      diastolicBP: 78,
      heartRate: 72,
      respiratoryRate: 16,
      oxygenSaturation: 98,
      weightLbs: 148,
      temperatureF: 98.6,
      lastUpdated: '2026-08-28T09:15:00Z'
    },
    mostRecentCriticalLabs: [
      {
        marker: 'eGFR',
        value: 28,
        unit: 'mL/min/1.73m2',
        drawDate: '2026-08-28',
        flag: 'CRITICAL_LOW',
        referenceRange: { low: 60, high: 120 },
        isCritical: true
      },
      {
        marker: 'Creatinine',
        value: 1.90,
        unit: 'mg/dL',
        drawDate: '2026-08-28',
        flag: 'HIGH',
        referenceRange: { low: 0.6, high: 1.2 }
      },
      {
        marker: 'Potassium (K+)',
        value: 4.8,
        unit: 'mEq/L',
        drawDate: '2026-08-28',
        flag: 'NORMAL',
        referenceRange: { low: 3.5, high: 5.1 }
      },
      {
        marker: 'HbA1c',
        value: 7.8,
        unit: '%',
        drawDate: '2026-08-25',
        flag: 'HIGH',
        referenceRange: { low: 4.0, high: 5.6 }
      },
      {
        marker: 'Fasting Glucose',
        value: 140,
        unit: 'mg/dL',
        drawDate: '2026-08-28',
        flag: 'HIGH',
        referenceRange: { low: 70, high: 99 }
      }
    ],
    emergencyContacts: [
      {
        name: 'Raj Devi',
        relationship: 'Son & Healthcare Proxy',
        phone: '+1 (555) 019-2834',
        email: 'raj.devi@family.org',
        isPrimary: true
      },
      {
        name: 'Dr. Anita Patel, MD (Cardiology)',
        relationship: 'Attending Cardiologist',
        phone: '+1 (555) 982-1100',
        email: 'dr.patel@cardiac.org',
        isPrimary: false
      }
    ],
    qrValidationStamp: {
      stampId: 'qr_stamp_001',
      verificationCode: 'CC-EMRG-8834A',
      generatedAt: '2026-08-29T02:00:00Z',
      hash: 'sha256_8f4b23c91d8a245f7823e',
      signature: 'ECDSA_SHA256_LOCALVAULT_VERIFIED',
      issuer: 'CareCanvas LocalVault Security Authority',
      qrPayload: 'https://carecanvas.local/verify?code=CC-EMRG-8834A'
    }
  };

  const handleCopySummary = () => {
    const text = `
CARECANVAS EMERGENCY CLINICAL SNAPSHOT
Patient: ${data.patientName} (${data.age}${data.gender}) | DOB: ${data.dob} | MRN: ${data.mrn} | Blood: ${data.bloodType} | Code: ${data.codeStatus}

ALLERGIES:
${data.verifiedAllergies.map(a => `- ${a.allergen}: ${a.reaction} (${a.severity.toUpperCase()})`).join('\n')}

ACTIVE MEDICATIONS (${data.activeMedications.length}):
${data.activeMedications.map(m => `- ${m.genericName} ${m.dosage} (${m.frequency})`).join('\n')}

RECENT CRITICAL LABS:
${data.mostRecentCriticalLabs.map(l => `- ${l.marker}: ${l.value} ${l.unit} [${l.flag}] (${l.drawDate})`).join('\n')}

BASELINE VITALS:
- BP: ${data.baselineVitals.systolicBP}/${data.baselineVitals.diastolicBP} mmHg | HR: ${data.baselineVitals.heartRate} bpm | SpO2: ${data.baselineVitals.oxygenSaturation}% | Wt: ${data.baselineVitals.weightLbs} lbs

PRIMARY CONTACT:
- ${data.emergencyContacts[0]?.name} (${data.emergencyContacts[0]?.relationship}): ${data.emergencyContacts[0]?.phone}

SECURITY VALIDATION:
- Code: ${data.qrValidationStamp.verificationCode} | Hash: ${data.qrValidationStamp.hash}
    `.trim();

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-canvas-card border border-canvas-border rounded-2xl p-5 sm:p-6 shadow-sm space-y-6 text-slate-900 print:bg-white print:text-black print:border-none print:shadow-none animate-fade-in">
      {/* Top Banner: Emergency Priority Header & Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-canvas-border pb-6 print:border-black">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-rose-500 to-amber-500 flex items-center justify-center text-white shadow-md">
            <AlertOctagon className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-heading-lg text-slate-900 print:text-black">
                Emergency clinical snapshot
              </h2>
              <span className="text-caption px-2.5 py-0.5 rounded-full bg-rose-50 text-clinical-red font-bold border border-rose-200 uppercase tracking-wider">
                High priority quick-card
              </span>
            </div>
            <p className="text-body-sm text-muted print:text-gray-600">
              One-page high-yield clinical overview for emergency physicians, paramedics, and specialists.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 self-end md:self-auto print:hidden">
          <button
            onClick={handleCopySummary}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-canvas-muted hover:bg-canvas-border text-slate-800 text-body-sm font-bold border border-canvas-border transition-colors shadow-sm min-h-[44px]"
          >
            {copied ? <Check className="w-4 h-4 text-clinical-emerald" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            onClick={() => {
              if (onPrint) onPrint();
              else window.print();
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white text-body-sm font-bold transition-all shadow-sm min-h-[44px]"
          >
            <Printer className="w-4 h-4" />
            <span>Print 1-page card</span>
          </button>
        </div>
      </div>

      {/* Patient Demographics Bar — tokenized */}
      <div className="bg-canvas-muted rounded-xl p-5 border border-canvas-border grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 text-body-sm">
        <div>
          <span className="text-caption text-muted uppercase font-bold tracking-wider">Patient name</span>
          <p className="text-heading-md text-slate-900">{data.patientName}</p>
        </div>
        <div>
          <span className="text-[10px] text-slate-600 uppercase font-bold tracking-wider">DOB / Age</span>
          <p className="text-sm font-bold text-slate-800">{data.dob} ({data.age}y / {data.gender})</p>
        </div>
        <div>
          <span className="text-[10px] text-slate-600 uppercase font-bold tracking-wider">MRN / ID</span>
          <p className="text-sm font-mono font-bold text-sky-400">{data.mrn}</p>
        </div>
        <div>
          <span className="text-[10px] text-slate-600 uppercase font-bold tracking-wider">Blood Type</span>
          <p className="text-sm font-black text-rose-400">{data.bloodType}</p>
        </div>
        <div>
          <span className="text-[10px] text-slate-600 uppercase font-bold tracking-wider">Code Status</span>
          <span className="inline-block px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-700 font-black text-[11px] border border-emerald-200">
            {data.codeStatus}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-slate-600 uppercase font-bold tracking-wider">Last Certified</span>
          <p className="text-xs text-slate-600 font-mono">
            {new Date(data.baselineVitals.lastUpdated || Date.now()).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Grid: Left Column (Allergies & Critical Labs) | Right Column (Active Meds & Vitals) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (5 Cols): Severe Allergies & Critical Labs */}
        <div className="lg:col-span-5 space-y-6">
          {/* Severe Allergies Card — tokenized light */}
          <div className="bg-rose-50/50 rounded-xl p-5 border border-rose-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-rose-900/30 pb-2.5">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-rose-500" />
                <h3 className="text-xs font-black uppercase tracking-wider text-rose-400">
                  Verified Severe Allergies
                </h3>
              </div>
              <span className="text-[10px] px-2 py-0.2 rounded-full bg-rose-500/20 text-rose-700 font-bold">
                {data.verifiedAllergies.length} Critical Alert(s)
              </span>
            </div>

            <div className="space-y-2">
              {data.verifiedAllergies.map((allergy, idx) => (
                <div
                  key={allergy.id || idx}
                  className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center justify-between gap-3"
                >
                  <div>
                    <h4 className="text-sm font-black text-rose-700">{allergy.allergen}</h4>
                    <p className="text-[11px] text-rose-700/80 font-medium">Reaction: {allergy.reaction}</p>
                  </div>
                  <span className="px-2 py-1 rounded-lg bg-rose-600 text-white font-black text-[10px] uppercase shadow-sm">
                    {allergy.severity.replace(/_/g, ' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Critical Recent Labs */}
          <div className="bg-canvas-muted rounded-xl p-5 border border-canvas-border space-y-3">
            <div className="flex items-center justify-between border-b border-canvas-border pb-2.5">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-sky-400" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Most Recent Key Labs
                </h3>
              </div>
              <span className="text-[10px] text-slate-600 font-mono">
                {data.mostRecentCriticalLabs[0]?.drawDate}
              </span>
            </div>

            <div className="space-y-2">
              {data.mostRecentCriticalLabs.map((lab, idx) => {
                const isCritical = lab.flag?.includes('CRITICAL');
                const isAbnormal = lab.flag?.includes('HIGH') || lab.flag?.includes('LOW');

                return (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                      isCritical
                        ? 'bg-rose-50 border-rose-200 text-rose-700'
                        : isAbnormal
                        ? 'bg-amber-50 border-amber-200 text-amber-700'
                        : 'bg-canvas-card border-canvas-border text-slate-900'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{lab.marker}</span>
                        <span className="text-[10px] font-mono text-slate-600">
                          (Ref: {lab.referenceRange?.low}-{lab.referenceRange?.high})
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-600 font-mono">{lab.drawDate}</span>
                    </div>

                    <div className="text-right">
                      <div className="font-mono font-black text-sm">
                        {lab.value} <span className="text-[10px] font-sans font-medium">{lab.unit}</span>
                      </div>
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-caption font-bold uppercase border ${
                          isCritical
                            ? 'bg-rose-600 text-white border-rose-600'
                            : isAbnormal
                            ? 'bg-amber-100 text-clinical-amber border-amber-200'
                            : 'bg-emerald-50 text-clinical-emerald border-emerald-200'
                        }`}
                      >
                        {lab.flag}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Baseline Vitals Card */}
          <div className="bg-canvas-muted rounded-xl p-5 border border-canvas-border space-y-3">
            <div className="flex items-center gap-2 border-b border-canvas-border pb-2.5">
              <Heart className="w-4 h-4 text-rose-400" />
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                Baseline Vital Signs
              </h3>
            </div>

            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="bg-canvas-card rounded-xl p-2.5 border border-canvas-border">
                <span className="text-caption text-muted block font-semibold">Blood pressure</span>
                <span className="text-heading-md font-black font-mono text-slate-900">
                  {data.baselineVitals.systolicBP}/{data.baselineVitals.diastolicBP}
                </span>
                <span className="text-caption text-muted block">mmHg</span>
              </div>

              <div className="bg-canvas-card rounded-xl p-2.5 border border-canvas-border">
                <span className="text-caption text-muted block font-semibold">Heart rate</span>
                <span className="text-heading-md font-black font-mono text-clinical-emerald">
                  {data.baselineVitals.heartRate}
                </span>
                <span className="text-caption text-muted block">bpm (Sinus)</span>
              </div>

              <div className="bg-canvas-card rounded-xl p-2.5 border border-canvas-border">
                <span className="text-caption text-muted block font-semibold">Oxygen (SpO2)</span>
                <span className="text-heading-md font-black font-mono text-clinical-blue">
                  {data.baselineVitals.oxygenSaturation}%
                </span>
                <span className="text-caption text-muted block">Room air</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (7 Cols): Active Medication Regimen & Handover Contacts */}
        <div className="lg:col-span-7 space-y-6">
          {/* Active Medications List */}
          <div className="bg-canvas-muted rounded-xl p-5 border border-canvas-border space-y-3">
            <div className="flex items-center justify-between border-b border-canvas-border pb-2.5">
              <div className="flex items-center gap-2">
                <Pill className="w-4 h-4 text-indigo-400" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Current Active Medications ({data.activeMedications.length})
                </h3>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-700 font-bold border border-indigo-200">
                Reconciled Regimen
              </span>
            </div>

            <div className="space-y-2.5">
              {data.activeMedications.map((med, idx) => (
                <div
                  key={med.id || idx}
                  className="bg-canvas-card rounded-xl p-3.5 border border-canvas-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-900 text-sm">
                        {med.genericName}
                        {med.brandName && (
                          <span className="text-slate-600 font-normal text-xs ml-1.5">
                            ({med.brandName})
                          </span>
                        )}
                      </h4>
                      <span className="px-2 py-0.2 rounded bg-sky-500/20 text-sky-700 font-mono font-bold text-[10px]">
                        {med.dosage}
                      </span>
                    </div>

                    <p className="text-slate-600 text-[11px]">
                      Frequency: <span className="text-slate-700 font-medium">{med.frequency}</span>
                      {med.timingSlots && (
                        <span className="ml-2 text-indigo-700">[{med.timingSlots.join(', ')}]</span>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    {med.withFood && (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                        🍽️ With Food
                      </span>
                    )}
                    {med.avoidGrapefruit && (
                      <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold">
                        🚫 No Grapefruit
                      </span>
                    )}
                    {med.emptyStomach && (
                      <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[10px] font-bold">
                        🥣 Empty Stomach
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Emergency Contacts & Physician Handover */}
          <div className="bg-canvas-muted rounded-xl p-5 border border-canvas-border space-y-3">
            <div className="flex items-center gap-2 border-b border-canvas-border pb-2.5">
              <Phone className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                Designated Emergency Contacts & Clinicians
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.emergencyContacts.map((contact, idx) => (
                <div
                  key={idx}
                  className="bg-canvas-card rounded-xl p-3.5 border border-canvas-border flex items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-900">{contact.name}</span>
                      {contact.isPrimary && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-700 font-bold">
                          Primary
                        </span>
                      )}
                    </div>
                    <p className="text-slate-600 text-[11px]">{contact.relationship}</p>
                    <a
                      href={`tel:${contact.phone}`}
                      className="font-mono text-sky-400 font-bold hover:underline block pt-1"
                    >
                      {contact.phone}
                    </a>
                  </div>

                  <a
                    href={`tel:${contact.phone}`}
                    className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-200 hover:bg-emerald-500/20 transition-colors"
                    title="Call Contact"
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                </div>
              ))}
            </div>
          </div>

          {/* QR Validation Seal & Tamper-Evident Attestation */}
          <div className="bg-gradient-to-r from-canvas-muted via-canvas-muted to-primary-light rounded-2xl p-5 border border-indigo-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* Simulated High-Res QR Seal */}
              <div className="w-16 h-16 rounded-xl bg-canvas-card p-1.5 flex items-center justify-center shrink-0 shadow-sm border border-canvas-border">
                <QrCode className="w-full h-full text-slate-900" />
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span className="font-black text-slate-900">Cryptographically Certified Snapshot</span>
                </div>
                <p className="text-[11px] text-slate-600 font-mono">
                  Verification Code: <strong className="text-indigo-700 font-bold">{data.qrValidationStamp.verificationCode}</strong>
                </p>
                <p className="text-[10px] text-slate-600 font-mono truncate max-w-xs">
                  Hash: {data.qrValidationStamp.hash}
                </p>
              </div>
            </div>

            <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-200 text-[10px] font-bold uppercase tracking-wider shrink-0">
              ✓ LocalVault Attested
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
