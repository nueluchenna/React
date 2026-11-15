import React from 'react';
import { Mic, BookOpen, CheckCircle2, Loader2 } from 'lucide-react';

interface HeaderProps {
  activeView: 'transcribe' | 'review';
  setActiveView: (view: 'transcribe' | 'review') => void;
  isModelsReady: boolean;
  isTranslatorReady?: boolean;
  isTranscriberReady?: boolean;
  dueCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeView,
  setActiveView,
  isModelsReady,
  isTranslatorReady,
  dueCount
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-20">
      <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <h1 className="text-lg font-bold tracking-tight text-white">
            TechVocab <span className="text-xs font-normal text-slate-400">Offline PWA</span>
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`hidden sm:inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${
              isModelsReady
                ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                : isTranslatorReady
                ? 'bg-blue-950/60 border-blue-800 text-blue-300'
                : 'bg-amber-950/60 border-amber-800 text-amber-300'
            }`}
          >
            {isModelsReady ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                AI Offline Ready
              </>
            ) : isTranslatorReady ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                Translator Ready
              </>
            ) : (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Loading AI...
              </>
            )}
          </span>

          <nav className="flex bg-slate-800 p-1 rounded-lg">
            <button
              onClick={() => setActiveView('transcribe')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                activeView === 'transcribe'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Mic className="w-4 h-4" />
              Transcribe
            </button>

            <button
              onClick={() => setActiveView('review')}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                activeView === 'review'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Review
              {dueCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 text-xs font-bold bg-rose-500 text-white rounded-full">
                  {dueCount}
                </span>
              )}
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
};
