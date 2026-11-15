import React, { useState } from 'react';
import { useAIWorker } from './hooks/useAIWorker';
import { useFSRSDeck } from './hooks/useFSRSDeck';
import { Header } from './components/layout/Header';
import { ModelDownloadBar } from './components/layout/ModelDownloadBar';
import { LiveRecorderBar } from './components/transcribe/LiveRecorderBar';
import { InteractiveTranscript } from './components/transcribe/InteractiveTranscript';
import { ContextCaptureModal } from './components/transcribe/ContextCaptureModal';
import { DeckDashboard } from './components/review/DeckDashboard';
import { FlashcardPlayer } from './components/review/FlashcardPlayer';
import { TranscriptSegment } from './types/flashcard';

export function App() {
  const [activeView, setActiveView] = useState<'transcribe' | 'review'>('transcribe');
  const [isReviewingSession, setIsReviewingSession] = useState(false);
  const [manualSegments, setManualSegments] = useState<TranscriptSegment[]>([]);

  const {
    isModelsReady,
    isTranslatorReady,
    isTranscriberReady,
    modelProgress,
    transcriptSegments,
    pendingCloze,
    isGeneratingCloze,
    workerError,
    sendAudioChunk,
    requestClozeGeneration,
    clearPendingCloze,
    clearTranscript
  } = useAIWorker();

  const {
    allCards,
    dueCards,
    newCount,
    learningCount,
    reviewCount,
    addCard,
    submitGrade,
    deleteCard
  } = useFSRSDeck();

  const combinedSegments = [...transcriptSegments, ...manualSegments];

  const handleManualSentenceSubmit = (text: string) => {
    const chunkId = `manual-${Date.now()}`;
    const sentences = (text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text])
      .map((s) => s.trim())
      .filter(Boolean)
      .map((rawText, idx) => ({
        sentenceId: `${chunkId}-s${idx}`,
        rawText,
        words: rawText.split(/\s+/).filter(Boolean)
      }));

    setManualSegments((prev) => [
      ...prev,
      { chunkId, timestamp: Date.now(), sentences }
    ]);
  };

  const handleClearAllTranscripts = () => {
    clearTranscript();
    setManualSegments([]);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Header
        activeView={activeView}
        setActiveView={(view) => {
          setActiveView(view);
          setIsReviewingSession(false);
        }}
        isModelsReady={isModelsReady}
        isTranslatorReady={isTranslatorReady}
        isTranscriberReady={isTranscriberReady}
        dueCount={dueCards.length}
      />

      <ModelDownloadBar progress={modelProgress} isReady={isModelsReady} />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6 space-y-6">
        {workerError && (
          <div className="bg-rose-950/60 border border-rose-800 text-rose-200 px-4 py-2.5 rounded-xl text-xs">
            {workerError}
          </div>
        )}

        {activeView === 'transcribe' ? (
          <>
            <LiveRecorderBar
              isModelsReady={isTranscriberReady || isModelsReady}
              onAudioChunk={sendAudioChunk}
              onManualSentenceSubmit={handleManualSentenceSubmit}
              onClearTranscript={handleClearAllTranscripts}
              hasTranscript={combinedSegments.length > 0}
            />

            <InteractiveTranscript
              segments={combinedSegments}
              onWordSelect={(word, sentence) => requestClozeGeneration(word, sentence)}
            />
          </>
        ) : isReviewingSession ? (
          <FlashcardPlayer
            dueCards={dueCards}
            onGrade={async (card, grade) => {
              await submitGrade(card, grade);
            }}
            onExit={() => setIsReviewingSession(false)}
          />
        ) : (
          <DeckDashboard
            allCards={allCards}
            dueCount={dueCards.length}
            newCount={newCount}
            learningCount={learningCount}
            reviewCount={reviewCount}
            onStartReview={() => setIsReviewingSession(true)}
            onDeleteCard={deleteCard}
          />
        )}
      </main>

      <ContextCaptureModal
        isGenerating={isGeneratingCloze}
        pendingCloze={pendingCloze}
        onSaveCard={addCard}
        onClose={clearPendingCloze}
      />
    </div>
  );
}

export default App;
