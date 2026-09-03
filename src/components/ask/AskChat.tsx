/**
 * AskChat — unified Ask experience (replaces AskWhyPanel + GroundedInsightsPanel + QuestionBank stack).
 *
 * One simple chatbot: type a question, get a plain-English answer grounded in
 * your own records + trusted web sources, save it for your doctor visit.
 * No marker dropdowns, no suggestion chips, no jargon pills, no filter toolbars.
 */
import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader2, Check, Printer, BookmarkPlus } from 'lucide-react';
import { webMCPEngine } from '@/core/webmcp/WebMCPEngine';
import { localVault } from '@/core/vault/LocalVault';
import { eventBus } from '@/core/events/eventBus';
import { groundHealthQuestion, type GroundedInsight } from '@/core/search/healthGrounding';
import type { QuestionBankItem } from '@/types/vault';

interface AskChatProps {
  patientId: string;
  initialQuery?: string;
  className?: string;
}

interface ChatSource {
  title: string;
  url: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  linkedMeds?: string[];
  sources?: ChatSource[];
  doctorQuestion?: string;
  saved?: boolean;
}

/** Guess a biomarker from free text so correlate_meds gets a usable target. */
function inferBiomarker(query: string): string {
  const q = query.toLowerCase();
  if (q.includes('creatinine')) return 'Creatinine';
  if (q.includes('egfr') || q.includes('kidney') || q.includes('gfr')) return 'eGFR';
  if (q.includes('a1c') || q.includes('hba1c')) return 'HbA1c';
  if (q.includes('sugar') || q.includes('glucose')) return 'Glucose Fasting';
  if (q.includes('potassium') || q.includes('k+')) return 'Potassium';
  if (q.includes('cholesterol')) return 'Cholesterol Total';
  if (q.includes('ldl')) return 'LDL';
  if (q.includes('tsh') || q.includes('thyroid')) return 'TSH';
  return 'eGFR';
}

function vaultContextFor(patientId: string): string {
  try {
    const meds = localVault.getMedications(patientId) || [];
    const labs = localVault.getLabs(patientId) || [];
    const last = labs.length ? labs[labs.length - 1] : null;
    const parts: string[] = [];
    if (last) parts.push(`${(last as { marker?: string }).marker ?? 'Lab'} ${(last as { normalizedValue?: unknown }).normalizedValue ?? (last as { value?: unknown }).value}`);
    if (meds.length) parts.push(`Meds: ${meds.slice(0, 3).map((m) => (m as { genericName?: string; name?: string }).genericName || (m as { name?: string }).name).join(', ')}`);
    return parts.join(' | ');
  } catch {
    return '';
  }
}

export const AskChat: React.FC<AskChatProps> = ({ patientId, initialQuery, className = '' }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [questions, setQuestions] = useState<QuestionBankItem[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const autoSentRef = useRef(false);

  const loadQuestions = () => {
    try {
      const items = localVault.getQuestionBankItems(patientId) || [];
      setQuestions(items.filter((q) => q.status !== 'dismissed'));
    } catch {
      setQuestions([]);
    }
  };

  useEffect(() => {
    loadQuestions();
    const off = eventBus.on('question_bank', loadQuestions as (p: unknown) => void);
    return () => off();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, isLoading]);

  // Deep-link from LabStory ("Ask why eGFR changed") auto-sends once.
  useEffect(() => {
    if (initialQuery && initialQuery.trim() && !autoSentRef.current) {
      autoSentRef.current = true;
      void send(initialQuery.trim());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  useEffect(() => {
    const off = eventBus.on('navigate_ask', (payload: unknown) => {
      const obj = payload as { query?: string; marker?: string };
      const q = obj?.query || (obj?.marker ? `Why did my ${obj.marker} change?` : '');
      if (q.trim()) void send(q.trim());
    });
    return () => off();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  const send = async (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || isLoading) return;
    setInput('');
    const userMsg: ChatMessage = { id: `u_${Date.now()}`, role: 'user', text };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    try {
      const context = {
        patientId,
        activeProfile: { userId: patientId, name: 'Patient', role: 'patient' as const, isProxy: false },
        vault: localVault,
        eventBus,
      };
      const [corr, grounded] = await Promise.all([
        webMCPEngine
          .execute('correlate_meds', { biomarker: inferBiomarker(text), queryText: text, patientId }, context)
          .catch(() => null),
        groundHealthQuestion(text, { contextFacts: vaultContextFor(patientId) || undefined, numResults: 3 }).catch(
          (): GroundedInsight | null => null,
        ),
      ]);

      const data = (corr as { success?: boolean; data?: unknown } | null)?.success
        ? ((corr as { data?: Record<string, unknown> }).data as Record<string, unknown>)
        : null;
      const story = typeof data?.causalStorySentence === 'string' ? (data.causalStorySentence as string) : '';
      const meds = Array.isArray(data?.correlatedMedications) ? (data.correlatedMedications as string[]) : [];
      const doctorQuestion =
        typeof data?.recommendedDoctorQuestion === 'string' && (data.recommendedDoctorQuestion as string).trim()
          ? ((data.recommendedDoctorQuestion as string).trim() as string)
          : text;

      const highlights: string[] = [];
      const sources: ChatSource[] = [];
      if (grounded && grounded.results.length > 0) {
        for (const r of grounded.results.slice(0, 2)) {
          const h = r.highlights?.[0]?.replace(/\s*\.\.\.\s*/g, ' ').trim();
          if (h) highlights.push(h.length > 280 ? `${h.slice(0, 280).trimEnd()}…` : h);
          sources.push({ title: r.title || r.url, url: r.url });
        }
      }

      const parts: string[] = [];
      if (story) parts.push(story);
      if (meds.length) parts.push(`This may be linked to: ${meds.slice(0, 4).join(', ')}.`);
      if (highlights.length) parts.push(highlights.join(' '));
      if (!parts.length) parts.push('I could not find a clear link in your records. Consider asking your doctor about this at your next visit.');

      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: 'assistant',
          text: parts.join('\n\n'),
          linkedMeds: undefined,
          sources: sources.length ? sources : undefined,
          doctorQuestion,
          saved: false,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `a_${Date.now()}`, role: 'assistant', text: 'Something went wrong. Please try again.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const saveForDoctor = async (msg: ChatMessage) => {
    if (msg.saved) return;
    const item: QuestionBankItem = {
      id: `qb_ask_${Date.now()}`,
      patientId,
      questionText: msg.doctorQuestion || msg.text.slice(0, 200),
      category: 'general',
      sourceModule: 'patient_custom',
      priority: 'routine',
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    try {
      await localVault.addQuestionBankItem(item);
    } catch (e: unknown) {
      eventBus.dispatchToast({ type: 'error', title: 'Save failed', message: e instanceof Error ? e.message : 'Server save failed. Please retry.' });
      return;
    }
    setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, saved: true } : m)));
    loadQuestions();
    eventBus.emit('question_bank', { action: 'add' });
    eventBus.dispatchToast({ type: 'success', title: 'Saved', message: 'Added to your questions for the doctor.' });
  };

  const toggleDone = async (q: QuestionBankItem) => {
    await localVault.updateQuestionBankStatus(q.id, q.status === 'discussed' ? 'active' : 'discussed');
    loadQuestions();
    eventBus.emit('question_bank', { action: 'toggle' });
  };

  const remove = async (q: QuestionBankItem) => {
    await localVault.updateQuestionBankStatus(q.id, 'dismissed');
    loadQuestions();
    eventBus.emit('question_bank', { action: 'remove' });
  };

  const activeQuestions = questions.filter((q) => q.status === 'active');

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Chat */}
      <div className="bg-white border border-canvas-border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-canvas-border">
          <h3 className="text-sm font-bold text-slate-900">Ask about your health</h3>
        </div>
        <div className="px-4 py-4 space-y-3 max-h-[50vh] overflow-y-auto" aria-live="polite">
          {messages.length === 0 && (
            <p className="text-sm text-muted leading-relaxed">
              Ask about a test, medicine, or symptom — answers use your records plus trusted medical sources.
            </p>
          )}
          {messages.map((m) =>
            m.role === 'user' ? (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[85%] bg-teal-700 text-white text-sm leading-relaxed rounded-2xl rounded-br-md px-3.5 py-2.5">
                  {m.text}
                </div>
              </div>
            ) : (
              <div key={m.id} className="flex justify-start">
                <div className="max-w-[92%] bg-canvas-muted border border-canvas-border rounded-2xl rounded-bl-md px-3.5 py-3 space-y-2">
                  <p className="text-sm text-slate-900 leading-relaxed whitespace-pre-line">{m.text}</p>
                  {m.sources && m.sources.length > 0 && (
                    <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
                      {m.sources.map((s, i) => (
                        <a
                          key={`${s.url}-${i}`}
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-teal-800 underline underline-offset-2"
                        >
                          [{i + 1}] {s.title.length > 42 ? `${s.title.slice(0, 42)}…` : s.title}
                        </a>
                      ))}
                    </div>
                  )}
                  {m.doctorQuestion && (
                    <button
                      type="button"
                      onClick={() => saveForDoctor(m)}
                      disabled={m.saved}
                      className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl min-h-[40px] transition-colors ${
                        m.saved ? 'bg-emerald-100 text-emerald-800' : 'bg-white border border-canvas-border text-slate-700 hover:border-teal-300'
                      }`}
                    >
                      {m.saved ? <Check className="w-3.5 h-3.5" /> : <BookmarkPlus className="w-3.5 h-3.5" />}
                      {m.saved ? 'Saved for your visit' : 'Save for doctor visit'}
                    </button>
                  )}
                </div>
              </div>
            ),
          )}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-canvas-muted border border-canvas-border rounded-2xl rounded-bl-md px-3.5 py-3 flex items-center gap-2 text-sm text-muted">
                <Loader2 className="w-4 h-4 animate-spin" /> Checking your records…
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        <div className="px-3 py-3 border-t border-canvas-border flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void send()}
            placeholder="Ask about a test, medicine, or symptom…"
            aria-label="Ask a health question"
            className="flex-1 px-3.5 py-2.5 bg-canvas-muted border border-canvas-border rounded-xl text-sm text-slate-900 placeholder:text-muted focus:outline-none focus:border-teal-600 min-h-[44px]"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={isLoading || !input.trim()}
            aria-label="Send question"
            className="w-11 h-11 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-40 text-white flex items-center justify-center shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Your questions */}
      <div className="bg-white border border-canvas-border rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-canvas-border flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-900">
            Your questions {activeQuestions.length > 0 && <span className="text-muted font-semibold">({activeQuestions.length})</span>}
          </h3>
          {questions.length > 0 && (
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 px-2.5 py-2 rounded-lg min-h-[40px]"
            >
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
          )}
        </div>
        <div className="px-4 py-3">
          {questions.length === 0 ? (
            <p className="text-sm text-muted">Nothing saved yet. Answers you save will appear here for your next visit.</p>
          ) : (
            <ul className="divide-y divide-canvas-border">
              {questions.map((q) => (
                <li key={q.id} className="py-2.5 flex items-start gap-2.5">
                  <button
                    type="button"
                    onClick={() => void toggleDone(q)}
                    aria-label={q.status === 'discussed' ? 'Mark as not discussed' : 'Mark as discussed'}
                    className={`mt-0.5 w-6 h-6 rounded-full border flex items-center justify-center shrink-0 ${
                      q.status === 'discussed' ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-canvas-border text-transparent'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <p className={`flex-1 text-sm leading-relaxed ${q.status === 'discussed' ? 'text-muted line-through' : 'text-slate-900'}`}>
                    {q.questionText}
                  </p>
                  <button
                    type="button"
                    onClick={() => void remove(q)}
                    aria-label="Remove question"
                    className="text-muted hover:text-rose-600 text-lg leading-none px-2 py-1 min-h-[40px]"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
