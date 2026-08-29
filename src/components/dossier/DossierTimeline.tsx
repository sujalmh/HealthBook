import React, { useState } from 'react';
import {
  Clock,
  Activity,
  Pill,
  Calendar,
  AlertTriangle,
  FileText,
  Search,
  Filter,
  ExternalLink,
  ChevronRight,
  Pin,
  Sparkles,
  ArrowRight,
  UserCheck,
  ShieldAlert,
  HelpCircle,
  Eye
} from 'lucide-react';
import type { DossierTimelineItem, DossierTimelineCategory } from '@/types/dossier';

interface DossierTimelineProps {
  items: DossierTimelineItem[];
  onOpenSourceViewer: (item: DossierTimelineItem) => void;
  onSelectCategory?: (category: DossierTimelineCategory) => void;
}

export const DossierTimeline: React.FC<DossierTimelineProps> = ({
  items,
  onOpenSourceViewer,
  onSelectCategory
}) => {
  const [selectedCategory, setSelectedCategory] = useState<DossierTimelineCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const categories: { id: DossierTimelineCategory; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'all', label: 'All Events', icon: Clock },
    { id: 'labs', label: 'Labs & Biomarkers', icon: Activity },
    { id: 'meds', label: 'Medications', icon: Pill },
    { id: 'doctor_notes', label: 'Doctor Notes & Proposals', icon: Pin },
    { id: 'danger_signs', label: 'Danger Alerts', icon: AlertTriangle },
    { id: 'visits', label: 'Appointments & Due', icon: Calendar },
  ];

  // Filtering
  const filteredItems = items.filter((item) => {
    // Category match
    const categoryMatches =
      selectedCategory === 'all' ||
      item.category === selectedCategory ||
      (selectedCategory === 'doctor_notes' && (item.category === 'proposals' || item.doctorComment)) ||
      (selectedCategory === 'danger_signs' && item.category === 'danger_signs');

    if (!categoryMatches) return false;

    // Search query match
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.title?.toLowerCase().includes(q) ||
      item.description?.toLowerCase().includes(q) ||
      item.doctorName?.toLowerCase().includes(q) ||
      item.doctorComment?.toLowerCase().includes(q) ||
      item.sourceFileName?.toLowerCase().includes(q) ||
      item.snippetText?.toLowerCase().includes(q)
    );
  });

  const getCategoryIcon = (category: DossierTimelineCategory) => {
    switch (category) {
      case 'labs':
        return <Activity className="w-4 h-4 text-emerald-400" />;
      case 'meds':
        return <Pill className="w-4 h-4 text-sky-400" />;
      case 'danger_signs':
        return <AlertTriangle className="w-4 h-4 text-rose-400" />;
      case 'proposals':
      case 'doctor_notes':
        return <Pin className="w-4 h-4 text-amber-400" />;
      case 'visits':
        return <Calendar className="w-4 h-4 text-indigo-400" />;
      default:
        return <FileText className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Filter & Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Category Pill Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCategory(cat.id);
                  if (onSelectCategory) onSelectCategory(cat.id);
                }}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold transition-all whitespace-nowrap ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 border border-indigo-500/50'
                    : 'bg-slate-950/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search timeline & notes..."
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-9 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
      </div>

      {/* Timeline Stream Container */}
      <div className="relative border-l-2 border-slate-800 ml-4 sm:ml-6 pl-6 sm:pl-8 space-y-6">
        {filteredItems.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center text-slate-400 space-y-2">
            <Clock className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="font-semibold text-sm">No events found matching your filter criteria.</p>
            <button
              onClick={() => {
                setSelectedCategory('all');
                setSearchQuery('');
              }}
              className="text-xs text-sky-400 font-bold hover:underline"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          filteredItems.map((item, idx) => (
            <div
              key={item.id || idx}
              className="relative group transition-all"
            >
              {/* Timeline Bullet Anchor */}
              <div className="absolute -left-[35px] sm:-left-[43px] top-4 w-7 h-7 rounded-full bg-slate-950 border-2 border-slate-700 group-hover:border-indigo-500 flex items-center justify-center transition-colors shadow-md">
                {getCategoryIcon(item.category)}
              </div>

              {/* Event Card */}
              <div className="bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 shadow-lg space-y-3 transition-all">
                {/* Event Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-sky-400">
                      {new Date(item.date).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {item.statusBadge && (
                      <span className="px-2 py-0.2 rounded-full bg-slate-800 text-slate-300 font-mono font-bold text-[9px] uppercase border border-slate-700">
                        {item.statusBadge}
                      </span>
                    )}
                  </div>

                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 font-bold border border-indigo-500/20 uppercase tracking-wider self-start sm:self-auto">
                    {item.category.replace(/_/g, ' ')}
                  </span>
                </div>

                {/* Event Body */}
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-slate-100 tracking-tight">
                    {item.title}
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {item.description}
                  </p>

                  {/* Dosage Transition Widget if present */}
                  {item.dosageTransition && (
                    <div className="bg-slate-950 rounded-xl p-3 border border-slate-800/80 flex items-center gap-3 text-xs">
                      <span className="text-slate-400 font-semibold">{item.dosageTransition.medName}:</span>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono line-through font-bold">
                          {item.dosageTransition.previousDose}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold">
                          {item.dosageTransition.newDose}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Doctor Pinned Comment Box if present */}
                  {item.doctorComment && (
                    <div className="bg-amber-950/20 border border-amber-500/30 rounded-xl p-3 space-y-1">
                      <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold">
                        <Pin className="w-3.5 h-3.5" />
                        <span>Pinned Clinical Note by {item.doctorName || 'Attending Physician'}</span>
                      </div>
                      <p className="text-xs text-amber-200/90 italic font-serif leading-normal pl-5">
                        "{item.doctorComment}"
                      </p>
                    </div>
                  )}
                </div>

                {/* Document Source Citation Deep Link */}
                {item.sourceDocId && (
                  <div className="pt-2 border-t border-slate-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <FileText className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="truncate">
                        Source: <strong className="text-slate-300">{item.sourceFileName || `${item.sourceDocId}.pdf`}</strong>
                        {item.boundingBox && (
                          <span className="text-slate-500 font-mono ml-1.5">
                            [P.{item.boundingBox.pageIndex || 1} x:{item.boundingBox.x}, y:{item.boundingBox.y}]
                          </span>
                        )}
                      </span>
                    </div>

                    <button
                      onClick={() => onOpenSourceViewer(item)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 text-xs font-bold border border-sky-500/30 transition-all self-end sm:self-auto shrink-0"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Inspect PDF Bounding Box (CD3)</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
