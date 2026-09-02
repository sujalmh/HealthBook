/**
 * GroundedInsightsPanel — Healthcare Grounding UI (intelligence AFTER extraction)
 * Shows web-grounded medical insights with citations, powered by Exa search.
 * - Highlights mode for token-efficient agent workflows
 * - Citations from official sources (CDC, NIH, PubMed, Mayo)
 * - Plain-language, not extraction — interpretation layer
 */

import React, { useState, useEffect } from 'react';
import { Search, ExternalLink, Sparkles, ShieldCheck, Loader2, AlertTriangle, BookOpen, RefreshCw } from 'lucide-react';
import { groundHealthQuestion, isHealthGroundingAvailable, type GroundedInsight } from '@/core/search/healthGrounding';
import { searchExa } from '@/core/search/exaClient';
import { getExaConfig, isExaEnabled } from '@/core/search/exaConfig';

interface Props {
  patientId: string;
  initialQuery?: string;
  contextFacts?: string; // e.g. "Creatinine 1.8 mg/dL, eGFR 32, on Lisinopril"
  mode?: 'lab' | 'med' | 'condition' | 'general';
  className?: string;
  autoSearch?: boolean;
}

export const GroundedInsightsPanel: React.FC<Props> = ({
  initialQuery = '',
  contextFacts = '',
  className = '',
  autoSearch = false,
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [fresh, setFresh] = useState(false); // maxAgeHours 0 toggle
  const [searchType, setSearchType] = useState<'auto' | 'fast' | 'instant'>('auto');
  const [isLoading, setIsLoading] = useState(false);
  const [insight, setInsight] = useState<GroundedInsight | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);

  useEffect(() => { setQuery(initialQuery || ''); }, [initialQuery]);

  useEffect(() => {
    isHealthGroundingAvailable().then(setIsAvailable);
  }, []);

  useEffect(() => {
    if (autoSearch && initialQuery && initialQuery.trim() && isAvailable) {
      handleSearch(initialQuery);
    }
  }, [autoSearch, initialQuery, isAvailable]);

  const handleSearch = async (qOverride?: string) => {
    const q = (qOverride ?? query).trim();
    if (!q) return;
    if (isAvailable === false) {
      setError('Exa grounding not configured — add EXA_API_KEY in .env or Settings → Exa Grounding. Extraction still works; this is the web intelligence layer on top.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setInsight(null);
    try {
      // AI search for accuracy — no hardcoded domains; systemPrompt guides to authoritative sources
      if (fresh) {
        const res = await searchExa({
          query: q + (contextFacts ? ` Context: ${contextFacts}` : ''),
          type: searchType,
          numResults: 5,
          contents: { highlights: true, maxAgeHours: 0 },
          systemPrompt: 'You are a medical evidence assistant. Prefer authoritative official sources (CDC, NIH, PubMed, Mayo, WHO, FDA) and recent guidelines. Avoid duplicates.',
        });
        setInsight({
          query: q,
          results: res.results.map(r => ({ title: r.title, url: r.url, highlights: r.highlights ?? [], publishedDate: r.publishedDate, favicon: r.favicon })),
          citations: res.results.map(r => ({ url: r.url, title: r.title })),
          requestId: res.requestId,
          queriedAt: new Date().toISOString(),
          costDollars: res.costDollars?.total,
        });
      } else {
        const grounded = await groundHealthQuestion(q, {
          contextFacts: contextFacts || undefined,
          numResults: 5,
          forceLivecrawl: false,
          type: searchType,
        });
        setInsight(grounded);
      }
    } catch (e: any) {
      const msg = e?.message || String(e);
      if (msg.includes('401') || msg.includes('not configured') || msg.includes('EXA_API_KEY')) {
        setError('Exa API key missing — set EXA_API_KEY in .env (server) or VITE_EXA_API_KEY in Settings. See .env.example Exa section. Extraction remains local; grounding requires key.');
      } else {
        setError(msg.slice(0, 600));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const cfg = (() => { try { return getExaConfig(); } catch { return null; } })();
  const showConfigNote = cfg && isExaEnabled(cfg) === false;

  const presetQueries = [
    { label: 'eGFR 32 → what does it mean?', q: 'eGFR 32 mL/min what does it mean, CKD stage, what to ask doctor, latest KDIGO guidelines' },
    { label: 'Creatinine 1.8 on Lisinopril', q: 'Creatinine 1.8 mg/dL on Lisinopril — should we monitor kidney function, when to recheck?' },
    { label: 'Atorvastatin + grapefruit', q: 'Atorvastatin 40mg grapefruit interaction — is occasional grapefruit safe, timing?' },
    { label: 'HbA1c 7.8% next steps', q: 'HbA1c 7.8% type 2 diabetes next steps per ADA 2025 guidelines' },
    { label: 'Potassium 4.8 + ACE inhibitor', q: 'Potassium 4.8 mEq/L on ACE inhibitor — monitoring and diet guidance' },
  ];

  return (
    <div className={`bg-white border border-canvas-border rounded-2xl shadow-sm overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-4 sm:px-5 py-3.5 border-b border-canvas-border bg-gradient-to-br from-indigo-50 to-white flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-1.5">
              Grounded Insights <span className="hidden sm:inline">— web evidence</span>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-bold uppercase tracking-wider">
                <ShieldCheck className="w-3 h-3" /> Exa
              </span>
            </h3>
            <p className="text-xs text-muted leading-snug hidden sm:block">After extraction: what it means + latest guidelines, with citations. Highlights for efficiency.</p>
            <p className="text-xs text-muted sm:hidden">What it means + citations (after extraction).</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${isAvailable ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : isAvailable === false ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-muted border-canvas-border'}`}>
            {isAvailable ? 'Grounding ready' : isAvailable === false ? 'Needs key' : 'Checking…'}
          </span>
        </div>
      </div>

      {/* Search bar */}
      <div className="p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Ask about a lab, med, or condition… e.g. 'Why is my eGFR 32 and what should I ask?'"
              className="w-full pl-9 pr-3 py-2.5 bg-canvas-muted border border-canvas-border rounded-xl text-sm text-slate-900 placeholder:text-muted focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/15 min-h-[44px]"
              aria-label="Grounded health question"
            />
          </div>
          <button
            onClick={() => handleSearch()}
            disabled={isLoading || !query.trim()}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-sm min-h-[44px] shrink-0"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {isLoading ? 'Searching…' : 'Ground'}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-muted cursor-pointer">
            <input type="checkbox" checked={fresh} onChange={(e) => setFresh(e.target.checked)} className="rounded border-canvas-border" />
            Fresh (livecrawl)
          </label>
          <span className="text-[11px] text-muted">cached=fast; fresh=livecrawl (maxAgeHours:0)</span>
          {fresh && <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-bold">maxAgeHours: 0</span>}
          <span className="ml-2 text-[11px] text-muted hidden sm:inline">• AI search</span>
          <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold">AI accuracy • no hardcoded domains</span>
          <select
            value={searchType}
            onChange={(e)=> setSearchType(e.target.value as any)}
            className="ml-auto px-2 py-1.5 bg-white border border-canvas-border rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-400 min-h-[32px]"
            aria-label="Search type"
            title="Exa search type: instant (~250ms), fast (~450ms), auto (~1s)"
          >
            <option value="auto">auto (~1s) balanced</option>
            <option value="fast">fast (~450ms)</option>
            <option value="instant">instant (~250ms)</option>
          </select>
        </div>

        {contextFacts && (
          <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl px-3 py-2 flex items-start gap-2">
            <BookOpen className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <p className="text-xs text-indigo-900 leading-relaxed"><span className="font-bold">Vault context grounded:</span> {contextFacts}</p>
          </div>
        )}

        {/* Presets */}
        <div className="flex flex-wrap gap-1.5">
          {presetQueries.map((p) => (
            <button
              key={p.label}
              onClick={() => { setQuery(p.q); handleSearch(p.q); }}
              disabled={isLoading}
              className="text-[11px] px-2.5 py-1.5 rounded-full bg-canvas-muted hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-canvas-border hover:border-indigo-200 font-semibold transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>

        {showConfigNote && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-900 leading-relaxed">
              Grounding disabled — set <span className="font-mono">EXA_API_KEY</span> in <span className="font-mono">.env</span> (server, private) or <span className="font-mono">VITE_EXA_API_KEY</span> in Settings. Current base <span className="font-mono">{cfg?.baseURL}</span>.
              Without a key, extraction still works fully; only the post-extraction web layer is paused.
            </p>
          </div>
        )}

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <p className="text-xs text-rose-900 leading-relaxed break-words">{error}</p>
          </div>
        )}

        {/* Results */}
        {insight && (
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-indigo-600" /> Grounded results • {insight.results.length} sources
                {insight.costDollars ? <span className="text-muted font-normal">• ${insight.costDollars.toFixed(4)}</span> : null}
              </span>
              <span className="text-[11px] text-muted font-mono hidden sm:inline">{insight.requestId?.slice(0,8)} • {new Date(insight.queriedAt).toLocaleTimeString()}</span>
            </div>

            {insight.summary && !insight.results.length && (
              <div className="bg-canvas-muted border border-canvas-border rounded-xl p-3 text-sm text-slate-800">{insight.summary}</div>
            )}

            {insight.results.length === 0 && !insight.summary && !error && (
              <div className="bg-canvas-muted border border-canvas-border rounded-xl p-4 text-center">
                <p className="text-sm text-muted">No grounded sources returned. Try rephrasing or toggling Fresh. Extraction layer remains authoritative.</p>
                <p className="text-xs text-muted mt-1">Query was: <span className="font-mono">{insight.query}</span></p>
              </div>
            )}

            <div className="space-y-2.5">
              {insight.results.map((r, i) => (
                <div key={`${r.url}-${i}`} className="bg-white border border-canvas-border rounded-xl p-3 hover:border-indigo-200 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-indigo-700 hover:text-indigo-900 hover:underline leading-snug flex-1">
                      {r.title || new URL(r.url).hostname}
                    </a>
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg bg-canvas-muted hover:bg-indigo-50 border border-canvas-border hover:border-indigo-200 text-muted hover:text-indigo-700 shrink-0" aria-label="Open source">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-muted font-mono break-all hover:text-indigo-600">{r.url}</a>
                  {r.publishedDate && <div className="text-[11px] text-muted mt-1">Published: {new Date(r.publishedDate).toLocaleDateString()}</div>}
                  {r.highlights && r.highlights.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {r.highlights.slice(0, 3).map((h, idx) => (
                        <li key={idx} className="text-xs text-slate-700 leading-relaxed bg-indigo-50/60 border border-indigo-100 rounded-lg px-2.5 py-1.5">
                          <span className="font-bold text-indigo-700">▸</span> {h}
                        </li>
                      ))}
                    </ul>
                  )}
                  {r.text && !r.highlights?.length && (
                    <p className="mt-2 text-xs text-slate-700 leading-relaxed bg-canvas-muted border border-canvas-border rounded-lg px-2.5 py-1.5 line-clamp-4">{r.text.slice(0, 500)}</p>
                  )}
                </div>
              ))}
            </div>

            {insight.citations.length > 0 && (
              <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3">
                <div className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" /> Citations ({insight.citations.length}) — grounding
                  {insight.confidence && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-white border border-emerald-200 text-emerald-700 text-[10px] uppercase">{insight.confidence} confidence</span>}
                </div>
                <ul className="mt-1.5 space-y-1">
                  {insight.citations.slice(0, 6).map((c, idx) => (
                    <li key={idx} className="text-xs text-emerald-900 truncate">
                      <span className="font-mono text-[11px]">{idx+1}.</span> <a href={c.url} target="_blank" rel="noopener noreferrer" className="hover:underline font-medium">{c.title || c.url}</a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center justify-center pt-1">
              <button onClick={() => handleSearch()} disabled={isLoading} className="text-xs px-3 py-2 rounded-xl bg-white border border-canvas-border hover:border-indigo-200 text-muted hover:text-indigo-700 font-semibold flex items-center gap-1.5">
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh grounding
              </button>
            </div>
          </div>
        )}

        {!insight && !isLoading && !error && (
          <p className="text-xs text-muted leading-relaxed bg-canvas-muted border border-dashed border-canvas-border rounded-xl px-3 py-2.5">
            Type a health question and press Ground — we query Exa with <span className="font-mono">contents.highlights: true</span> (token-efficient) and show cited excerpts. For deep research, highlights + text are combined. Fresh forces <span className="font-mono">maxAgeHours:0</span> livecrawl.
          </p>
        )}
      </div>
    </div>
  );
};
