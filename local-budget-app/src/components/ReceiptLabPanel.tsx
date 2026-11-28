import React, { useState } from 'react';
import {
  FlaskConical,
  Upload,
  Play,
  Loader2,
  ScanText,
  Code2,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { getSetting } from '../db/db';
import { compressImageToDataUrl } from '../utils/imageCompression';
import { runReceiptOCR, type OCRResult } from '../services/ocrService';
import { parseOCRTextWithRegex, type RegexParsedReceipt } from '../services/regexReceiptParser';
import {
  DEFAULT_GROQ_MODEL,
  parseReceiptTextWithGroq,
} from '../services/groqReceiptParser';
import {
  DEFAULT_OPENROUTER_MODEL,
  parseReceiptWithOpenRouter,
} from '../services/openRouterReceiptParser';
import type { AIProvider } from '../services/aiReceiptParser';

interface ReceiptLabPanelProps {
  initialImageDataUrl?: string;
}

interface Stage3LabResult {
  providerLabel: string;
  modeLabel: string;
  durationMs: number;
  data: Record<string, unknown>;
}

export const ReceiptLabPanel: React.FC<ReceiptLabPanelProps> = ({
  initialImageDataUrl,
}) => {
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(
    initialImageDataUrl || null
  );
  const [running, setRunning] = useState(false);
  const [hasStartedRun, setHasStartedRun] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);

  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [regexResult, setRegexResult] = useState<RegexParsedReceipt | null>(null);
  const [aiResult, setAiResult] = useState<Stage3LabResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const [fileError, setFileError] = useState<string | null>(null);

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError(null);
    try {
      const compressed = await compressImageToDataUrl(file, 1400, 0.85, 4200);
      setImageDataUrl(compressed);
      setHasStartedRun(false);
      setOcrResult(null);
      setOcrError(null);
      setRegexResult(null);
      setAiResult(null);
      setAiError(null);
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'Could not load receipt image.');
    } finally {
      e.target.value = '';
    }
  };

  const runAiStage = async (
    imgUrl: string,
    rawOcrText: string | undefined,
    defaultCurrency: string
  ) => {
    setAiLoading(true);
    setAiError(null);
    try {
      const provider = await getSetting<AIProvider>('aiProvider', 'openrouter');
      const openRouterKey = await getSetting<string>('openRouterApiKey', '');
      const openRouterModel = await getSetting<string>('openRouterModel', DEFAULT_OPENROUTER_MODEL);
      const groqKey = await getSetting<string>('groqApiKey', '');
      const groqModel = await getSetting<string>('groqModel', DEFAULT_GROQ_MODEL);

      if (provider === 'openrouter') {
        if (!openRouterKey.trim()) {
          setAiError('OpenRouter is selected in Settings, but no OpenRouter API key (sk-or-...) is saved yet.');
        } else {
          const orParsed = await parseReceiptWithOpenRouter({
            imageDataUrl: imgUrl,
            apiKey: openRouterKey.trim(),
            modelName: openRouterModel,
            defaultCurrency,
          });
          setAiResult({
            providerLabel: `OpenRouter (${orParsed.modelUsed})`,
            modeLabel: 'direct_vision',
            durationMs: orParsed.durationMs,
            data: {
              merchant: orParsed.merchant,
              date: orParsed.date,
              currency: orParsed.currency,
              totalAmount: orParsed.totalAmount,
              taxAmount: orParsed.taxAmount,
              category: orParsed.category,
              summaryNote: orParsed.summaryNote,
              lineItems: orParsed.lineItems,
            },
          });
        }
      } else if (provider === 'groq') {
        if (!groqKey.trim()) {
          setAiError('Groq is selected in Settings, but no Groq API key (gsk_...) is saved yet.');
        } else {
          const groqParsed = await parseReceiptTextWithGroq({
            rawOcrText: rawOcrText || '',
            imageDataUrl: imgUrl,
            apiKey: groqKey.trim(),
            modelName: groqModel,
            defaultCurrency,
          });
          setAiResult({
            providerLabel: `Groq (${groqParsed.modelUsed})`,
            modeLabel: groqParsed.modeUsed,
            durationMs: groqParsed.durationMs,
            data: {
              merchant: groqParsed.merchant,
              date: groqParsed.date,
              currency: groqParsed.currency,
              totalAmount: groqParsed.totalAmount,
              taxAmount: groqParsed.taxAmount,
              category: groqParsed.category,
              summaryNote: groqParsed.summaryNote,
              lineItems: groqParsed.lineItems,
            },
          });
        }
      } else {
        setAiError('Select OpenRouter or Groq in Settings to test in Scanner Lab.');
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : String(err));
    } finally {
      setAiLoading(false);
    }
  };

  const handleRunIsolatedStages = async (aiOnly = false) => {
    if (!imageDataUrl) return;
    setRunning(true);
    setHasStartedRun(true);
    setOcrProgress(0);
    setAiResult(null);
    setAiError(null);
    if (!aiOnly) {
      setOcrResult(null);
      setOcrError(null);
      setRegexResult(null);
    }

    try {
      const defaultCurrency = await getSetting<string>('defaultCurrency', 'EUR');
      const provider = await getSetting<AIProvider>('aiProvider', 'openrouter');
      const openRouterKey = await getSetting<string>('openRouterApiKey', '');
      const canRunDirectVisionInParallel =
        provider === 'openrouter' && Boolean(openRouterKey.trim());

      if (aiOnly) {
        await runAiStage(imageDataUrl, ocrResult?.rawText, defaultCurrency);
        return;
      }

      const parallelVisionPromise = canRunDirectVisionInParallel
        ? runAiStage(imageDataUrl, undefined, defaultCurrency)
        : null;

      let extractedRawText = '';
      setOcrLoading(true);
      try {
        const ocr = await runReceiptOCR(imageDataUrl, (pct) => setOcrProgress(pct));
        extractedRawText = ocr.rawText;
        setOcrResult(ocr);

        const regexParsed = parseOCRTextWithRegex(ocr.rawText, defaultCurrency);
        setRegexResult(regexParsed);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setOcrError(
          msg.includes('Failed to fetch dynamically imported module')
            ? 'App was just updated—refresh the page once to load the latest OCR worker.'
            : msg
        );
      } finally {
        setOcrLoading(false);
      }

      if (parallelVisionPromise) {
        await parallelVisionPromise;
      } else {
        await runAiStage(imageDataUrl, extractedRawText, defaultCurrency);
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="rounded-3xl bg-[#F4F6F9] p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-white border border-[#E2E8F0] text-[#0B1221] flex items-center justify-center shrink-0">
            <FlaskConical className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-display font-bold text-[#0B1221] text-base">
              Scanner Lab
            </h2>
            <p className="text-xs text-[#526077] mt-0.5">
              Inspect Raw OCR, Regex, and AI Vision side by side without saving to your feed.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <label className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white hover:bg-[#E9EEF5] text-[#0B1221] font-semibold text-xs transition cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span>{imageDataUrl ? 'Change image' : 'Pick receipt'}</span>
            <input
              type="file"
              accept="image/*"
              onChange={handleFilePick}
              className="hidden"
            />
          </label>

          <button
            type="button"
            disabled={!imageDataUrl || running}
            onClick={() => void handleRunIsolatedStages(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-40 text-white font-semibold text-xs transition cursor-pointer"
          >
            {aiLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>Test AI only</span>
          </button>

          <button
            type="button"
            disabled={!imageDataUrl || running}
            onClick={() => void handleRunIsolatedStages(false)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#0B1221] hover:bg-[#17233B] disabled:opacity-40 text-white font-semibold text-xs transition cursor-pointer"
          >
            {running ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            <span>{running ? 'Running...' : 'Run 3-stage test'}</span>
          </button>
        </div>
      </div>

      {fileError && (
        <div className="p-3 rounded-2xl bg-[#FEE2E2] text-xs text-[#BE123C] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{fileError}</span>
        </div>
      )}

      {!imageDataUrl && (
        <div className="rounded-2xl bg-white p-6 text-center text-xs text-[#7C8BA1]">
          Tap <strong>Pick receipt</strong> above first to load a receipt image, then tap <strong>Test AI only</strong> or <strong>Run 3-stage test</strong>.
        </div>
      )}

      {imageDataUrl && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-2xl bg-white p-3.5">
            <div className="text-[11px] font-semibold text-[#526077] mb-2">
              Original (width-preserved)
            </div>
            <img
              src={imageDataUrl}
              alt="Original receipt"
              className="max-h-56 w-auto mx-auto rounded-xl object-contain"
            />
          </div>

          <div className="rounded-2xl bg-white p-3.5">
            <div className="text-[11px] font-semibold text-[#526077] mb-2">
              Preprocessed (grayscale + contrast)
            </div>
            {ocrResult?.preprocessedDataUrl ? (
              <img
                src={ocrResult.preprocessedDataUrl}
                alt="Preprocessed receipt"
                className="max-h-56 w-auto mx-auto rounded-xl object-contain"
              />
            ) : (
              <div className="h-44 flex items-center justify-center text-xs text-[#7C8BA1]">
                {ocrLoading
                  ? `Running OCR (${ocrProgress}%)...`
                  : 'Run 3-stage test to preview preprocessed OCR image'}
              </div>
            )}
          </div>
        </div>
      )}

      {hasStartedRun && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Stage 1: Raw OCR */}
          <div className="rounded-2xl bg-white p-4 flex flex-col">
            <div className="flex items-center justify-between mb-2.5">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0B1221]">
                <ScanText className="w-3.5 h-3.5 text-[#526077]" />
                <span>1. Raw OCR</span>
              </span>
              {ocrResult && (
                <span className="text-[10px] font-mono text-[#7C8BA1]">
                  {ocrResult.durationMs}ms · {ocrResult.confidence}%
                </span>
              )}
            </div>

            {ocrLoading ? (
              <div className="p-6 text-center text-xs text-[#526077] flex flex-col items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-[#2563EB]" />
                <span>Running Tesseract OCR ({ocrProgress}%)...</span>
              </div>
            ) : ocrError ? (
              <div className="p-3 rounded-xl bg-[#FEE2E2] text-xs text-[#BE123C] flex items-start gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="break-words">{ocrError}</span>
              </div>
            ) : (
              <pre className="text-[11px] font-mono text-[#0B1221] bg-[#F8FAFC] rounded-xl p-3 overflow-auto max-h-72 whitespace-pre-wrap">
                {ocrResult ? ocrResult.rawText || '(empty OCR text)' : '(Skipped — AI only)'}
              </pre>
            )}
          </div>

          {/* Stage 2: Regex */}
          <div className="rounded-2xl bg-white p-4 flex flex-col">
            <div className="flex items-center justify-between mb-2.5">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0B1221]">
                <Code2 className="w-3.5 h-3.5 text-[#526077]" />
                <span>2. Regex</span>
              </span>
              {regexResult && (
                <span className="text-[10px] font-mono text-[#7C8BA1]">
                  {regexResult.durationMs}ms · {regexResult.totalAmount}
                </span>
              )}
            </div>
            {ocrLoading ? (
              <div className="p-6 text-center text-xs text-[#7C8BA1]">
                Waiting for Stage 1 OCR...
              </div>
            ) : (
              <pre className="text-[11px] font-mono text-[#0B1221] bg-[#F8FAFC] rounded-xl p-3 overflow-auto max-h-72 whitespace-pre-wrap">
                {regexResult ? JSON.stringify(regexResult, null, 2) : '(Skipped — AI only)'}
              </pre>
            )}
          </div>

          {/* Stage 3: AI Vision / LLM */}
          <div className="rounded-2xl bg-white p-4 flex flex-col">
            <div className="flex items-center justify-between mb-2.5 gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0B1221] truncate">
                <Sparkles className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
                <span className="truncate">3. {aiResult?.providerLabel || 'AI Output'}</span>
              </span>
              {aiResult && (
                <span className="text-[10px] font-mono text-[#7C8BA1] shrink-0">
                  {aiResult.durationMs}ms · {aiResult.modeLabel}
                </span>
              )}
            </div>
            {aiLoading ? (
              <div className="p-6 text-center text-xs text-[#526077] flex flex-col items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-[#2563EB]" />
                <span>Calling AI model...</span>
              </div>
            ) : aiError ? (
              <div className="p-3 rounded-xl bg-[#FEE2E2] text-xs text-[#BE123C] flex items-start gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="break-words">{aiError}</span>
              </div>
            ) : (
              <pre className="text-[11px] font-mono text-[#0B1221] bg-[#F8FAFC] rounded-xl p-3 overflow-auto max-h-72 whitespace-pre-wrap">
                {aiResult ? JSON.stringify(aiResult.data, null, 2) : '—'}
              </pre>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
