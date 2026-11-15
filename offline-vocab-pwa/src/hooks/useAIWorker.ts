import { useState, useEffect, useRef, useCallback } from 'react';
import {
  WorkerRequest,
  WorkerResponse,
  ClozePayload
} from '../types/worker';
import { TranscriptSegment, SentenceBlock } from '../types/flashcard';

export interface ModelProgressState {
  file: string;
  progress: number;
  status: string;
}

/**
 * Splits a raw transcript chunk into individual sentences and word token arrays
 * so each word <span> already knows its exact parent context sentence.
 */
function parseTextIntoSentences(rawText: string, chunkId: string): SentenceBlock[] {
  const sentenceMatches = rawText.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [rawText];

  return sentenceMatches
    .map((s) => s.trim())
    .filter(Boolean)
    .map((sentenceText, index) => ({
      sentenceId: `${chunkId}-s${index}`,
      rawText: sentenceText,
      words: sentenceText.split(/\s+/).filter(Boolean)
    }));
}

export function useAIWorker() {
  const workerRef = useRef<Worker | null>(null);

  const [isModelsReady, setIsModelsReady] = useState(false);
  const [isTranslatorReady, setIsTranslatorReady] = useState(false);
  const [isTranscriberReady, setIsTranscriberReady] = useState(false);
  const [modelProgress, setModelProgress] = useState<ModelProgressState | null>(null);
  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[]>([]);
  const [pendingCloze, setPendingCloze] = useState<ClozePayload | null>(null);
  const [isGeneratingCloze, setIsGeneratingCloze] = useState(false);
  const [workerError, setWorkerError] = useState<string | null>(null);

  useEffect(() => {
    const worker = new Worker(new URL('../workers/ai.worker.ts', import.meta.url), {
      type: 'module'
    });
    workerRef.current = worker;

    worker.onerror = (err) => {
      console.error('[useAIWorker] Worker error event:', err);
      setWorkerError(`AI Worker runtime error: ${err.message || 'Worker thread script failed to execute'}`);
      setIsGeneratingCloze(false);
    };

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data;

      switch (msg.type) {
        case 'MODEL_PROGRESS': {
          setModelProgress(msg.payload);
          break;
        }
        case 'TRANSLATOR_READY': {
          setIsTranslatorReady(true);
          break;
        }
        case 'TRANSCRIBER_READY': {
          setIsTranscriberReady(true);
          break;
        }
        case 'MODELS_READY': {
          setIsModelsReady(true);
          setIsTranslatorReady(true);
          setIsTranscriberReady(true);
          setModelProgress(null);
          break;
        }
        case 'TRANSCRIPTION_RESULT': {
          const { chunkId, text, timestamp } = msg.payload;
          const sentences = parseTextIntoSentences(text, chunkId);

          if (sentences.length > 0) {
            setTranscriptSegments((prev) => [
              ...prev,
              { chunkId, timestamp, sentences }
            ]);
          }
          break;
        }
        case 'CLOZE_GENERATED': {
          setPendingCloze(msg.payload);
          setIsGeneratingCloze(false);
          break;
        }
        case 'ERROR': {
          console.error('[useAIWorker] Worker error message:', msg.payload);
          setWorkerError(`${msg.payload.source}: ${msg.payload.message}`);
          setIsGeneratingCloze(false);
          break;
        }
      }
    };

    // Start loading / caching models in worker
    const initMsg: WorkerRequest = { type: 'INIT_MODELS' };
    worker.postMessage(initMsg);

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  /**
   * Sends a 16kHz Float32Array audio buffer to Whisper.
   * Uses a Transferable ArrayBuffer for zero-copy memory transfer to the worker.
   */
  const sendAudioChunk = useCallback((audio: Float32Array) => {
    if (!workerRef.current) return;
    const chunkId = `chunk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const copy = new Float32Array(audio);

    const request: WorkerRequest = {
      type: 'TRANSCRIBE_AUDIO',
      payload: { audio: copy, chunkId }
    };
    workerRef.current.postMessage(request, [copy.buffer]);
  }, []);

  /**
   * Triggered when the user clicks any word <span> in the transcript.
   */
  const requestClozeGeneration = useCallback((word: string, sentence: string) => {
    if (!workerRef.current) return;
    setWorkerError(null);
    setIsGeneratingCloze(true);

    const requestId = `cloze-${Date.now()}`;
    const request: WorkerRequest = {
      type: 'GENERATE_CLOZE',
      payload: { word, sentence, requestId }
    };
    workerRef.current.postMessage(request);
  }, []);

  const clearPendingCloze = useCallback(() => {
    setPendingCloze(null);
    setIsGeneratingCloze(false);
  }, []);

  const clearTranscript = useCallback(() => {
    setTranscriptSegments([]);
  }, []);

  return {
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
  };
}
