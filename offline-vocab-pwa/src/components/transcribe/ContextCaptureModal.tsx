import React, { useState, useEffect } from 'react';
import { ClozePayload } from '../../types/worker';
import { Volume2, Check, X, Loader2 } from 'lucide-react';
import { ttsService } from '../../services/ttsService';

interface ContextCaptureModalProps {
  isGenerating: boolean;
  pendingCloze: ClozePayload | null;
  onSaveCard: (payload: ClozePayload) => Promise<void>;
  onClose: () => void;
}

export const ContextCaptureModal: React.FC<ContextCaptureModalProps> = ({
  isGenerating,
  pendingCloze,
  onSaveCard,
  onClose
}) => {
  const [frontCloze, setFrontCloze] = useState('');
  const [backAnswer, setBackAnswer] = useState('');
  const [translatedSentence, setTranslatedSentence] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (pendingCloze) {
      setFrontCloze(pendingCloze.frontCloze);
      setBackAnswer(pendingCloze.backAnswer);
      setTranslatedSentence(pendingCloze.translatedSentence);
    }
  }, [pendingCloze]);

  if (!isGenerating && !pendingCloze) return null;

  const handleConfirmSave = async () => {
    if (!pendingCloze) return;
    setIsSaving(true);
    try {
      await onSaveCard({
        ...pendingCloze,
        frontCloze,
        backAnswer,
        translatedSentence
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white">
            {isGenerating ? 'Translating in Context...' : 'Create FSRS Cloze Flashcard'}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isGenerating ? (
          <div className="py-10 flex flex-col items-center justify-center gap-3 text-slate-300">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            <p className="text-sm">Running offline neural translation & Cloze builder...</p>
          </div>
        ) : (
          pendingCloze && (
            <div className="space-y-4">
              {/* Target Word & Audio */}
              <div className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div>
                  <span className="text-xs text-slate-400 uppercase">Selected Term</span>
                  <p className="text-lg font-bold text-blue-400">
                    {pendingCloze.targetWord}{' '}
                    <span className="text-slate-300 font-normal">
                      → {pendingCloze.translatedWord}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => ttsService.speakGerman(pendingCloze.targetWord)}
                  className="p-2.5 bg-blue-600/20 text-blue-300 hover:bg-blue-600 hover:text-white rounded-lg transition"
                  title="Pronounce word"
                >
                  <Volume2 className="w-5 h-5" />
                </button>
              </div>

              {/* Editable Front (Cloze) */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                  Front (German Cloze Context)
                </label>
                <input
                  type="text"
                  value={frontCloze}
                  onChange={(e) => setFrontCloze(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Editable Back */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                  Back (Word & Translation)
                </label>
                <input
                  type="text"
                  value={backAnswer}
                  onChange={(e) => setBackAnswer(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-emerald-300 font-medium focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Full Translated Sentence Reference */}
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                  Full English Context
                </label>
                <input
                  type="text"
                  value={translatedSentence}
                  onChange={(e) => setTranslatedSentence(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSave}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow transition"
                >
                  <Check className="w-4 h-4" />
                  Save to FSRS Deck
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
};