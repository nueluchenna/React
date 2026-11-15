import React from 'react';
import { VocabFlashcard } from '../../types/flashcard';
import { Play, Download, Trash2, Volume2 } from 'lucide-react';
import { ttsService } from '../../services/ttsService';

interface DeckDashboardProps {
  allCards: VocabFlashcard[];
  dueCount: number;
  newCount: number;
  learningCount: number;
  reviewCount: number;
  onStartReview: () => void;
  onDeleteCard: (id?: number) => void;
}

export const DeckDashboard: React.FC<DeckDashboardProps> = ({
  allCards,
  dueCount,
  newCount,
  learningCount,
  reviewCount,
  onStartReview,
  onDeleteCard
}) => {
  const exportCSV = () => {
    if (!allCards.length) return;
    const rows = allCards.map(
      (c) =>
        `"${c.frontCloze.replace(/"/g, '""')}","${c.backAnswer.replace(/"/g, '""')}","${c.translatedSentence.replace(/"/g, '""')}"`
    );
    const csvContent = 'data:text/csv;charset=utf-8,' + rows.join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `TechVocab_Export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* FSRS Status Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white">FSRS Spaced Repetition Deck</h2>
            <p className="text-xs text-slate-400">
              Scheduled locally via Free Spaced Repetition Scheduler (ts-fsrs)
            </p>
          </div>

          {allCards.length > 0 && (
            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded-lg transition"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
            <span className="text-2xl font-extrabold text-blue-400">{newCount}</span>
            <p className="text-xs text-slate-400 mt-1">New</p>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
            <span className="text-2xl font-extrabold text-amber-400">{learningCount}</span>
            <p className="text-xs text-slate-400 mt-1">Learning</p>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
            <span className="text-2xl font-extrabold text-emerald-400">{reviewCount}</span>
            <p className="text-xs text-slate-400 mt-1">To Review</p>
          </div>
        </div>

        <button
          onClick={onStartReview}
          disabled={dueCount === 0}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold py-3 rounded-xl shadow transition"
        >
          <Play className="w-4 h-4 fill-current" />
          {dueCount > 0 ? `Study ${dueCount} Due Card${dueCount > 1 ? 's' : ''} Now` : 'All Caught Up for Now!'}
        </button>
      </div>

      {/* Saved Cards Browser */}
      {allCards.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1">
            All Saved Cards ({allCards.length})
          </h3>
          <div className="divide-y divide-slate-800 max-h-80 overflow-y-auto">
            {allCards.map((card) => (
              <div
                key={card.id}
                className="py-3 px-2 flex items-center justify-between gap-3 hover:bg-slate-950/50 rounded-lg"
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-white">{card.backAnswer}</p>
                  <p className="text-xs text-slate-400">{card.frontCloze}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => ttsService.speakGerman(card.originalSentence)}
                    className="p-2 text-slate-400 hover:text-blue-400 rounded-lg"
                    title="Play German sentence"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDeleteCard(card.id)}
                    className="p-2 text-slate-500 hover:text-rose-400 rounded-lg"
                    title="Delete card"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};