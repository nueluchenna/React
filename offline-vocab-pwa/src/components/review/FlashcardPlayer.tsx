import React, { useState } from 'react';
import { Rating } from 'ts-fsrs';
import { VocabFlashcard, ReviewGrade } from '../../types/flashcard';
import { getNextIntervalPreviews } from '../../db/database';
import { ttsService } from '../../services/ttsService';
import { Volume2, Eye, ArrowLeft } from 'lucide-react';

interface FlashcardPlayerProps {
  dueCards: VocabFlashcard[];
  onGrade: (card: VocabFlashcard, grade: ReviewGrade) => Promise<void>;
  onExit: () => void;
}

export const FlashcardPlayer: React.FC<FlashcardPlayerProps> = ({
  dueCards,
  onGrade,
  onExit
}) => {
  const [isBackShown, setIsBackShown] = useState(false);

  if (dueCards.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-4">
        <p className="text-lg font-bold text-emerald-400">Session Complete!</p>
        <p className="text-sm text-slate-400">You have reviewed all due cards for right now.</p>
        <button
          onClick={onExit}
          className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const currentCard = dueCards[0];
  const intervals = getNextIntervalPreviews(currentCard);

  const handleSelectGrade = async (grade: ReviewGrade) => {
    setIsBackShown(false);
    await onGrade(currentCard, grade);
  };

  const handleReveal = () => {
    setIsBackShown(true);
    ttsService.speakGerman(currentCard.originalSentence);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={onExit}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          Exit Session
        </button>
        <span className="text-xs font-mono text-slate-400">
          Remaining Due: {dueCards.length}
        </span>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 min-h-[280px] flex flex-col justify-between shadow-xl">
        {/* Card Prompt (Cloze) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider font-semibold text-blue-400">
              Cloze Context
            </span>
            <button
              onClick={() => ttsService.speakGerman(currentCard.originalSentence)}
              className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white px-2.5 py-1.5 rounded-lg transition"
            >
              <Volume2 className="w-4 h-4" />
              Speak Sentence
            </button>
          </div>

          <p className="text-xl font-medium text-white leading-relaxed py-4">
            {currentCard.frontCloze}
          </p>
        </div>

        {/* Back Answer Section */}
        {isBackShown ? (
          <div className="border-t border-slate-800 pt-4 space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-bold text-emerald-400">{currentCard.backAnswer}</p>
                <p className="text-xs text-slate-300 mt-1">{currentCard.originalSentence}</p>
                <p className="text-xs text-slate-400 italic">{currentCard.translatedSentence}</p>
              </div>
              <button
                onClick={() => ttsService.speakGerman(currentCard.targetWord)}
                className="p-2.5 bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600 hover:text-white rounded-lg transition"
                title="Pronounce target word"
              >
                <Volume2 className="w-5 h-5" />
              </button>
            </div>

            {/* 4 FSRS Rating Buttons */}
            <div className="grid grid-cols-4 gap-2 pt-2">
              <button
                onClick={() => handleSelectGrade(Rating.Again)}
                className="flex flex-col items-center py-2.5 px-2 rounded-xl bg-rose-950/70 hover:bg-rose-600 border border-rose-800 text-rose-200 hover:text-white transition"
              >
                <span className="text-xs font-mono opacity-80">{intervals[Rating.Again]}</span>
                <span className="text-sm font-bold">Again</span>
              </button>

              <button
                onClick={() => handleSelectGrade(Rating.Hard)}
                className="flex flex-col items-center py-2.5 px-2 rounded-xl bg-amber-950/70 hover:bg-amber-600 border border-amber-800 text-amber-200 hover:text-white transition"
              >
                <span className="text-xs font-mono opacity-80">{intervals[Rating.Hard]}</span>
                <span className="text-sm font-bold">Hard</span>
              </button>

              <button
                onClick={() => handleSelectGrade(Rating.Good)}
                className="flex flex-col items-center py-2.5 px-2 rounded-xl bg-emerald-950/70 hover:bg-emerald-600 border border-emerald-800 text-emerald-200 hover:text-white transition"
              >
                <span className="text-xs font-mono opacity-80">{intervals[Rating.Good]}</span>
                <span className="text-sm font-bold">Good</span>
              </button>

              <button
                onClick={() => handleSelectGrade(Rating.Easy)}
                className="flex flex-col items-center py-2.5 px-2 rounded-xl bg-blue-950/70 hover:bg-blue-600 border border-blue-800 text-blue-200 hover:text-white transition"
              >
                <span className="text-xs font-mono opacity-80">{intervals[Rating.Easy]}</span>
                <span className="text-sm font-bold">Easy</span>
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={handleReveal}
            className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold py-3 rounded-xl transition"
          >
            <Eye className="w-4 h-4" />
            Show Answer
          </button>
        )}
      </div>
    </div>
  );
};