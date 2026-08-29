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
    <div className="bg-slate-900 border border-slate-700/80 rounded-2xl p-6 shadow-2xl space-y-6 text-slate-200">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
            <HelpCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100">Doctor Question Bank</h2>
            <p className="text-xs text-slate-400">
              Aggregated questions from discharge reconciliation, lab anomalies, and dosage proposals.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Agenda
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Add New Question Form */}
      <form onSubmit={handleAddQuestion} className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
        <div className="text-xs font-semibold text-slate-300 flex items-center gap-2">
          <Plus className="w-3.5 h-3.5 text-sky-400" />
          Add Question for Next Doctor Visit
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="e.g. Can I take Tylenol instead of Advil for my knee pain given my kidney markers?"
            value={newQuestionText}
            onChange={(e) => setNewQuestionText(e.target.value)}
            className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
          />
          <select
            value={newPriority}
            onChange={(e) => setNewPriority(e.target.value as any)}
            className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none"
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
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-400">Filter by Module:</span>
          {['all', 'rxbridge', 'labstory', 'homelab', 'safety', 'vault'].map((mod) => (
            <button
              key={mod}
              onClick={() => setFilterModule(mod)}
              className={`px-2.5 py-1 rounded-md capitalize font-medium transition-colors ${
                filterModule === mod
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {mod}
            </button>
          ))}
        </div>
        <div className="text-slate-400 font-medium">
          {filteredQuestions.length} Questions ({filteredQuestions.filter((q) => q.status === 'discussed').length} Discussed)
        </div>
      </div>

      {/* Questions List */}
      <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
        {filteredQuestions.length === 0 ? (
          <div className="p-8 text-center bg-slate-950/40 rounded-xl border border-dashed border-slate-800 text-slate-500 text-xs">
            No questions recorded yet. Use the form above or trigger clinical tools (RxBridge, LabStory) to auto-generate questions.
          </div>
        ) : (
          filteredQuestions.map((q) => (
            <div
              key={q.id}
              className={`p-4 rounded-xl border transition-all ${
                q.status === 'discussed'
                  ? 'bg-slate-950/40 border-slate-800/80 opacity-60'
                  : 'bg-slate-800/60 border-slate-700/80 hover:border-slate-600'
              }`}
            >
              <div className="flex items-start gap-3 justify-between">
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => handleToggleStatus(q)}
                    className={`mt-0.5 p-1 rounded-md transition-colors ${
                      q.status === 'discussed' ? 'text-emerald-400 bg-emerald-950/50' : 'text-slate-500 hover:text-slate-300'
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
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {q.priority}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-700 text-slate-300 uppercase font-semibold">
                        {q.sourceModule}
                      </span>
                      {q.status === 'discussed' && (
                        <span className="text-[10px] text-emerald-400 font-semibold italic">✓ Discussed</span>
                      )}
                    </div>
                    <p className={`text-sm font-medium text-slate-100 ${q.status === 'discussed' ? 'line-through' : ''}`}>
                      {q.questionText}
                    </p>
                    {q.clinicalRationale && (
                      <p className="text-xs text-slate-400 leading-relaxed italic">{q.clinicalRationale}</p>
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
