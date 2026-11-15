export interface ClozePayload {
  requestId: string;
  targetWord: string;
  translatedWord: string;
  originalSentence: string;
  translatedSentence: string;
  frontCloze: string;
  backAnswer: string;
}

export type WorkerRequest =
  | { type: 'INIT_MODELS' }
  | {
      type: 'TRANSCRIBE_AUDIO';
      payload: { audio: Float32Array; chunkId: string };
    }
  | {
      type: 'GENERATE_CLOZE';
      payload: { word: string; sentence: string; requestId: string };
    };

export type WorkerResponse =
  | {
      type: 'MODEL_PROGRESS';
      payload: { file: string; progress: number; status: string };
    }
  | { type: 'MODELS_READY' }
  | { type: 'TRANSLATOR_READY' }
  | { type: 'TRANSCRIBER_READY' }
  | {
      type: 'TRANSCRIPTION_RESULT';
      payload: { chunkId: string; text: string; timestamp: number };
    }
  | {
      type: 'CLOZE_GENERATED';
      payload: ClozePayload;
    }
  | {
      type: 'ERROR';
      payload: { message: string; source: string };
    };
