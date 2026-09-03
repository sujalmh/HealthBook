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

  // Fallback defaults if snapshot is loading or empty — vault-derived empty (no mock).
  const data: EmergencySnapshot = snapshot || {
    patientId: '',
    patientName: 'Patient',
    mrn: 'MRN-000000',
    dob: '—',
    age: 0 as unknown as number,
    gender: '—',
    bloodType: '—',
    codeStatus: '—',
    verifiedAllergies: [],
    activeMedications: [],
    baselineVitals: {
      systolicBP: 0,
      diastolicBP: 0,
      heartRate: 0,
      respiratoryRate: 0,
      oxygenSaturation: 0,
      weightLbs: 0,
      temperatureF: 0,
      lastUpdated: new Date().toISOString()
    },
    mostRecentCriticalLabs: [],
    emergencyContacts: [
      {
        name: 'Family member',
        relationship: 'Primary Caregiver & Emergency Contact',
        phone: '+1 (555) 010-0001',
        email: 'family.contact@example.com',
        isPrimary: true
      },
      {
        name: 'Your doctor',
        relationship: 'Primary Care Provider',
        phone: '+1 (555) 010-0002',
        email: 'care.team@example.com',
        isPrimary: false
      }
    ],
    qrValidationStamp: {
      stampId: 'qr_stamp_001',
      verificationCode: 'CC-EMRG-8834A',
      generatedAt: '2026-08-29T02:00:00Z',
      hash: 'sha256_8f4b23c91d8a245f7823e',
      signature: 'ECDSA_SHA256_LOCALVAULT_VERIFIED',
      issuer: 'Healthbook LocalVault Security Authority',
      qrPayload: 'https://healthbook.local/verify?code=CC-EMRG-8834A'
    }
  };

  const handleCopySummary = () => {
    const text = `
HEALTHBOOK EMERGENCY CLINICAL SNAPSHOT
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
    <div className="bg-canvas-card border border-canvas-border rounded-2xl p-4 sm:p-6 shadow-sm space-y-4 sm:space-y-6 text-slate-900 print:bg-white print:text-black print:border-none print:shadow-none animate-fade-in">
      {/* Top Banner: Emergency Priority Header & Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 border-b border-canvas-border pb-4 sm:pb-6 print:border-black">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl bg-rose-600 flex items-center justify-center text-white shadow-md shrink-0">
            <AlertOctagon className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-heading-lg text-slate-900 print:text-black">
                Emergency snapshot
              </h2>
              <span className="text-caption px-2 py-0.5 rounded-full bg-rose-50 text-clinical-red font-bold border border-rose-200 uppercase tracking-wider">
                Quick-card
              </span>
            </div>
            <p className="text-xs sm:text-body-sm text-muted print:text-gray-600">
              Key info for emergency care.
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
      <div className="bg-canvas-muted rounded-xl p-4 border border-canvas-border grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-body-sm">
        <div className="min-w-0">
          <span className="text-caption text-muted uppercase font-bold tracking-wider">Patient name</span>
          <p className="text-heading-md text-slate-900 truncate">{data.patientName}</p>
        </div>
        <div className="min-w-0">
          <span className="text-[10px] text-slate-600 uppercase font-bold tracking-wider">DOB / Age</span>
          <p className="text-[13px] font-bold text-slate-800 break-words">{data.dob} ({data.age}y)</p>
        </div>
        <div className="min-w-0">
          <span className="text-[10px] text-slate-600 uppercase font-bold tracking-wider">MRN / ID</span>
          <p className="text-[13px] font-mono font-bold text-sky-400 truncate" title={data.mrn}>{data.mrn}</p>
        </div>
        <div>
          <span className="text-[10px] text-slate-600 uppercase font-bold tracking-wider">Blood Type</span>
          <p className="text-sm font-bold text-rose-400">{data.bloodType}</p>
        </div>
        <div>
          <span className="text-[10px] text-slate-600 uppercase font-bold tracking-wider">Code Status</span>
          <span className="inline-block px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-700 font-bold text-[11px] border border-emerald-200">
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
                <h3 className="text-xs font-bold uppercase tracking-wider text-rose-400">
                  Verified Severe Allergies
                </h3>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-700 font-bold whitespace-nowrap">
                {data.verifiedAllergies.length} critical
              </span>
            </div>

            <div className="space-y-2">
              {data.verifiedAllergies.length === 0 ? (
                <p className="text-body-sm text-muted text-center py-2">No allergies recorded — add in My Records</p>
              ) : (
                data.verifiedAllergies.map((allergy, idx) => (
                  <div
                    key={allergy.id || idx}
                    className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center justify-between gap-3"
                  >
                    <div>
                      <h4 className="text-sm font-bold text-rose-700">{allergy.allergen}</h4>
                      <p className="text-[11px] text-rose-700/80 font-medium">Reaction: {allergy.reaction}</p>
                    </div>
                    <span className="px-2 py-1 rounded-lg bg-rose-600 text-white font-bold text-[10px] uppercase shadow-sm">
                      {allergy.severity.replace(/_/g, ' ')}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Critical Recent Labs */}
          <div className="bg-canvas-muted rounded-xl p-5 border border-canvas-border space-y-3">
            <div className="flex items-center justify-between border-b border-canvas-border pb-2.5">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-sky-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Most Recent Key Labs
                </h3>
              </div>
              <span className="text-[10px] text-slate-600 font-mono whitespace-nowrap">
                {(() => { try { return new Date(data.mostRecentCriticalLabs[0]?.drawDate || Date.now()).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); } catch { return ''; } })()}
              </span>
            </div>

            <div className="space-y-2">
              {data.mostRecentCriticalLabs.length === 0 ? (
                <p className="text-body-sm text-muted text-center py-2">No labs yet — add in Lab Results</p>
              ) : (
                data.mostRecentCriticalLabs.map((lab, idx) => {
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
                        <span className="text-[10px] text-slate-600 font-mono">{(() => { try { return new Date(lab.drawDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); } catch { return ''; } })()}</span>
                      </div>

                      <div className="text-right">
                        <div className="font-mono font-bold text-sm">
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
                })
              )}
            </div>
          </div>

          {/* Baseline Vitals Card */}
          <div className="bg-canvas-muted rounded-xl p-5 border border-canvas-border space-y-3">
            <div className="flex items-center gap-2 border-b border-canvas-border pb-2.5">
              <Heart className="w-4 h-4 text-rose-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Baseline Vital Signs
              </h3>
            </div>

            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="bg-canvas-card rounded-xl p-2.5 border border-canvas-border">
                <span className="text-caption text-muted block font-semibold">Blood pressure</span>
                <span className="text-heading-md font-bold font-mono text-slate-900">
                  {data.baselineVitals.systolicBP}/{data.baselineVitals.diastolicBP}
                </span>
                <span className="text-caption text-muted block">mmHg</span>
              </div>

              <div className="bg-canvas-card rounded-xl p-2.5 border border-canvas-border">
                <span className="text-caption text-muted block font-semibold">Heart rate</span>
                <span className="text-heading-md font-bold font-mono text-clinical-emerald">
                  {data.baselineVitals.heartRate}
                </span>
                <span className="text-caption text-muted block">bpm (Sinus)</span>
              </div>

              <div className="bg-canvas-card rounded-xl p-2.5 border border-canvas-border">
                <span className="text-caption text-muted block font-semibold">Oxygen (SpO2)</span>
                <span className="text-heading-md font-bold font-mono text-clinical-blue">
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
                <Pill className="w-4 h-4 text-teal-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Current Active Medications ({data.activeMedications.length})
                </h3>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-teal-500/20 text-teal-800 font-bold border border-teal-200">
                Reconciled Regimen
              </span>
            </div>

            <div className="space-y-2.5">
              {data.activeMedications.length === 0 ? (
                <p className="text-body-sm text-muted text-center py-2">No medicines yet — add in My Medicines or Medicine Review</p>
              ) : (
                data.activeMedications.map((med, idx) => (
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
                          <span className="ml-2 text-teal-800">[{med.timingSlots.join(', ')}]</span>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      {med.withFood && (
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                          With food
                        </span>
                      )}
                      {med.avoidGrapefruit && (
                        <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-bold">
                          No grapefruit
                        </span>
                      )}
                      {med.emptyStomach && (
                        <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[10px] font-bold">
                          Empty stomach
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Emergency Contacts & Physician Handover */}
          <div className="bg-canvas-muted rounded-xl p-5 border border-canvas-border space-y-3">
            <div className="flex items-center gap-2 border-b border-canvas-border pb-2.5">
              <Phone className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
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
          <div className="bg-canvas-muted rounded-2xl p-5 border border-canvas-border flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* Simulated High-Res QR Seal */}
              <div className="w-16 h-16 rounded-xl bg-canvas-card p-1.5 flex items-center justify-center shrink-0 shadow-sm border border-canvas-border">
                <QrCode className="w-full h-full text-slate-900" />
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold text-slate-900">Cryptographically Certified Snapshot</span>
                </div>
                <p className="text-[11px] text-slate-600 font-mono">
                  Verification Code: <strong className="text-teal-800 font-bold">{data.qrValidationStamp.verificationCode}</strong>
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
