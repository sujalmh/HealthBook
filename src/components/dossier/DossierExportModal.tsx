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
import { ModalPortal } from '../common/ModalPortal';

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
    <ModalPortal isOpen={isOpen} onClose={onClose} ariaLabel="Export clinical dossier package">
      <div className="bg-canvas-card border border-canvas-border rounded-2xl max-w-3xl w-full p-4 sm:p-8 shadow-2xl space-y-5 sm:space-y-6 text-slate-900 max-h-[90vh] overflow-y-auto mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-sky-50 text-clinical-blue border border-sky-200 flex items-center justify-center shadow-sm shrink-0">
              <Download className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-heading-lg text-slate-900 truncate">Export clinical dossier package</h3>
                <span className="text-caption px-2 py-0.5 rounded-full bg-sky-50 text-clinical-blue font-bold border border-sky-200 uppercase shrink-0">
                  CD6 interoperability
                </span>
              </div>
              <p className="text-body-sm text-muted line-clamp-1">
                Generate standards-compliant FHIR R4 JSON bundles, printable PDF summaries, and tabular CSV clinical archives.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-11 h-11 rounded-xl bg-canvas-muted hover:bg-canvas-border text-muted hover:text-slate-900 transition-colors flex items-center justify-center shrink-0 min-h-[44px] min-w-[44px]"
            aria-label="Close export modal"
          >
            ✕
          </button>
        </div>

        {/* Format Selector Tabs — tokenized */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                className={`p-4 rounded-xl text-left border transition-all space-y-1.5 min-h-[44px] ${
                  isSelected
                    ? 'bg-sky-50 border-sky-200 shadow-sm text-clinical-blue'
                    : 'bg-canvas-muted border-canvas-border text-muted hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className={`w-5 h-5 ${isSelected ? 'text-sky-400' : 'text-slate-600'}`} />
                  <span className="text-xs font-bold">{fmt.label}</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-tight">{fmt.desc}</p>
              </button>
            );
          })}
        </div>

        {/* Section Inclusion Checkboxes — tokenized */}
        <div className="bg-canvas-muted rounded-xl p-4 sm:p-5 border border-canvas-border space-y-3">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
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
                  className="flex items-center gap-2 text-left py-1.5 text-slate-700 hover:text-slate-900 transition-colors min-h-[36px]"
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
            <div className="bg-slate-50 rounded-2xl p-4 sm:p-5 border border-slate-200 space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                <span className="font-bold text-slate-700">Print Preview Format</span>
                <span className="text-[10px] text-emerald-400 font-mono">Verified High-Contrast Layout</span>
              </div>
              <p className="text-slate-600 text-xs leading-relaxed">
                The Doctor Consultation Print View prepares a consolidated, printer-friendly summary containing the patient's Emergency Snapshot, Active Medication Regimen, 5-Year Longitudinal Lab Trajectories, and Doctor Review Comments.
              </p>
            </div>

            <button
              onClick={() => {
                onClose();
                setTimeout(() => window.print(), 200);
              }}
              className="w-full py-3 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition-all shadow-md shadow-sky-600/20 flex items-center justify-center gap-2 min-h-[44px]"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save as PDF</span>
            </button>
          </div>
        ) : activeFormat === 'fhir' ? (
          <div className="space-y-4">
            {/* JSON Code Viewer */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 max-h-60 overflow-x-auto overflow-y-auto font-mono text-[11px] text-emerald-700/90 leading-normal">
              <pre className="overflow-x-auto">{JSON.stringify(dossier?.fhirBundle || {}, null, 2)}</pre>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                onClick={handleCopyFHIR}
                className="w-full sm:flex-1 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-200 transition-colors flex items-center justify-center gap-2 min-h-[44px]"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied to Clipboard' : 'Copy FHIR JSON'}</span>
              </button>

              <button
                onClick={handleDownloadFHIR}
                className="w-full sm:flex-1 py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-all shadow-md shadow-sky-600/20 flex items-center justify-center gap-2 min-h-[44px]"
              >
                <Download className="w-4 h-4" />
                <span>Download FHIR R4 Bundle (.json)</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 max-h-48 overflow-x-auto overflow-y-auto font-mono text-[10px] text-slate-700 leading-tight">
              <pre className="overflow-x-auto">{generateCSV()}</pre>
            </div>

            <button
              onClick={handleDownloadCSV}
              className="w-full py-3 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition-all shadow-md shadow-sky-600/20 flex items-center justify-center gap-2 min-h-[44px]"
            >
              <Download className="w-4 h-4" />
              <span>Download Tabular CSV (.csv)</span>
            </button>
          </div>
        )}
      </div>
    </ModalPortal>
  );
};
