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
  const [causalResult, setCausalResult] = useState<any | null>(null);
  const [isQuestionAdded, setIsQuestionAdded] = useState(false);

  const presetQueries = [
    {
      label: 'eGFR vs NSAIDs & Metformin',
      marker: 'eGFR',
      query: 'Why did my eGFR drop in August 2026 after hospital discharge?'
    },
    {
      label: 'Glucose Spike vs Prednisone',
      marker: 'Glucose Fasting',
      query: 'What caused the fasting glucose spike in late 2023?'
    },
    {
      label: 'Creatinine vs Ibuprofen',
      marker: 'Creatinine',
      query: 'Why did my creatinine increase to 1.9 mg/dL?'
    },
    {
      label: 'Potassium vs ACE Inhibitors',
      marker: 'Potassium',
      query: 'Why is my potassium borderline elevated with my blood pressure pills?'
    },
    {
      label: 'Lipids vs Atorvastatin',
      marker: 'LDL',
      query: 'What caused the sustained improvement in my cholesterol numbers?'
    }
  ];

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
    } catch (err: any) {
      console.error('[CausalQueryPanel] Error executing correlate_meds:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToQuestionBank = () => {
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

    localVault.addQuestionBankItem(questionItem);
    setIsQuestionAdded(true);

    eventBus.dispatchToast({
      type: 'success',
      title: 'Question Added to Question Bank',
      message: `"${causalResult.recommendedDoctorQuestion.substring(0, 60)}..." is ready for your doctor appointment.`
    });

    eventBus.emit('question_bank', { action: 'add', item: questionItem });
  };

  return (
    <div className={`bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-100 flex items-center gap-2">
              <span>"Ask Why" Causal Biomarker Engine (LS3)</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                correlate_meds
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Correlate biomarker fluctuations with medication timing, dosage titrations, and discharge events.
            </p>
          </div>
        </div>
      </div>

      {/* Preset Query Chips */}
      <div className="space-y-1.5">
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Suggested Causal Queries</div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {presetQueries.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => {
                setQueryText(preset.query);
                handleExecuteQuery(preset.query, preset.marker);
              }}
              className="text-[11px] px-2.5 py-1.5 rounded-xl bg-slate-950/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 font-medium flex items-center gap-1.5 transition-all text-left"
            >
              <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
              <span>{preset.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Free-form Input */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleExecuteQuery()}
            placeholder={`Ask why ${activeMarker} changed or how medications affect your trajectory...`}
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-2.5 pl-3.5 pr-10 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 shadow-inner"
          />
        </div>
        <button
          onClick={() => handleExecuteQuery()}
          disabled={isLoading || (!queryText.trim() && !activeMarker)}
          className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 disabled:opacity-50 transition-all shrink-0"
        >
          {isLoading ? (
            <span className="inline-block animate-spin">⏳</span>
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
          <span>{isLoading ? 'Analyzing...' : 'Ask Why'}</span>
        </button>
      </div>

      {/* Causal Insight Result Card */}
      {causalResult && (
        <div className="bg-slate-950/90 border border-amber-500/30 rounded-2xl p-4 space-y-3 animate-fade-in text-xs">
          {/* Header & Trajectory Badge */}
          <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="font-black text-slate-100 text-sm">
                Causal Synthesis: {causalResult.biomarker}
              </span>
            </div>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
              {causalResult.trajectory?.replace(/_/g, ' ') || 'ANALYZED'}
            </span>
          </div>

          {/* Plain Language Narrative */}
          <p className="text-slate-200 leading-relaxed font-medium">
            {causalResult.causalStorySentence}
          </p>

          {/* Correlated Medications Callout */}
          {causalResult.correlatedMedications && causalResult.correlatedMedications.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                <Pill className="w-3.5 h-3.5 text-indigo-400" />
                Correlated Medications:
              </span>
              {causalResult.correlatedMedications.map((med: string, i: number) => (
                <span
                  key={i}
                  className="text-[10px] px-2 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30"
                >
                  {med}
                </span>
              ))}
            </div>
          )}

          {/* Doctor Question Generator (LS7) */}
          {causalResult.recommendedDoctorQuestion && (
            <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                  <BookmarkPlus className="w-3.5 h-3.5" />
                  <span>Targeted Doctor Question (LS7)</span>
                </div>
                <p className="text-xs text-slate-100 font-medium italic">
                  "{causalResult.recommendedDoctorQuestion}"
                </p>
              </div>

              <button
                onClick={handleAddToQuestionBank}
                disabled={isQuestionAdded}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shrink-0 transition-all ${
                  isQuestionAdded
                    ? 'bg-emerald-600 text-white'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-sm'
                }`}
              >
                {isQuestionAdded ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>In Question Bank</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
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
