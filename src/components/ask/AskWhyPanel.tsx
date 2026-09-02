import React, { useState, useEffect } from 'react';
import { HelpCircle, Sparkles, Send, Plus, Check, Pill, ChevronDown, ChevronRight } from 'lucide-react';
import { webMCPEngine } from '@/core/webmcp/WebMCPEngine';
import { localVault } from '@/core/vault/LocalVault';
import { eventBus } from '@/core/events/eventBus';
import type { QuestionBankItem } from '@/types/vault';
import { GroundedInsightsPanel } from '@/components/search/GroundedInsightsPanel';

interface AskWhyPanelProps {
  patientId: string;
  initialMarker?: string;
  initialQuery?: string;
  className?: string;
}

export const AskWhyPanel: React.FC<AskWhyPanelProps> = ({ patientId, initialMarker, initialQuery, className = '' }) => {
  const [marker, setMarker] = useState(initialMarker || 'eGFR');
  const [queryText, setQueryText] = useState(initialQuery || '');
  const [isLoading, setIsLoading] = useState(false);
  const [causalResult, setCausalResult] = useState<any | null>(null);
  const [isQuestionAdded, setIsQuestionAdded] = useState(false);
  const [showIdeas, setShowIdeas] = useState(false);
  const [showGrounding, setShowGrounding] = useState(false);
  const [vaultContext, setVaultContext] = useState('');

  useEffect(() => {
    if (initialMarker) setMarker(initialMarker);
  }, [initialMarker]);
  useEffect(() => {
    if (initialQuery) setQueryText(initialQuery);
  }, [initialQuery]);

  // Listen for navigate_ask from LabStory
  useEffect(() => {
    const off = eventBus.on('navigate_ask', (payload: any) => {
      if (payload?.marker) setMarker(payload.marker);
      if (payload?.query) setQueryText(payload.query);
      // auto-run if marker present
      if (payload?.query || payload?.marker) {
        // optional auto-execute after state set - handled via next effect
      }
    });
    return () => off();
  }, []);

  const presetQueries = [
    { label: 'Kidney change — medicines?', marker: 'eGFR', query: 'Why did my kidney test change?' },
    { label: 'Sugar spike — why?', marker: 'Glucose Fasting', query: 'What caused my sugar to go up?' },
    { label: 'Creatinine high — why?', marker: 'Creatinine', query: 'Why is my creatinine high?' },
    { label: 'Potassium — medicines?', marker: 'Potassium', query: 'Why is my potassium a little high?' },
    { label: 'Cholesterol — better?', marker: 'LDL', query: 'Why did my cholesterol get better?' },
  ];

  // Derive vault context string for grounding — what IS in vault after extraction
  useEffect(() => {
    try {
      const meds = localVault.getMedications(patientId) || [];
      const labs = localVault.getLabs(patientId, marker) || [];
      const parts: string[] = [];
      if (labs.length) parts.push(`${marker}: ${labs.slice(-2).map((l:any)=> `${l.normalizedValue ?? l.value} ${l.normalizedUnit ?? l.unit} on ${new Date(l.drawDate).toLocaleDateString()}`).join(' → ')}`);
      if (meds.length) parts.push(`Meds: ${meds.slice(0,4).map((m:any)=> m.genericName || m.name).join(', ')}`);
      setVaultContext(parts.join(' | '));
    } catch { setVaultContext(''); }
  }, [patientId, marker, causalResult]);

  const handleExecute = async (customQuery?: string, targetMarker?: string) => {
    const text = customQuery !== undefined ? customQuery : queryText;
    const m = targetMarker || marker || 'eGFR';
    if (!text.trim() && !m) return;
    setIsLoading(true);
    setIsQuestionAdded(false);
    try {
      const context = {
        patientId,
        activeProfile: { userId: patientId, name: 'Patient', role: 'patient' as const, isProxy: false },
        vault: localVault,
        eventBus,
      };
      const res = await webMCPEngine.execute('correlate_meds', { biomarker: m, queryText: text, patientId }, context);
      if (res.success && res.data) {
        setCausalResult(res.data);
        setShowGrounding(true);
      }
    } catch (err: any) {
      console.error('[AskWhyPanel] error', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToQuestionBank = () => {
    if (!causalResult?.recommendedDoctorQuestion) return;
    const item: QuestionBankItem = {
      id: `qb_askwhy_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      patientId,
      questionText: causalResult.recommendedDoctorQuestion,
      category: 'lab_trend',
      sourceModule: 'labstory',
      originModule: 'labstory',
      linkedLabMarker: causalResult.biomarker || marker,
      priority: 'high',
      clinicalRationale: causalResult.causalStorySentence,
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    localVault.addQuestionBankItem(item);
    setIsQuestionAdded(true);
    eventBus.dispatchToast({
      type: 'success',
      title: 'Question added',
      message: `Added to your questions for the doctor.`,
    });
    eventBus.emit('question_bank', { action: 'add', item });
  };

  return (
    <div className={`bg-white border border-canvas-border rounded-2xl p-4 sm:p-5 shadow-sm space-y-4 ${className}`}>
      <div className="flex items-center gap-2.5 border-b border-canvas-border pb-3">
        <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 shrink-0">
          <HelpCircle className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-heading-md font-bold text-slate-900 tracking-tight">Ask why it changed</h3>
          <p className="text-body-sm text-muted leading-relaxed">Ask about a test and see what medicines may be linked. In plain English.</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <select
          value={marker}
          onChange={(e) => setMarker(e.target.value)}
          className="px-3 py-2.5 bg-canvas-muted border border-canvas-border rounded-xl text-sm text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 min-h-[44px] sm:w-[160px]"
          aria-label="Test name"
        >
          <option value="eGFR">Kidney (eGFR)</option>
          <option value="Creatinine">Creatinine</option>
          <option value="HbA1c">HbA1c</option>
          <option value="Glucose Fasting">Sugar (fasting)</option>
          <option value="Potassium">Potassium</option>
          <option value="LDL">LDL</option>
          <option value="Cholesterol Total">Cholesterol</option>
        </select>
        <div className="relative flex-1">
          <input
            type="text"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleExecute()}
            placeholder={`Ask why ${marker} changed...`}
            className="w-full bg-canvas-muted border border-canvas-border rounded-xl py-2.5 pl-3.5 pr-10 text-body-sm text-slate-900 placeholder:text-muted focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 min-h-[44px]"
            aria-label="Ask why"
          />
        </div>
        <button
          type="button"
          onClick={() => handleExecute()}
          disabled={isLoading || (!queryText.trim() && !marker)}
          className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-body-sm flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 min-h-[44px] shrink-0"
        >
          {isLoading ? <span className="inline-block animate-spin">⏳</span> : <Send className="w-4 h-4" />}
          <span>{isLoading ? 'Checking...' : 'Ask'}</span>
        </button>
      </div>

      <div className="border border-canvas-border rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowIdeas(!showIdeas)}
          className="w-full flex items-center justify-between px-4 py-3 bg-canvas-muted hover:bg-canvas-border text-left"
          aria-expanded={showIdeas}
        >
          <span className="text-xs font-bold text-slate-700 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-600" />
            Need ideas? (examples)
          </span>
          {showIdeas ? <ChevronDown className="w-4 h-4 text-muted" /> : <ChevronRight className="w-4 h-4 text-muted" />}
        </button>
        {showIdeas && (
          <div className="p-3 bg-white flex flex-wrap gap-2">
            {presetQueries.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setQueryText(p.query);
                  setMarker(p.marker);
                  handleExecute(p.query, p.marker);
                }}
                className="text-caption px-3 py-2 rounded-xl bg-canvas-muted hover:bg-muted-subtle text-slate-700 border border-canvas-border font-semibold min-h-[44px]"
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {causalResult && (
        <div className="bg-canvas-muted border border-amber-200 rounded-xl p-4 space-y-3 text-body-sm">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-600" />
            <span className="font-bold text-slate-900">{causalResult.biomarker}</span>
            <span className="text-caption px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-bold uppercase">{causalResult.trajectory?.replace(/_/g, ' ') || 'Checked'}</span>
          </div>
          <p className="text-slate-900 leading-relaxed font-medium">{causalResult.causalStorySentence}</p>
          {causalResult.correlatedMedications && causalResult.correlatedMedications.length > 0 && (
            <div className="bg-white border border-canvas-border rounded-xl p-2.5 flex items-center gap-2 flex-wrap">
              <span className="text-caption font-bold text-muted flex items-center gap-1">
                <Pill className="w-3.5 h-3.5 text-primary" />
                Linked medicines:
              </span>
              {causalResult.correlatedMedications.map((med: string, i: number) => (
                <span key={i} className="text-caption px-2.5 py-0.5 rounded-full bg-primary-light text-primary-text font-bold border border-primary-border">
                  {med}
                </span>
              ))}
            </div>
          )}
          {causalResult.recommendedDoctorQuestion && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-body-sm text-slate-900 italic flex-1">"{causalResult.recommendedDoctorQuestion}"</p>
              <button
                type="button"
                onClick={handleAddToQuestionBank}
                disabled={isQuestionAdded}
                className={`px-4 py-2.5 rounded-xl font-bold text-body-sm flex items-center justify-center gap-2 min-h-[44px] shrink-0 ${isQuestionAdded ? 'bg-emerald-600 text-white' : 'bg-amber-500 hover:bg-amber-600 text-white'}`}
              >
                {isQuestionAdded ? <><Check className="w-4 h-4" /> Added</> : <><Plus className="w-4 h-4" /> Add to questions</>}
              </button>
            </div>
          )}
          {/* Grounding toggle — intelligence AFTER extraction, web evidence */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowGrounding(v=>!v)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-amber-200 hover:bg-indigo-50 hover:border-indigo-200 text-sm font-bold text-slate-700 hover:text-indigo-700 transition-colors"
            >
              <Sparkles className="w-4 h-4 text-indigo-600" />
              {showGrounding ? 'Hide web grounding' : 'Show web grounding (what latest guidelines say) — Exa'}
              {showGrounding ? <ChevronDown className="w-4 h-4 text-muted" /> : <ChevronRight className="w-4 h-4 text-muted" />}
            </button>
          </div>
        </div>
      )}

      {showGrounding && causalResult && (
        <GroundedInsightsPanel
          patientId={patientId}
          initialQuery={`${causalResult.biomarker} ${causalResult.trajectory?.replace(/_/g,' ') || ''} — ${causalResult.recommendedDoctorQuestion || queryText || 'interpretation and next steps'} per latest guidelines`}
          contextFacts={vaultContext || `${causalResult.biomarker}: ${causalResult.trendMetrics?.endValue ?? ''} | ${causalResult.causalStorySentence}`}
          mode="lab"
        />
      )}
      {!causalResult && showGrounding && (
        <GroundedInsightsPanel
          patientId={patientId}
          initialQuery={queryText || `${marker} interpretation and guidelines`}
          contextFacts={vaultContext}
          mode="general"
        />
      )}
    </div>
  );
};
