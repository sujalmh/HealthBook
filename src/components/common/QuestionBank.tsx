import React, { useState, useEffect } from 'react';
import { HelpCircle, Plus, CheckCircle, Printer, Filter } from 'lucide-react';
import { QuestionBankItem } from '@/types/vault';
import { localVault } from '@/core/vault/LocalVault';
import { eventBus } from '@/core/events/eventBus';

export const QuestionBank: React.FC<{ patientId?: string; onClose?: () => void }> = ({
  patientId = 'patient-s-devi',
  onClose,
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
    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xl space-y-6 text-slate-800">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/10 border border-amber-200 rounded-xl text-amber-400">
            <HelpCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Doctor Question Bank</h2>
            <p className="text-xs text-slate-600">
              Aggregated questions from discharge reconciliation, lab anomalies, and dosage proposals.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-100 text-slate-800 text-xs font-medium border border-slate-200 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Agenda
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-slate-800 transition-colors"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Add New Question Form */}
      <form onSubmit={handleAddQuestion} className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
        <div className="text-xs font-semibold text-slate-700 flex items-center gap-2">
          <Plus className="w-3.5 h-3.5 text-sky-400" />
          Add Question for Next Doctor Visit
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="e.g. Can I take Tylenol instead of Advil for my knee pain given my kidney markers?"
            value={newQuestionText}
            onChange={(e) => setNewQuestionText(e.target.value)}
            className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-600 focus:border-sky-500 focus:outline-none"
          />
          <select
            value={newPriority}
            onChange={(e) => setNewPriority(e.target.value as any)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none"
          >
            <option value="urgent">🔴 Urgent</option>
            <option value="high">🟡 High</option>
            <option value="routine">🟢 Routine</option>
          </select>
          <button
            type="submit"
            className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold shrink-0 transition-colors shadow"
          >
            Add Question
          </button>
        </div>
      </form>

      {/* Filter Toolbar */}
      <div className="flex items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-600" />
          <span className="text-slate-600">Filter by Module:</span>
          {['all', 'rxbridge', 'labstory', 'homelab', 'safety', 'vault'].map((mod) => (
            <button
              key={mod}
              onClick={() => setFilterModule(mod)}
              className={`px-2.5 py-1 rounded-md capitalize font-medium transition-colors ${
                filterModule === mod
                  ? 'bg-sky-500/20 text-sky-700 border border-sky-500/40'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {mod}
            </button>
          ))}
        </div>
        <div className="text-slate-600 font-medium">
          {filteredQuestions.length} Questions ({filteredQuestions.filter((q) => q.status === 'discussed').length} Discussed)
        </div>
      </div>

      {/* Questions List */}
      <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
        {filteredQuestions.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mx-auto">
              <HelpCircle className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-slate-700">No questions yet</p>
            <p className="text-xs text-slate-600">Add one above for your next visit — we'll keep it safe here.</p>
          </div>
        ) : (
          filteredQuestions.map((q) => (
            <div
              key={q.id}
              className={`p-4 rounded-xl border transition-all ${
                q.status === 'discussed'
                  ? 'bg-slate-50 border-slate-200 opacity-60'
                  : 'bg-slate-100 border-slate-200/80 hover:border-slate-600'
              }`}
            >
              <div className="flex items-start gap-3 justify-between">
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => handleToggleStatus(q)}
                    className={`mt-0.5 p-1 rounded-md transition-colors ${
                      q.status === 'discussed' ? 'text-emerald-400 bg-emerald-950/50' : 'text-slate-600 hover:text-slate-700'
                    }`}
                    title={q.status === 'discussed' ? 'Mark as active' : 'Mark as discussed with doctor'}
                  >
                    <CheckCircle className="w-5 h-5" />
                  </button>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                          q.priority === 'urgent'
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : q.priority === 'high'
                            ? 'bg-amber-500/20 text-amber-700 border border-amber-200'
                            : 'bg-emerald-500/20 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {q.priority}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-700 text-slate-700 uppercase font-semibold">
                        {q.sourceModule}
                      </span>
                      {q.status === 'discussed' && (
                        <span className="text-[10px] text-emerald-400 font-semibold italic">✓ Discussed</span>
                      )}
                    </div>
                    <p className={`text-sm font-medium text-slate-900 ${q.status === 'discussed' ? 'line-through' : ''}`}>
                      {q.questionText}
                    </p>
                    {q.clinicalRationale && (
                      <p className="text-xs text-slate-600 leading-relaxed italic">{q.clinicalRationale}</p>
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
