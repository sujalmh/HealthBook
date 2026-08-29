import React, { useState } from 'react';
import {
  X,
  UploadCloud,
  FileText,
  Camera,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Info,
  Shield,
  Layers,
  ArrowRight,
  Edit2
} from 'lucide-react';
import { webMCPEngine } from '@/core/webmcp/WebMCPEngine';
import { localVault } from '@/core/vault/LocalVault';
import { eventBus } from '@/core/events/eventBus';
import { mockHomeLabPhotoSlip } from '@/fixtures/documents';

interface UploadLabModalProps {
  isOpen: boolean;
  onClose: () => void;
  linkedDueCardId?: string;
  patientId: string;
  onSuccess?: () => void;
}

export const UploadLabModal: React.FC<UploadLabModalProps> = ({
  isOpen,
  onClose,
  linkedDueCardId,
  patientId,
  onSuccess
}) => {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExtracted, setIsExtracted] = useState(false);
  const [extractedValues, setExtractedValues] = useState<any[]>([]);
  const [plainNarration, setPlainNarration] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<{ creatinine: string; egfr: string; potassium: string }>({
    creatinine: '1.90',
    egfr: '28',
    potassium: '4.8'
  });

  if (!isOpen) return null;

  const handleSimulateUpload = async (preset: 'photo_slip' | 'pdf_report' = 'photo_slip') => {
    setIsProcessing(true);
    setSelectedFile(preset === 'photo_slip' ? 'metropolis_lab_photo.jpg' : 'lab_report_aug2026.pdf');

    try {
      const result = await webMCPEngine.execute(
        'upload_lab_image',
        {
          imageBlob: 'mock_photo_slip_blob_base64',
          patientId,
          linkedDueCardId
        },
        {
          patientId,
          activeProfile: { userId: patientId, name: 'Patient', role: 'patient', isProxy: false },
          vault: localVault,
          eventBus
        }
      );

      if (result.success && result.data) {
        setExtractedValues(result.data.extractedValues || []);
        setPlainNarration(result.plainLanguageSummary || result.data.plainNarration || '');
        setIsExtracted(true);
      }
    } catch (err) {
      console.error('Error extracting lab image:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApproveAndCommit = () => {
    // Add LabRecords directly to LocalVault so LabStory updates immediately
    const creatVal = parseFloat(editForm.creatinine) || 1.90;
    const egfrVal = parseFloat(editForm.egfr) || 28;
    const kVal = parseFloat(editForm.potassium) || 4.8;
    const drawDate = new Date().toISOString();

    localVault.addLab({
      id: `lab_creat_${Date.now()}`,
      patientId,
      marker: 'Creatinine',
      value: creatVal,
      unit: 'mg/dL',
      normalizedValue: creatVal,
      normalizedUnit: 'mg/dL',
      drawDate,
      referenceRange: { low: 0.6, high: 1.2 },
      optimalRange: { low: 0.7, high: 1.0 },
      isBorderline: false,
      isCritical: creatVal > 2.0,
      flag: creatVal > 1.2 ? 'HIGH' : 'NORMAL',
      sourceDocId: 'doc_homelab_slip_002'
    });

    localVault.addLab({
      id: `lab_egfr_${Date.now()}`,
      patientId,
      marker: 'eGFR',
      value: egfrVal,
      unit: 'mL/min/1.73m2',
      normalizedValue: egfrVal,
      normalizedUnit: 'mL/min/1.73m2',
      drawDate,
      referenceRange: { low: 60, high: 120 },
      optimalRange: { low: 90, high: 120 },
      isBorderline: false,
      isCritical: egfrVal < 30,
      flag: egfrVal < 30 ? 'CRITICAL_LOW' : egfrVal < 60 ? 'LOW' : 'NORMAL',
      sourceDocId: 'doc_homelab_slip_002'
    });

    localVault.addLab({
      id: `lab_k_${Date.now()}`,
      patientId,
      marker: 'Potassium',
      value: kVal,
      unit: 'mEq/L',
      normalizedValue: kVal,
      normalizedUnit: 'mEq/L',
      drawDate,
      referenceRange: { low: 3.5, high: 5.1 },
      optimalRange: { low: 4.0, high: 4.8 },
      isBorderline: false,
      isCritical: false,
      flag: 'NORMAL',
      sourceDocId: 'doc_homelab_slip_002'
    });

    // Mark due card as completed if linked
    if (linkedDueCardId) {
      localVault.updateDueCard(linkedDueCardId, {
        status: 'completed',
        completedLabId: 'doc_homelab_slip_002'
      });
    }

    eventBus.dispatchToast({
      type: 'success',
      title: 'Lab Result Ingested',
      message: `Verified Creatinine: ${creatVal} mg/dL, eGFR: ${egfrVal} mL/min into LabStory.`
    });

    eventBus.emit('lab_added', { patientId });
    if (onSuccess) onSuccess();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/10 text-sky-400 flex items-center justify-center border border-sky-500/20">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Upload Remote Lab Slip</h3>
              <p className="text-xs text-slate-400">On-device OCR extraction with human verification</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {!isExtracted ? (
            <div className="space-y-4">
              {/* Dropzone Area */}
              <div className="border-2 border-dashed border-slate-700 hover:border-sky-500/60 rounded-3xl p-8 text-center bg-slate-950/40 transition-all space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-slate-800 text-sky-400 flex items-center justify-center mx-auto shadow-inner">
                  <UploadCloud className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-200">
                    Capture Smartphone Photo or Select Slip PDF
                  </h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Supported formats: Smartphone JPG, PNG, or Clinic Portal PDF slip.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() => handleSimulateUpload('photo_slip')}
                    disabled={isProcessing}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-lg shadow-sky-600/20"
                  >
                    <Camera className="w-4 h-4" />
                    <span>{isProcessing ? 'Extracting OCR...' : 'Sample Photo Slip (Metropolis)'}</span>
                  </button>

                  <button
                    onClick={() => handleSimulateUpload('pdf_report')}
                    disabled={isProcessing}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-bold border border-slate-700 transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Standard PDF Slip</span>
                  </button>
                </div>
              </div>

              {/* Privacy Notice */}
              <div className="flex items-start gap-2.5 bg-slate-950/60 rounded-2xl p-4 border border-slate-800/80 text-xs text-slate-400">
                <Shield className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <span>
                  <strong className="text-slate-200">🔒 100% On-Device OCR:</strong> Image processing and text parsing
                  occur entirely within your local browser sandbox. No protected health information (PHI) is ever
                  transmitted to the cloud.
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Slip Source Document Bounding Box Snippet */}
              <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-300 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-sky-400" />
                    Source: Metropolis Healthcare Remote Collection Slip
                  </span>
                  <span className="text-emerald-400 font-mono text-[11px]">OCR Confidence: 96%</span>
                </div>

                <div className="bg-slate-900 rounded-xl p-3 text-xs font-mono text-slate-300 border border-slate-800 space-y-1">
                  <div className="text-slate-400">SERUM CREATININE: 1.90 mg/dL (Ref: 0.60 - 1.20) [HIGH]</div>
                  <div className="text-rose-400 font-bold">eGFR (CKD-EPI 2021): 28 mL/min/1.73m2 (Ref: &gt; 60) [CRITICAL LOW]</div>
                  <div className="text-slate-400">SERUM POTASSIUM: 4.8 mEq/L (Ref: 3.5 - 5.1) [NORMAL]</div>
                </div>
              </div>

              {/* Plain Language Narration Triad (F0.1) */}
              <div className="bg-sky-950/30 border border-sky-500/30 rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-sky-300">
                  <Sparkles className="w-4 h-4 text-sky-400" />
                  Plain-Language Narrative Synthesis
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {plainNarration}
                </p>
              </div>

              {/* Extracted Markers Breakdown */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Extracted Biomarkers
                  </h4>
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 font-semibold"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>{isEditing ? 'Cancel Edit' : 'Edit Values'}</span>
                  </button>
                </div>

                {!isEditing ? (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-950 rounded-2xl p-3 border border-slate-800 space-y-1">
                      <span className="text-[11px] text-slate-400">Creatinine</span>
                      <div className="text-base font-black text-amber-400">{editForm.creatinine} mg/dL</div>
                      <span className="text-[10px] font-bold text-amber-500">HIGH</span>
                    </div>
                    <div className="bg-slate-950 rounded-2xl p-3 border border-rose-500/30 space-y-1">
                      <span className="text-[11px] text-slate-400">eGFR</span>
                      <div className="text-base font-black text-rose-400">{editForm.egfr} mL/min</div>
                      <span className="text-[10px] font-bold text-rose-500">STAGE 4 STRAIN</span>
                    </div>
                    <div className="bg-slate-950 rounded-2xl p-3 border border-slate-800 space-y-1">
                      <span className="text-[11px] text-slate-400">Potassium</span>
                      <div className="text-base font-black text-emerald-400">{editForm.potassium} mEq/L</div>
                      <span className="text-[10px] font-bold text-emerald-500">NORMAL</span>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] text-slate-400">Creatinine (mg/dL)</label>
                      <input
                        type="text"
                        value={editForm.creatinine}
                        onChange={(e) => setEditForm({ ...editForm, creatinine: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100 font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] text-slate-400">eGFR (mL/min)</label>
                      <input
                        type="text"
                        value={editForm.egfr}
                        onChange={(e) => setEditForm({ ...editForm, egfr: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100 font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] text-slate-400">Potassium (mEq/L)</label>
                      <input
                        type="text"
                        value={editForm.potassium}
                        onChange={(e) => setEditForm({ ...editForm, potassium: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100 font-bold"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer / Action Gate */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
          >
            Cancel
          </button>

          {isExtracted && (
            <button
              onClick={handleApproveAndCommit}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-lg shadow-emerald-600/20"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Approve & Add to LabStory</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
