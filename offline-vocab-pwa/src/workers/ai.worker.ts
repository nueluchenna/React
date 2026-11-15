/// <reference lib="webworker" />

// Error boundaries - set up before any other imports
self.onerror = (e: string | Event) => {
  const msg = typeof e === 'string' ? e : (e as ErrorEvent)?.message ?? 'Unknown worker error';
  console.error('[ai.worker] Uncaught global error:', msg);
  self.postMessage({
    type: 'ERROR',
    payload: { message: msg, source: 'WORKER_GLOBAL' }
  });
};

self.onunhandledrejection = (e: PromiseRejectionEvent) => {
  const msg = e?.reason?.message ?? String(e?.reason ?? 'Unhandled rejection');
  console.error('[ai.worker] Unhandled rejection:', msg);
  self.postMessage({
    type: 'ERROR',
    payload: { message: msg, source: 'WORKER_PROMISE' }
  });
};

import { pipeline, env } from '@xenova/transformers';
import { WorkerRequest, WorkerResponse } from '../types/worker';

// ── ONNX Runtime configuration ───────────────────────────────────────────────
// Use single-threaded WASM so we don't need SharedArrayBuffer / COOP headers
env.allowLocalModels = false;
env.useBrowserCache = true;

if (env.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.numThreads = 1;   // No SharedArrayBuffer required
  env.backends.onnx.wasm.simd = true;
  env.backends.onnx.wasm.proxy = false;
  // Point to local WASM files served from /public (copied earlier)
  env.backends.onnx.wasm.wasmPaths = `${self.location.origin}/`;
}
// ─────────────────────────────────────────────────────────────────────────────

const USE_LIGHTWEIGHT_TRANSLATOR = true;
const WHISPER_MODEL = 'Xenova/whisper-tiny';
const TRANSLATION_MODEL = USE_LIGHTWEIGHT_TRANSLATOR
  ? 'Xenova/opus-mt-de-en'
  : 'Xenova/nllb-200-distilled-600M';

const HALLUCINATION_PATTERNS = [
  /^\[.*\]$/,
  /^\(.*\)$/,
  /^♪.*♪$/,
  /^(Untertitel|Vielen Dank|Danke|Tschüss|Bis bald|Musik|Applaus)\.?$/i
];

let transcriber: any = null;
let translator: any = null;
let transcriberPromise: Promise<any> | null = null;
let translatorPromise: Promise<any> | null = null;

function postToMain(message: WorkerResponse) {
  self.postMessage(message);
}

function progressCallback(source: string, data: any) {
  if (data.status === 'progress' || data.status === 'initiate' || data.status === 'download') {
    const rawName: string = data.file ?? data.name ?? '';
    const shortName = rawName.split('/').pop() ?? source;
    postToMain({
      type: 'MODEL_PROGRESS',
      payload: {
        file: `${source}: ${shortName}`,
        progress: typeof data.progress === 'number' ? Math.round(data.progress) : 0,
        status: data.status
      }
    });
  }
}

function checkAllModelsReady() {
  if (transcriber && translator) {
    postToMain({ type: 'MODELS_READY' });
  }
}

async function getTranslator(): Promise<any> {
  if (translator) return translator;
  if (!translatorPromise) {
    translatorPromise = pipeline('translation', TRANSLATION_MODEL, {
      quantized: true,
      progress_callback: (data: any) => progressCallback('Translation', data)
    }).then((t: any) => {
      translator = t;
      postToMain({ type: 'TRANSLATOR_READY' });
      checkAllModelsReady();
      return t;
    }).catch((err: any) => {
      translatorPromise = null;
      console.error('[ai.worker] Translator load failed:', err);
      postToMain({ type: 'ERROR', payload: { message: err?.message ?? 'Failed to load translation model.', source: 'INIT_TRANSLATOR' } });
      throw err;
    });
  }
  return translatorPromise;
}

async function getTranscriber(): Promise<any> {
  if (transcriber) return transcriber;
  if (!transcriberPromise) {
    transcriberPromise = pipeline('automatic-speech-recognition', WHISPER_MODEL, {
      quantized: true,
      progress_callback: (data: any) => progressCallback('Whisper', data)
    }).then((t: any) => {
      transcriber = t;
      postToMain({ type: 'TRANSCRIBER_READY' });
      checkAllModelsReady();
      return t;
    }).catch((err: any) => {
      transcriberPromise = null;
      console.error('[ai.worker] Transcriber load failed:', err);
      postToMain({ type: 'ERROR', payload: { message: err?.message ?? 'Failed to load speech model.', source: 'INIT_TRANSCRIBER' } });
      throw err;
    });
  }
  return transcriberPromise;
}

async function translateText(text: string): Promise<string> {
  const trans = await getTranslator();
  const options = USE_LIGHTWEIGHT_TRANSLATOR ? {} : { src_lang: 'deu_Latn', tgt_lang: 'eng_Latn' };
  const output = await trans(text, options);
  if (Array.isArray(output) && output.length > 0) return (output[0].translation_text ?? '').trim();
  return (output?.translation_text ?? '').trim();
}

function cleanWhisperText(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  for (const p of HALLUCINATION_PATTERNS) if (p.test(trimmed)) return '';
  return trimmed;
}

function stripPunctuation(word: string): string {
  return word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').trim();
}

function buildClozeSentence(sentence: string, targetWord: string): string {
  const escaped = targetWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const boundaryRegex = new RegExp(`(?<=^|[^\\p{L}\\p{N}])(${escaped})(?=$|[^\\p{L}\\p{N}])`, 'giu');
  if (boundaryRegex.test(sentence)) return sentence.replace(boundaryRegex, '[_____]');
  return sentence.replace(new RegExp(escaped, 'gi'), '[_____]');
}

self.addEventListener('message', async (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;

  switch (message.type) {
    case 'INIT_MODELS': {
      // Kick off both model loads concurrently — translator first since it's needed for cloze
      getTranslator().catch(() => {});
      getTranscriber().catch(() => {});
      break;
    }

    case 'TRANSCRIBE_AUDIO': {
      const { audio, chunkId } = message.payload;
      try {
        const trans = await getTranscriber();
        const result = await trans(audio, {
          language: 'german',
          task: 'transcribe',
          chunk_length_s: 30,
          stride_length_s: 5
        });
        const cleanedText = cleanWhisperText(result?.text ?? '');
        if (cleanedText) {
          postToMain({
            type: 'TRANSCRIPTION_RESULT',
            payload: { chunkId, text: cleanedText, timestamp: Date.now() }
          });
        }
      } catch (err: any) {
        postToMain({ type: 'ERROR', payload: { message: err?.message ?? 'Transcription error.', source: 'TRANSCRIBE_AUDIO' } });
      }
      break;
    }

    case 'GENERATE_CLOZE': {
      const { word, sentence, requestId } = message.payload;
      try {
        const cleanWord = stripPunctuation(word);
        if (!cleanWord) throw new Error('Selected token is not a valid German word.');

        const [translatedWordRaw, translatedSentence] = await Promise.all([
          translateText(cleanWord),
          translateText(sentence)
        ]);

        const translatedWord = stripPunctuation(translatedWordRaw) || translatedWordRaw;
        postToMain({
          type: 'CLOZE_GENERATED',
          payload: {
            requestId,
            targetWord: cleanWord,
            translatedWord,
            originalSentence: sentence,
            translatedSentence,
            frontCloze: buildClozeSentence(sentence, cleanWord),
            backAnswer: `${cleanWord} - ${translatedWord}`
          }
        });
      } catch (err: any) {
        postToMain({ type: 'ERROR', payload: { message: err?.message ?? 'Cloze generation error.', source: 'GENERATE_CLOZE' } });
      }
      break;
    }
  }
});
