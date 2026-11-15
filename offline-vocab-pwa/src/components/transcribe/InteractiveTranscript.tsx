import React from 'react';
import { TranscriptSegment } from '../../types/flashcard';
import { Volume2, Sparkles, Radio } from 'lucide-react';
import { ttsService } from '../../services/ttsService';

interface InteractiveTranscriptProps {
  segments: TranscriptSegment[];
  interimText?: string;
  onWordSelect: (word: string, sentence: string) => void;
}

export const InteractiveTranscript: React.FC<InteractiveTranscriptProps> = ({
  segments,
  interimText,
  onWordSelect
}) => {
  if (segments.length === 0 && !interimText) {
    return (
      <div className="bg-slate-900/50 border border-dashed border-slate-800 rounded-xl p-10 text-center space-y-2">
        <Sparkles className="w-8 h-8 text-slate-600 mx-auto" />
        <p className="text-slate-300 font-medium">No live transcript yet</p>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Tap <strong>Start Live Transcribe</strong> during your lecture or paste a German technical
          sentence above. Click any unfamiliar word to translate it in context and create an FSRS
          Cloze flashcard.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg space-y-4 max-h-[60vh] overflow-y-auto">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
          Interactive Transcript (Tap any word to capture)
        </span>
      </div>

      <div className="space-y-3">
        {segments.map((segment) => (
          <div key={segment.chunkId} className="space-y-2">
            {segment.sentences.map((sentence) => (
              <div
                key={sentence.sentenceId}
                className="group flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition"
              >
                <button
                  type="button"
                  onClick={() => ttsService.speakGerman(sentence.rawText)}
                  title="Listen to sentence in German"
                  className="mt-1 p-1.5 rounded-md bg-slate-800 text-slate-300 hover:text-white hover:bg-blue-600 transition shrink-0"
                >
                  <Volume2 className="w-4 h-4" />
                </button>

                <p className="text-base leading-relaxed text-slate-100 flex flex-wrap gap-x-1.5 gap-y-1">
                  {sentence.words.map((word, idx) => (
                    <span
                      key={`${sentence.sentenceId}-w-${idx}`}
                      onClick={() => onWordSelect(word, sentence.rawText)}
                      className="cursor-pointer px-1.5 py-0.5 rounded hover:bg-blue-600/30 hover:text-blue-200 active:bg-blue-600 active:text-white transition select-none border border-transparent hover:border-blue-500/40"
                    >
                      {word}
                    </span>
                  ))}
                </p>
              </div>
            ))}
          </div>
        ))}

        {/* Live streaming interim speech preview */}
        {interimText && (
          <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-blue-950/30 border border-blue-800/50 text-blue-200 animate-pulse">
            <Radio className="w-4 h-4 text-blue-400 shrink-0" />
            <p className="text-sm italic">{interimText} ...</p>
          </div>
        )}
      </div>
    </div>
  );
};
