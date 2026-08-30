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
import { ModalPortal } from '../common/ModalPortal';

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
    setSelectedFile(preset === 'photo_slip' ? 'lab_photo_sample.jpg' : 'lab_report_aug2026.pdf');

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
    <ModalPortal isOpen={isOpen} onClose={onClose} ariaLabel="Upload Remote Lab Slip">
      <div className="bg-white border border-canvas-border rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] mx-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-canvas-border bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary-light text-primary flex items-center justify-center border border-primary-border">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-heading-md text-slate-900">Upload Remote Lab Slip</h3>
              <p className="text-body-sm text-muted">On-device OCR extraction with human verification</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-11 h-11 rounded-xl bg-canvas-muted hover:bg-canvas-border text-muted hover:text-slate-800 flex items-center justify-center transition-colors min-h-[44px] min-w-[44px]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {!isExtracted ? (
            <div className="space-y-4">
              {/* Dropzone Area */}
              <div className="border-2 border-dashed border-canvas-border hover:border-primary-border rounded-2xl p-8 text-center bg-canvas-muted transition-all space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-white text-primary flex items-center justify-center mx-auto shadow-sm border border-canvas-border">
                  <UploadCloud className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-heading-md text-slate-800">
                    Capture Smartphone Photo or Select Slip PDF
                  </h4>
                  <p className="text-body-sm text-muted max-w-sm mx-auto">
                    Supported formats: Smartphone JPG, PNG, or Clinic Portal PDF slip.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() => handleSimulateUpload('photo_slip')}
                    disabled={isProcessing}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-body-sm font-bold transition-all shadow-sm min-h-[44px]"
                  >
                    <Camera className="w-4 h-4" />
                    <span>{isProcessing ? 'Extracting OCR...' : 'Sample Photo Slip'}</span>
                  </button>

                  <button
                    onClick={() => handleSimulateUpload('pdf_report')}
                    disabled={isProcessing}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-canvas-muted disabled:opacity-50 text-slate-700 text-body-sm font-semibold border border-canvas-border transition-colors min-h-[44px]"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Standard PDF Slip</span>
                  </button>
                </div>
              </div>

              {/* Privacy Notice */}
              <div className="flex items-start gap-2.5 bg-white rounded-2xl p-4 border border-canvas-border text-body-sm text-muted">
                <Shield className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                <span>
                  <strong className="text-slate-800">🔒 100% On-Device OCR:</strong> Image processing and text parsing
                  occur entirely within your local browser sandbox. No protected health information (PHI) is ever
                  transmitted to the cloud.
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Slip Source Document Bounding Box Snippet */}
              <div className="bg-canvas-muted rounded-2xl p-4 border border-canvas-border space-y-3">
                <div className="flex items-center justify-between text-body-sm">
                  <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-primary" />
                    Source: Remote Collection Slip
                  </span>
                  <span className="text-emerald-700 font-mono text-caption">OCR Confidence: 96%</span>
                </div>

                <div className="bg-white rounded-xl p-3 text-body-sm font-mono text-slate-700 border border-canvas-border space-y-1">
                  <div className="text-muted">SERUM CREATININE: 1.90 mg/dL (Ref: 0.60 - 1.20) [HIGH]</div>
                  <div className="text-rose-600 font-bold">eGFR (CKD-EPI 2021): 28 mL/min/1.73m2 (Ref: &gt; 60) [CRITICAL LOW]</div>
                  <div className="text-muted">SERUM POTASSIUM: 4.8 mEq/L (Ref: 3.5 - 5.1) [NORMAL]</div>
                </div>
              </div>

              {/* Plain Language Narration Triad (F0.1) */}
              <div className="bg-primary-light border border-primary-border rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-body-sm font-bold text-primary-text">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Plain-Language Narrative Synthesis
                </div>
                <p className="text-body-sm text-slate-700 leading-relaxed">
                  {plainNarration}
                </p>
              </div>

              {/* Extracted Markers Breakdown */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-caption font-bold text-slate-800 uppercase tracking-wider">
                    Extracted Biomarkers
                  </h4>
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className="flex items-center gap-1.5 text-body-sm text-primary hover:text-primary-hover font-semibold px-3 py-1.5 rounded-xl hover:bg-primary-light transition-colors min-h-[44px]"
                  >
                    <Edit2 className="w-4 h-4" />
                    <span>{isEditing ? 'Cancel Edit' : 'Edit Values'}</span>
                  </button>
                </div>

                {!isEditing ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-canvas-muted rounded-2xl p-3 border border-canvas-border space-y-1">
                      <span className="text-caption text-muted">Creatinine</span>
                      <div className="text-heading-md text-amber-600">{editForm.creatinine} mg/dL</div>
                      <span className="text-caption font-bold text-amber-700">HIGH</span>
                    </div>
                    <div className="bg-rose-50 rounded-2xl p-3 border border-rose-200 space-y-1">
                      <span className="text-caption text-muted">eGFR</span>
                      <div className="text-heading-md text-rose-600">{editForm.egfr} mL/min</div>
                      <span className="text-caption font-bold text-rose-700">STAGE 4 STRAIN</span>
                    </div>
                    <div className="bg-canvas-muted rounded-2xl p-3 border border-canvas-border space-y-1">
                      <span className="text-caption text-muted">Potassium</span>
                      <div className="text-heading-md text-emerald-600">{editForm.potassium} mEq/L</div>
                      <span className="text-caption font-bold text-emerald-700">NORMAL</span>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-caption text-muted">Creatinine (mg/dL)</label>
                      <input
                        type="text"
                        value={editForm.creatinine}
                        onChange={(e) => setEditForm({ ...editForm, creatinine: e.target.value })}
                        className="w-full bg-canvas-muted border border-canvas-border rounded-xl px-3.5 py-2.5 text-body-sm text-slate-900 font-semibold focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 min-h-[44px]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-caption text-muted">eGFR (mL/min)</label>
                      <input
                        type="text"
                        value={editForm.egfr}
                        onChange={(e) => setEditForm({ ...editForm, egfr: e.target.value })}
                        className="w-full bg-canvas-muted border border-canvas-border rounded-xl px-3.5 py-2.5 text-body-sm text-slate-900 font-semibold focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 min-h-[44px]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-caption text-muted">Potassium (mEq/L)</label>
                      <input
                        type="text"
                        value={editForm.potassium}
                        onChange={(e) => setEditForm({ ...editForm, potassium: e.target.value })}
                        className="w-full bg-canvas-muted border border-canvas-border rounded-xl px-3.5 py-2.5 text-body-sm text-slate-900 font-semibold focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 min-h-[44px]"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer / Action Gate */}
        <div className="px-6 py-4 border-t border-canvas-border bg-white flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white hover:bg-canvas-muted text-slate-700 text-body-sm font-semibold border border-canvas-border transition-colors min-h-[44px] flex items-center justify-center"
          >
            Cancel
          </button>

          {isExtracted && (
            <button
              onClick={handleApproveAndCommit}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-body-sm font-bold transition-all shadow-sm min-h-[44px]"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Approve & Add to LabStory</span>
            </button>
          )}
        </div>
      </div>
    </ModalPortal>
  );
};
