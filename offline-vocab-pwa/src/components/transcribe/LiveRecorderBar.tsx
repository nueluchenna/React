import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Trash2, PlusCircle } from 'lucide-react';
import { ContinuousAudioRecorder } from '../../services/audioRecorder';

interface LiveRecorderBarProps {
  isModelsReady: boolean;
  onAudioChunk: (pcmData: Float32Array) => void;
  onManualSentenceSubmit: (text: string) => void;
  onClearTranscript: () => void;
  hasTranscript: boolean;
}

export const LiveRecorderBar: React.FC<LiveRecorderBarProps> = ({
  isModelsReady,
  onAudioChunk,
  onManualSentenceSubmit,
  onClearTranscript,
  hasTranscript
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [manualInput, setManualInput] = useState('');
  const [micError, setMicError] = useState<string | null>(null);
  const recorderRef = useRef<ContinuousAudioRecorder | null>(null);

  useEffect(() => {
    return () => {
      recorderRef.current?.stop();
    };
  }, []);

  const toggleRecording = async () => {
    setMicError(null);
    if (isRecording) {
      recorderRef.current?.stop();
      setIsRecording(false);
      setAudioLevel(0);
    } else {
      try {
        const recorder = new ContinuousAudioRecorder(
          (chunk) => onAudioChunk(chunk),
          (level) => setAudioLevel(level)
        );
        recorderRef.current = recorder;
        await recorder.start();
        setIsRecording(true);
      } catch (err: any) {
        setMicError(err?.message || 'Microphone access denied.');
        setIsRecording(false);
      }
    }
  };

  const handleManualAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    onManualSentenceSubmit(manualInput.trim());
    setManualInput('');
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleRecording}
            disabled={!isModelsReady}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition shadow ${
              isRecording
                ? 'bg-rose-600 hover:bg-rose-500 text-white'
                : 'bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40'
            }`}
          >
            {isRecording ? (
              <>
                <Square className="w-4 h-4 fill-current" />
                Stop Listening
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                Start Live Transcribe
              </>
            )}
          </button>

          {/* Real-time voice energy meter */}
          {isRecording && (
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-400 transition-all duration-75"
                  style={{ width: `${Math.min(100, Math.round(audioLevel * 100))}%` }}
                />
              </div>
              <span className="text-xs text-emerald-400 font-mono">16kHz LIVE</span>
            </div>
          )}
        </div>

        {hasTranscript && (
          <button
            onClick={onClearTranscript}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-rose-400 px-2.5 py-1.5 rounded-lg border border-slate-800 hover:border-rose-900 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear Transcript
          </button>
        )}
      </div>

      {/* Manual sentence entry for PDF reading or testing without mic */}
      <form onSubmit={handleManualAdd} className="flex gap-2">
        <input
          type="text"
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
          placeholder="Or paste/type a German sentence here (e.g., Die Regelungstechnik ist stabil.)..."
          className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />
        <button
          type="submit"
          disabled={!manualInput.trim()}
          className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 px-3 py-2 rounded-lg text-sm font-medium transition"
        >
          <PlusCircle className="w-4 h-4" />
          Add
        </button>
      </form>

      {micError && <p className="text-xs text-rose-400">{micError}</p>}
    </div>
  );
};