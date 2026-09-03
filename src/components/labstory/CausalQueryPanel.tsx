import React, { useState } from 'react';
import {
  HelpCircle,
  Sparkles,
  Send,
  Plus,
  Check,
  AlertCircle,
  Pill,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  BookmarkPlus
} from 'lucide-react';
import { webMCPEngine } from '@/core/webmcp/WebMCPEngine';
import { localVault } from '@/core/vault/LocalVault';
import { eventBus } from '@/core/events/eventBus';
import type { QuestionBankItem } from '@/types/vault';

interface CausalQueryPanelProps {
  patientId: string;
  activeMarker: string;
  onHighlightCausalWindow?: (window: { start: string; end: string; label?: string } | null) => void;
  className?: string;
}

export const CausalQueryPanel: React.FC<CausalQueryPanelProps> = ({
  patientId,
  activeMarker,
  onHighlightCausalWindow,
  className = ''
}) => {
  const [queryText, setQueryText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [causalResult, setCausalResult] = useState<{ biomarker?: string; trajectory?: string; causalStorySentence?: string; correlatedMedications?: string[]; recommendedDoctorQuestion?: string; timeWindow?: { start: string; end: string } } | null>(null);
  const [isQuestionAdded, setIsQuestionAdded] = useState(false);

  const handleExecuteQuery = async (customQuery?: string, targetMarker?: string) => {
    const text = customQuery !== undefined ? customQuery : queryText;
    const marker = targetMarker || activeMarker || 'eGFR';
    if (!text.trim() && !marker) return;

    setIsLoading(true);
    setIsQuestionAdded(false);

    try {
      const context = {
        patientId,
        activeProfile: {
          userId: patientId,
          name: 'Patient',
          role: 'patient' as const,
          isProxy: false
        },
        vault: localVault,
        eventBus
      };

      const res = await webMCPEngine.execute(
        'correlate_meds',
        {
          biomarker: marker,
          queryText: text,
          patientId
        },
        context
      );

      if (res.success && res.data) {
        setCausalResult(res.data);
        if (onHighlightCausalWindow && res.data.timeWindow) {
          onHighlightCausalWindow({
            start: res.data.timeWindow.start,
            end: res.data.timeWindow.end,
            label: `${res.data.biomarker} shift (${res.data.correlatedMedications?.join(', ') || 'Medication effect'})`
          });
        }
      }
    } catch {

    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToQuestionBank = async () => {
    if (!causalResult?.recommendedDoctorQuestion) return;

    const questionItem: QuestionBankItem = {
      id: `qb_labstory_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      patientId,
      questionText: causalResult.recommendedDoctorQuestion,
      category: 'lab_trend',
      sourceModule: 'labstory',
      originModule: 'labstory',
      linkedLabMarker: causalResult.biomarker || activeMarker,
      priority: 'high',
      clinicalRationale: causalResult.causalStorySentence,
      status: 'active',
      createdAt: new Date().toISOString()
    };

    try {
      await localVault.addQuestionBankItem(questionItem);
    } catch (e: unknown) {
      eventBus.dispatchToast({
        type: 'error',
        title: 'Save failed',
        message: e instanceof Error ? e.message : 'Server save failed. Please retry.',
      });
      return;
    }
    setIsQuestionAdded(true);

    eventBus.dispatchToast({
      type: 'success',
      title: 'Question Added to Question Bank',
      message: `"${causalResult.recommendedDoctorQuestion.substring(0, 60)}..." is ready for your doctor appointment.`
    });

    eventBus.emit('question_bank', { action: 'add', item: questionItem });
  };

  return (
    <div className={`bg-canvas-card border border-canvas-border rounded-2xl p-4 sm:p-5 shadow-sm space-y-4 ${className}`}>
      {}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-canvas-border pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 shrink-0">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-heading-md font-bold text-slate-900 flex items-center gap-2 flex-wrap tracking-tight">
              <span>Ask why it changed</span>
            </h3>
            <p className="text-body-sm text-muted leading-relaxed">
              Ask about a test and see what medicines may be linked — in plain English.
            </p>
          </div>
        </div>
      </div>

      {}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleExecuteQuery()}
            placeholder={`Ask why ${activeMarker} changed or how medications affect your trajectory...`}
            className="w-full bg-canvas-muted border border-canvas-border rounded-xl py-2.5 pl-3.5 pr-10 text-body-sm text-slate-900 placeholder:text-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-inner min-h-[44px]"
          />
        </div>
        <button
          type="button"
          onClick={() => handleExecuteQuery()}
          disabled={isLoading || (!queryText.trim() && !activeMarker)}
          className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-body-sm flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 transition-all shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[44px]"
        >
          {isLoading ? (
            <span className="inline-block animate-spin">⏳</span>
          ) : (
            <Send className="w-4 h-4" />
          )}
          <span>{isLoading ? 'Analyzing...' : 'Ask Why'}</span>
        </button>
      </div>

      {}
      {causalResult && (
        <div className="bg-canvas-muted border border-amber-200 rounded-xl p-4 space-y-3 animate-fade-in text-body-sm shadow-sm">
          {}
          <div className="flex items-center justify-between gap-2 border-b border-canvas-border pb-2 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-700">
                <Sparkles className="w-4 h-4" />
              </div>
              <span className="font-bold text-slate-900 text-heading-md tracking-tight">
                Causal Synthesis: {causalResult.biomarker}
              </span>
            </div>
            <span className="text-caption px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
              {causalResult.trajectory?.replace(/_/g, ' ') || 'ANALYZED'}
            </span>
          </div>

          {}
          <p className="text-slate-900 leading-relaxed font-medium">
            {causalResult.causalStorySentence}
          </p>

          {}
          {causalResult.correlatedMedications && causalResult.correlatedMedications.length > 0 && (
            <div className="bg-canvas-card border border-canvas-border rounded-xl p-2.5 flex items-center gap-2 flex-wrap shadow-sm">
              <span className="text-caption font-bold text-muted flex items-center gap-1">
                <Pill className="w-3.5 h-3.5 text-primary shrink-0" />
                Linked medicines:
              </span>
              {causalResult.correlatedMedications.map((med: string, i: number) => (
                <span
                  key={i}
                  className="text-caption px-2.5 py-0.5 rounded-full bg-primary-light text-primary-text font-bold border border-primary-border"
                >
                  {med}
                </span>
              ))}
            </div>
          )}

          {}
          {causalResult.recommendedDoctorQuestion && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1 flex-1">
                <div className="text-caption font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1">
                  <BookmarkPlus className="w-3.5 h-3.5 shrink-0" />
                  <span>Targeted Doctor Question</span>
                </div>
                <p className="text-body-sm text-slate-900 font-medium italic leading-relaxed">
                  "{causalResult.recommendedDoctorQuestion}"
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddToQuestionBank}
                disabled={isQuestionAdded}
                className={`px-4 py-2.5 rounded-xl font-bold text-body-sm flex items-center justify-center gap-2 shrink-0 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[44px] w-full sm:w-auto ${
                  isQuestionAdded
                    ? 'bg-emerald-600 text-white'
                    : 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm'
                }`}
              >
                {isQuestionAdded ? (
                  <>
                    <Check className="w-4 h-4 shrink-0" />
                    <span>In Question Bank</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 shrink-0" />
                    <span>Add to Question Bank</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

