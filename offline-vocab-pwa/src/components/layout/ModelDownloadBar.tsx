import React from 'react';
import { ModelProgressState } from '../../hooks/useAIWorker';
import { DownloadCloud } from 'lucide-react';

interface ModelDownloadBarProps {
  progress: ModelProgressState | null;
  isReady: boolean;
}

export const ModelDownloadBar: React.FC<ModelDownloadBarProps> = ({ progress, isReady }) => {
  if (isReady || !progress) return null;

  return (
    <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-2.5">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between text-xs text-slate-300 mb-1.5">
          <span className="flex items-center gap-1.5 font-medium">
            <DownloadCloud className="w-4 h-4 text-blue-400 animate-bounce" />
            Caching offline model: <code className="text-blue-300">{progress.file}</code>
          </span>
          <span className="font-mono">{progress.progress}%</span>
        </div>
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-200"
            style={{ width: `${Math.min(100, Math.max(5, progress.progress))}%` }}
          />
        </div>
      </div>
    </div>
  );
};