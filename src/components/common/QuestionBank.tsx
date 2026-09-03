import React, { useState, useEffect } from 'react';
import { HelpCircle, Plus, CheckCircle, Printer, Filter } from 'lucide-react';
import { QuestionBankItem } from '@/types/vault';
import { localVault } from '@/core/vault/LocalVault';
import { eventBus } from '@/core/events/eventBus';

export const QuestionBank: React.FC<{ patientId?: string; onClose?: () => void; asPage?: boolean }> = ({
  patientId = '',
  onClose,
  asPage = false,
}) => {
  const [questions, setQuestions] = useState<QuestionBankItem[]>([]);
  const [filterModule, setFilterModule] = useState<string>('all');
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newCategory, setNewCategory] = useState<QuestionBankItem['category']>('medication_clarification');
  const [newPriority, setNewPriority] = useState<'urgent' | 'high' | 'routine'>('high');

  const loadQuestions = async () => {
    const items = await localVault.getQuestionBankItems(patientId);
    setQuestions(items);
  };

  useEffect(() => {
    loadQuestions();
    const u1 = eventBus.on('question_bank', loadQuestions);
    const u2 = eventBus.on('rerender_question_bank', loadQuestions);
    return () => {
      u1();
      u2();
    };
  }, [patientId]);

  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestionText.trim()) return;

    const newItem: QuestionBankItem = {
      id: `qb-custom-${Date.now()}`,
      patientId,
      sourceModule: 'vault',
      category: newCategory,
      questionText: newQuestionText.trim(),
      clinicalRationale: 'Patient-authored pre-visit question.',
      priority: newPriority,
      status: 'active',
      includedInExport: true,
      createdAt: new Date().toISOString(),
    };

    await localVault.addQuestionBankItem(newItem);
    setNewQuestionText('');
    await loadQuestions();
    eventBus.dispatchToast({
      type: 'success',
      title: 'Question Added',
      message: 'Added question to your visit agenda.',
    });
  };

  const handleToggleStatus = async (item: QuestionBankItem) => {
    const nextStatus = item.status === 'active' ? 'discussed' : 'active';
    await localVault.updateQuestionBankStatus(item.id, nextStatus);
    await loadQuestions();
  };

  const filteredQuestions = questions.filter((q) => {
    if (filterModule !== 'all' && q.sourceModule !== filterModule) return false;
    return true;
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className={`bg-white border border-canvas-border rounded-2xl p-3 sm:p-6 space-y-5 sm:space-y-6 text-slate-800 ${asPage ? 'shadow-sm' : 'shadow-2xl max-h-[90vh] overflow-y-auto'}`}>
      <div className="flex items-center justify-between gap-3 border-b border-canvas-border pb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 bg-amber-500/10 border border-amber-200 rounded-xl text-amber-600 shrink-0">
            <HelpCircle className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h2 className="text-heading-lg text-slate-900">Questions for your doctor</h2>
            <p className="text-xs text-muted leading-snug">
              Add questions you want to ask your doctor. They will be ready for your next visit.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handlePrint}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-canvas-muted hover:bg-canvas-border text-slate-700 text-xs font-medium border border-canvas-border transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 min-h-[44px]"
            aria-label="Print agenda"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Agenda
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-canvas-muted text-muted hover:text-slate-800 transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Close question bank"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {}
      <form onSubmit={handleAddQuestion} className="bg-canvas-muted p-3 sm:p-4 rounded-xl border border-canvas-border space-y-3 shadow-sm">
        <div className="text-xs font-semibold text-slate-700 flex items-center gap-2">
          <Plus className="w-3.5 h-3.5 text-sky-600" />
          Add Question for Next Doctor Visit
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            placeholder="e.g. Can I take Tylenol instead of Advil for my knee pain given my kidney markers?"
            value={newQuestionText}
            onChange={(e) => setNewQuestionText(e.target.value)}
            className="flex-1 px-3 py-2.5 bg-white border border-canvas-border rounded-xl text-sm text-slate-900 placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[44px]"
          />
          <select
            value={newPriority}
            onChange={(e) => setNewPriority(e.target.value as unknown as typeof newPriority)}
            className="px-3 py-2 bg-white border border-canvas-border rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[44px] sm:w-auto w-full"
            aria-label="Question priority"
          >
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="routine">Routine</option>
          </select>
          <button
            type="submit"
            className="px-4 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-semibold shrink-0 transition-colors shadow focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 min-h-[44px]"
          >
            Add Question
          </button>
        </div>
      </form>

      {}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 max-w-full overflow-hidden">
          <Filter className="w-3.5 h-3.5 text-muted shrink-0" />
          <span className="text-muted whitespace-nowrap shrink-0">Filter by Module:</span>
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none max-w-full pb-1">
            {['all', 'rxbridge', 'labstory', 'homelab', 'safety', 'vault'].map((mod) => (
              <button
                key={mod}
                onClick={() => setFilterModule(mod)}
                className={`px-3 py-1.5 rounded-lg capitalize font-medium transition-colors whitespace-nowrap min-h-[36px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
                  filterModule === mod
                    ? 'bg-primary-light text-primary-text border border-primary-border shadow-sm'
                    : 'bg-canvas-muted text-muted hover:bg-canvas-border border border-transparent'
                }`}
              >
                {mod}
              </button>
            ))}
          </div>
        </div>
        <div className="text-muted font-medium whitespace-nowrap">
          {filteredQuestions.length} Questions ({filteredQuestions.filter((q) => q.status === 'discussed').length} Discussed)
        </div>
      </div>

      {}
      <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
        {filteredQuestions.length === 0 ? (
          <div className="p-8 text-center bg-canvas-muted rounded-xl border border-dashed border-canvas-border space-y-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto">
              <HelpCircle className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-slate-700">No questions yet</p>
            <p className="text-xs text-muted">Add one above for your next visit.</p>
          </div>
        ) : (
          filteredQuestions.map((q) => (
            <div
              key={q.id}
              className={`p-4 rounded-xl border transition-all shadow-sm ${
                q.status === 'discussed'
                  ? 'bg-canvas-muted border-canvas-border opacity-60'
                  : 'bg-white border-canvas-border hover:border-primary-border hover:shadow-md'
              }`}
            >
              <div className="flex items-start gap-3 justify-between">
                <div className="flex items-start gap-3 min-w-0">
                  <button
                    onClick={() => handleToggleStatus(q)}
                    className={`mt-0.5 p-1.5 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center ${
                      q.status === 'discussed' ? 'text-emerald-600 bg-emerald-50 border border-emerald-200' : 'text-muted hover:text-slate-700 hover:bg-canvas-muted'
                    }`}
                    title={q.status === 'discussed' ? 'Mark as active' : 'Mark as discussed with doctor'}
                    aria-label={q.status === 'discussed' ? 'Mark as active' : 'Mark as discussed'}
                  >
                    <CheckCircle className="w-5 h-5" />
                  </button>
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-caption px-2 py-0.5 rounded font-bold uppercase tracking-wider border ${
                          q.priority === 'urgent'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : q.priority === 'high'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        {q.priority}
                      </span>
                      <span className="text-caption px-2 py-0.5 rounded bg-canvas-muted text-muted uppercase font-semibold border border-canvas-border">
                        {q.sourceModule}
                      </span>
                      {q.status === 'discussed' && (
                        <span className="text-caption text-emerald-600 font-semibold italic">✓ Discussed</span>
                      )}
                    </div>
                    <p className={`text-sm font-medium text-slate-900 ${q.status === 'discussed' ? 'line-through' : ''}`}>
                      {q.questionText}
                    </p>
                    {q.clinicalRationale && (
                      <p className="text-xs text-muted leading-relaxed italic">{q.clinicalRationale}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

