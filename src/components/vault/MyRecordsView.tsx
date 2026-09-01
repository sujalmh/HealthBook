import React, { useState, useEffect } from 'react';
import { FileText } from 'lucide-react';
import { DocumentDropzone } from '@/components/vault/DocumentDropzone';
import { FactStreamView } from '@/components/vault/FactStreamView';
import { BoundingBoxViewer } from '@/components/common/BoundingBoxViewer';
import { localVault } from '@/core/vault/LocalVault';
import { eventBus } from '@/core/events/eventBus';

interface MyRecordsViewProps {
  patientId: string;
  activeProfile?: any;
  onBusyChange?: (busy: boolean) => void;
}

export const MyRecordsView: React.FC<MyRecordsViewProps> = ({ patientId, onBusyChange }) => {
  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | undefined>(undefined);
  const [isBusy, setIsBusy] = useState(false);

  const effectivePatientId =
    patientId ||
    (() => {
      try {
        const raw = localStorage.getItem('carecanvas_active_user');
        if (raw) {
          const parsed = JSON.parse(raw);
          return parsed?.userId || parsed?.id || '';
        }
      } catch {}
      return '';
    })() ||
    '';

  const loadDocuments = async () => {
    if (!effectivePatientId) {
      setDocuments([]);
      return;
    }
    try {
      const docs = await localVault.getDocuments(effectivePatientId);
      const sorted = [...docs].sort((a: any, b: any) => new Date(a.uploadTimestamp).getTime() - new Date(b.uploadTimestamp).getTime());
      setDocuments(sorted);
      if (sorted.length > 0) {
        const exists = selectedDocId ? sorted.find((d) => d.id === selectedDocId) : null;
        if (!exists) {
          setSelectedDocId(sorted[sorted.length - 1].id);
        }
      } else {
        setSelectedDocId(undefined);
      }
    } catch {
      setDocuments([]);
    }
  };

  useEffect(() => {
    loadDocuments();
    // Reload on fact events (extraction complete may add docs/facts)
    const u1 = eventBus.on('fact_extracted', loadDocuments);
    const u2 = eventBus.on('fact_confirmed', loadDocuments);
    const u3 = eventBus.on('fact_status_changed', loadDocuments);
    return () => {
      u1();
      u2();
      u3();
    };
  }, [effectivePatientId]);

  // Also reload when selectedDocId changes? Not needed.

  const handleDocumentAdded = (docId: string) => {
    setSelectedDocId(docId);
    loadDocuments();
  };

  const handleBusyChange = (busy: boolean) => {
    setIsBusy(busy);
    onBusyChange?.(busy);
  };

  return (
    <div className="w-full space-y-4 relative">
      {/* Header — simple English */}
      <div className="bg-white border border-canvas-border rounded-2xl p-3 sm:p-4 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900">Your health papers</h2>
        <p className="text-xs text-slate-500 mt-0.5">Add a paper, see what we read, then review what we found.</p>
      </div>

      {/* Top Dropzone — compact */}
      <DocumentDropzone patientId={effectivePatientId} onDocumentAdded={handleDocumentAdded} onExtracted={loadDocuments} onBusyChange={handleBusyChange} />

      {/* Viewer with doc gallery */}
      <div className="space-y-3">
        {documents.length > 0 ? (
          <div className="bg-white border border-canvas-border rounded-2xl p-3 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-bold text-slate-900">Your papers ({documents.length}) — tap to view</h4>
            </div>
            <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
              {documents.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => setSelectedDocId(doc.id)}
                  className={`shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold min-h-[44px] transition-colors ${
                    selectedDocId === doc.id
                      ? 'bg-primary-light border-primary-border text-primary-text shadow-sm'
                      : 'bg-white border-canvas-border text-slate-700 hover:bg-slate-50'
                  }`}
                  aria-pressed={selectedDocId === doc.id}
                  title={doc.fileName || doc.name}
                >
                  <FileText className={`w-4 h-4 shrink-0 ${selectedDocId === doc.id ? 'text-primary-text' : 'text-slate-500'}`} />
                  <span className="max-w-[140px] truncate text-left">{doc.fileName || doc.name || 'Paper'}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white border border-canvas-border rounded-2xl p-4 text-center">
            <p className="text-xs text-slate-500">No papers yet — add one above to see it here.</p>
          </div>
        )}

        <div className="w-full">
          <BoundingBoxViewer documentId={selectedDocId} documentTitle={documents.find((d) => d.id === selectedDocId)?.fileName} />
        </div>
      </div>

      {/* Review list */}
      <FactStreamView patientId={effectivePatientId} />

      {/* Blocking overlay — wait till final results */}
      {isBusy && (
        <div className="fixed inset-0 bg-slate-900/35 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 shadow-xl flex flex-col items-center gap-3 max-w-sm w-full border border-slate-200">
            <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" aria-label="Loading" />
            <p className="text-sm font-bold text-slate-900 text-center">Reading your paper, please wait...</p>
            <p className="text-xs text-slate-500 text-center">We're finding medicines, tests and important notes. Please don't close or switch pages until we finish.</p>
          </div>
        </div>
      )}
    </div>
  );
};
