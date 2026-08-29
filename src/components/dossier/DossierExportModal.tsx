import React, { useState } from 'react';
import {
  Download,
  FileJson,
  FileSpreadsheet,
  Printer,
  Copy,
  Check,
  ShieldCheck,
  CheckSquare,
  Square,
  FileText,
  Sparkles,
  Share2
} from 'lucide-react';
import type { CompiledHealthRecord } from '@/types/dossier';
import { eventBus } from '@/core/events/eventBus';

interface DossierExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  dossier: CompiledHealthRecord | null;
}

export const DossierExportModal: React.FC<DossierExportModalProps> = ({
  isOpen,
  onClose,
  dossier
}) => {
  const [activeFormat, setActiveFormat] = useState<'pdf' | 'fhir' | 'csv'>('pdf');
  const [copied, setCopied] = useState(false);
  const [sections, setSections] = useState({
    demographics: true,
    meds: true,
    labs: true,
    allergies: true,
    conditions: true,
    proposals: true,
    safety: true,
    auditTrail: true
  });

  if (!isOpen) return null;

  const toggleSection = (key: keyof typeof sections) => {
    setSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const generateCSV = (): string => {
    if (!dossier) return '';
    const rows: string[] = [];

    // Header
    rows.push('CareCanvas Lifetime Clinical Export');
    rows.push(`Patient,${dossier.patientProfile?.name || 'Patient'},MRN,${dossier.patientProfile?.mrn || 'N/A'},ExportDate,${new Date().toISOString()}`);
    rows.push('');

    // Active Meds
    if (sections.meds) {
      rows.push('SECTION: ACTIVE MEDICATIONS');
      rows.push('Generic Name,Brand Name,Dosage,Frequency,Timing Slots,With Food,Status');
      (dossier.activeMedications || []).forEach(m => {
        rows.push(`"${m.genericName}","${m.brandName || ''}","${m.dosage}","${m.frequency}","${(m.timingSlots || []).join('; ')}",${m.withFood},${m.status}`);
      });
      rows.push('');
    }

    // Labs
    if (sections.labs) {
      rows.push('SECTION: LONGITUDINAL LAB BIOMARKERS');
      rows.push('Draw Date,Biomarker,Result Value,Unit,Reference Low,Reference High,Flag,Doctor Note');
      (dossier.longitudinalLabs || []).forEach(l => {
        rows.push(`"${l.drawDate}","${l.marker}",${l.value ?? l.normalizedValue},"${l.unit}",${l.referenceRange?.low || ''},${l.referenceRange?.high || ''},"${l.flag || 'NORMAL'}","${l.doctorComment?.comment || ''}"`);
      });
      rows.push('');
    }

    // Allergies & Conditions
    if (sections.allergies) {
      rows.push('SECTION: VERIFIED ALLERGIES');
      rows.push('Allergen,Reaction,Severity,Recorded Date');
      (dossier.allergies || []).forEach(a => {
        rows.push(`"${a.allergen}","${a.reaction}","${a.severity}","${a.recordedDate || ''}"`);
      });
      rows.push('');
    }

    return rows.join('\n');
  };

  const handleDownloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    eventBus.dispatchToast({
      type: 'success',
      title: 'Export Downloaded',
      message: `Successfully saved ${filename}.`
    });
  };

  const handleDownloadFHIR = () => {
    if (!dossier?.fhirBundle) return;
    const jsonStr = JSON.stringify(dossier.fhirBundle, null, 2);
    handleDownloadFile(jsonStr, `carecanvas-fhir-r4-${dossier.patientId || 'patient'}.json`, 'application/json');
  };

  const handleDownloadCSV = () => {
    const csvContent = generateCSV();
    handleDownloadFile(csvContent, `carecanvas-clinical-history-${dossier?.patientId || 'patient'}.csv`, 'text/csv');
  };

  const handleCopyFHIR = () => {
    if (!dossier?.fhirBundle) return;
    navigator.clipboard.writeText(JSON.stringify(dossier.fhirBundle, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl space-y-6 text-slate-100 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/10 text-sky-400 border border-sky-500/30 flex items-center justify-center shadow-inner">
              <Download className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white tracking-tight">Export Clinical Dossier Package</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-bold border border-sky-500/30 uppercase">
                  CD6 Interoperability
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Generate standards-compliant FHIR R4 JSON bundles, printable PDF summaries, and tabular CSV clinical archives.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Format Selector Tabs */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { id: 'pdf', label: 'Doctor Consultation PDF', icon: Printer, desc: 'Print-ready 1-page clinical summary' },
            { id: 'fhir', label: 'FHIR R4 Bundle (JSON)', icon: FileJson, desc: 'HL7 / FHIR standard document format' },
            { id: 'csv', label: 'Tabular CSV Archive', icon: FileSpreadsheet, desc: 'Spreadsheet of labs and meds history' }
          ].map((fmt) => {
            const Icon = fmt.icon;
            const isSelected = activeFormat === fmt.id;
            return (
              <button
                key={fmt.id}
                type="button"
                onClick={() => setActiveFormat(fmt.id as any)}
                className={`p-4 rounded-2xl text-left border transition-all space-y-1.5 ${
                  isSelected
                    ? 'bg-sky-600/20 border-sky-500/60 shadow-md shadow-sky-500/10 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className={`w-5 h-5 ${isSelected ? 'text-sky-400' : 'text-slate-400'}`} />
                  <span className="text-xs font-bold">{fmt.label}</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">{fmt.desc}</p>
              </button>
            );
          })}
        </div>

        {/* Section Inclusion Checkboxes */}
        <div className="bg-slate-950 rounded-2xl p-5 border border-slate-800 space-y-3">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-300">
            Include Clinical Sections
          </h4>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {[
              { key: 'demographics', label: 'Demographics & Vitals' },
              { key: 'meds', label: 'Active & Historical Meds' },
              { key: 'labs', label: 'Longitudinal Labs' },
              { key: 'allergies', label: 'Severe Allergies' },
              { key: 'conditions', label: 'Chronic Diagnoses' },
              { key: 'proposals', label: 'Doctor Change Proposals' },
              { key: 'safety', label: 'Danger Sign Logs' },
              { key: 'auditTrail', label: 'Proxy Audit Trail' }
            ].map((sec) => {
              const checked = (sections as any)[sec.key];
              return (
                <button
                  key={sec.key}
                  type="button"
                  onClick={() => toggleSection(sec.key as any)}
                  className="flex items-center gap-2 text-left py-1 text-slate-300 hover:text-white transition-colors"
                >
                  {checked ? (
                    <CheckSquare className="w-4 h-4 text-sky-400 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-600 shrink-0" />
                  )}
                  <span className="text-[11px] font-medium">{sec.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Preview & Download Panel Based on Selected Format */}
        {activeFormat === 'pdf' ? (
          <div className="space-y-4">
            <div className="bg-slate-950 rounded-2xl p-5 border border-slate-800 space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <span className="font-bold text-slate-300">Print Preview Format</span>
                <span className="text-[10px] text-emerald-400 font-mono">Verified High-Contrast Layout</span>
              </div>
              <p className="text-slate-400 text-xs leading-relaxed">
                The Doctor Consultation Print View prepares a consolidated, printer-friendly summary containing the patient's Emergency Snapshot, Active Medication Regimen, 5-Year Longitudinal Lab Trajectories, and Doctor Review Comments.
              </p>
            </div>

            <button
              onClick={() => {
                onClose();
                setTimeout(() => window.print(), 200);
              }}
              className="w-full py-3 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition-all shadow-md shadow-sky-600/20 flex items-center justify-center gap-2"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save as PDF</span>
            </button>
          </div>
        ) : activeFormat === 'fhir' ? (
          <div className="space-y-4">
            {/* JSON Code Viewer */}
            <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 max-h-60 overflow-y-auto font-mono text-[11px] text-emerald-300/90 leading-normal">
              <pre>{JSON.stringify(dossier?.fhirBundle || {}, null, 2)}</pre>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleCopyFHIR}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-colors flex items-center justify-center gap-2"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied to Clipboard' : 'Copy FHIR JSON'}</span>
              </button>

              <button
                onClick={handleDownloadFHIR}
                className="flex-1 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-all shadow-md shadow-sky-600/20 flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Download FHIR R4 Bundle (.json)</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 max-h-48 overflow-y-auto font-mono text-[10px] text-slate-300 leading-tight">
              <pre>{generateCSV()}</pre>
            </div>

            <button
              onClick={handleDownloadCSV}
              className="w-full py-3 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition-all shadow-md shadow-sky-600/20 flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>Download Tabular CSV (.csv)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
