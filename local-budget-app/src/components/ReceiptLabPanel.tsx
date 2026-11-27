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
  const [stageStatus, setStageStatus] = useState<string>('');
  const [ocrProgress, setOcrProgress] = useState(0);

  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [regexResult, setRegexResult] = useState<RegexParsedReceipt | null>(null);
  const [aiResult, setAiResult] = useState<Stage3LabResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImageToDataUrl(file, 1400, 0.85, 4200);
    setImageDataUrl(compressed);
    setOcrResult(null);
    setRegexResult(null);
    setAiResult(null);
    setAiError(null);
    e.target.value = '';
  };

  const handleRunIsolatedStages = async () => {
    if (!imageDataUrl) return;
    setRunning(true);
    setOcrProgress(0);
    setOcrResult(null);
    setRegexResult(null);
    setAiResult(null);
    setAiError(null);

    try {
      setStageStatus('Stage 1: Running OCR...');
      const ocr = await runReceiptOCR(imageDataUrl, (pct) => {
        setOcrProgress(pct);
        setStageStatus(`Stage 1: OCR (${pct}%)`);
      });
      setOcrResult(ocr);

      setStageStatus('Stage 2: Regex...');
      const defaultCurrency = await getSetting<string>('defaultCurrency', 'EUR');
      const regexParsed = parseOCRTextWithRegex(ocr.rawText, defaultCurrency);
      setRegexResult(regexParsed);

      const provider = await getSetting<AIProvider>('aiProvider', 'openrouter');
      const openRouterKey = await getSetting<string>('openRouterApiKey', '');
      const openRouterModel = await getSetting<string>('openRouterModel', DEFAULT_OPENROUTER_MODEL);
      const groqKey = await getSetting<string>('groqApiKey', '');
      const groqModel = await getSetting<string>('groqModel', DEFAULT_GROQ_MODEL);

      if (provider === 'openrouter' && openRouterKey.trim()) {
        setStageStatus('Stage 3: Calling OpenRouter Vision...');
        try {
          const orParsed = await parseReceiptWithOpenRouter({
            imageDataUrl,
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
        } catch (err) {
          setAiError(err instanceof Error ? err.message : String(err));
        }
      } else if (groqKey.trim()) {
        setStageStatus('Stage 3: Calling Groq...');
        try {
          const groqParsed = await parseReceiptTextWithGroq({
            rawOcrText: ocr.rawText,
            imageDataUrl,
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
        } catch (err) {
          setAiError(err instanceof Error ? err.message : String(err));
        }
      } else if (openRouterKey.trim()) {
        setStageStatus('Stage 3: Calling OpenRouter Vision...');
        try {
          const orParsed = await parseReceiptWithOpenRouter({
            imageDataUrl,
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
        } catch (err) {
          setAiError(err instanceof Error ? err.message : String(err));
        }
      } else {
        setAiError('No OpenRouter or Groq API key saved in Settings yet.');
      }
    } finally {
      setRunning(false);
      setStageStatus('');
    }
  };

  return (
    <section className="rounded-3xl bg-[#F2F5F2] p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-white border border-[#E2E5E0] text-[#163300] flex items-center justify-center shrink-0">
            <FlaskConical className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-display font-bold text-[#0E0F0C] text-base">
              Scanner Lab
            </h2>
            <p className="text-xs text-[#5D615C] mt-0.5">
              Inspect Raw OCR, Regex, and AI Vision side by side without saving to your feed.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <label className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white hover:bg-[#E8EDE7] text-[#163300] font-semibold text-xs transition cursor-pointer">
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
            onClick={() => void handleRunIsolatedStages()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#163300] hover:bg-[#1F4403] disabled:opacity-40 text-white font-semibold text-xs transition cursor-pointer"
          >
            {running ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            <span>{running ? stageStatus || `Running (${ocrProgress}%)...` : 'Run 3-stage test'}</span>
          </button>
        </div>
      </div>

      {imageDataUrl && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-2xl bg-white p-3.5">
            <div className="text-[11px] font-semibold text-[#5D615C] mb-2">
              Original (width-preserved)
            </div>
            <img
              src={imageDataUrl}
              alt="Original receipt"
              className="max-h-56 w-auto mx-auto rounded-xl object-contain"
            />
          </div>

          <div className="rounded-2xl bg-white p-3.5">
            <div className="text-[11px] font-semibold text-[#5D615C] mb-2">
              Preprocessed (grayscale + contrast)
            </div>
            {ocrResult?.preprocessedDataUrl ? (
              <img
                src={ocrResult.preprocessedDataUrl}
                alt="Preprocessed receipt"
                className="max-h-56 w-auto mx-auto rounded-xl object-contain"
              />
            ) : (
              <div className="h-44 flex items-center justify-center text-xs text-[#868A84]">
                Run test to preview preprocessed image
              </div>
            )}
          </div>
        </div>
      )}

      {(ocrResult || regexResult || aiResult || aiError) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-2xl bg-white p-4 flex flex-col">
            <div className="flex items-center justify-between mb-2.5">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0E0F0C]">
                <ScanText className="w-3.5 h-3.5 text-[#5D615C]" />
                <span>1. Raw OCR</span>
              </span>
              {ocrResult && (
                <span className="text-[10px] font-mono text-[#6A6C6A]">
                  {ocrResult.durationMs}ms · {ocrResult.confidence}%
                </span>
              )}
            </div>
            <pre className="text-[11px] font-mono text-[#0E0F0C] bg-[#FAFBF9] rounded-xl p-3 overflow-auto max-h-72 whitespace-pre-wrap">
              {ocrResult?.rawText || '(empty OCR text)'}
            </pre>
          </div>

          <div className="rounded-2xl bg-white p-4 flex flex-col">
            <div className="flex items-center justify-between mb-2.5">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0E0F0C]">
                <Code2 className="w-3.5 h-3.5 text-[#5D615C]" />
                <span>2. Regex</span>
              </span>
              {regexResult && (
                <span className="text-[10px] font-mono text-[#6A6C6A]">
                  {regexResult.durationMs}ms · {regexResult.totalAmount}
                </span>
              )}
            </div>
            <pre className="text-[11px] font-mono text-[#0E0F0C] bg-[#FAFBF9] rounded-xl p-3 overflow-auto max-h-72 whitespace-pre-wrap">
              {regexResult ? JSON.stringify(regexResult, null, 2) : '—'}
            </pre>
          </div>

          <div className="rounded-2xl bg-white p-4 flex flex-col">
            <div className="flex items-center justify-between mb-2.5 gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0E0F0C] truncate">
                <Sparkles className="w-3.5 h-3.5 text-[#2F5711] shrink-0" />
                <span className="truncate">3. {aiResult?.providerLabel || 'AI Output'}</span>
              </span>
              {aiResult && (
                <span className="text-[10px] font-mono text-[#6A6C6A] shrink-0">
                  {aiResult.durationMs}ms · {aiResult.modeLabel}
                </span>
              )}
            </div>
            {aiError ? (
              <div className="p-3 rounded-xl bg-[#FDECEC] text-xs text-[#A8200D] flex items-start gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="break-words">{aiError}</span>
              </div>
            ) : (
              <pre className="text-[11px] font-mono text-[#0E0F0C] bg-[#FAFBF9] rounded-xl p-3 overflow-auto max-h-72 whitespace-pre-wrap">
                {aiResult ? JSON.stringify(aiResult.data, null, 2) : '—'}
              </pre>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
