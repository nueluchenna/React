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
  type GroqParsedReceipt,
} from '../services/groqReceiptParser';

interface ReceiptLabPanelProps {
  initialImageDataUrl?: string;
}

export const ReceiptLabPanel: React.FC<ReceiptLabPanelProps> = ({
  initialImageDataUrl,
}) => {
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(
    initialImageDataUrl || null
  );
  const [running, setRunning] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);

  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [regexResult, setRegexResult] = useState<RegexParsedReceipt | null>(null);
  const [groqResult, setGroqResult] = useState<GroqParsedReceipt | null>(null);
  const [groqError, setGroqError] = useState<string | null>(null);

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImageToDataUrl(file, 1400, 0.85, 4200);
    setImageDataUrl(compressed);
    setOcrResult(null);
    setRegexResult(null);
    setGroqResult(null);
    setGroqError(null);
    e.target.value = '';
  };

  const handleRunIsolatedStages = async () => {
    if (!imageDataUrl) return;
    setRunning(true);
    setOcrProgress(0);
    setOcrResult(null);
    setRegexResult(null);
    setGroqResult(null);
    setGroqError(null);

    try {
      // Stage 1: Isolated OCR (with preprocessing + cached worker)
      const ocr = await runReceiptOCR(imageDataUrl, (pct) => setOcrProgress(pct));
      setOcrResult(ocr);

      // Stage 2: Isolated Regex Parser
      const defaultCurrency = await getSetting<string>('defaultCurrency', 'EUR');
      const regexParsed = parseOCRTextWithRegex(ocr.rawText, defaultCurrency);
      setRegexResult(regexParsed);

      // Stage 3: Isolated Groq Parser
      const groqKey = await getSetting<string>('groqApiKey', '');
      const groqModel = await getSetting<string>('groqModel', DEFAULT_GROQ_MODEL);
      if (!groqKey.trim()) {
        setGroqError('No Groq API key saved in Settings yet.');
      } else {
        try {
          const groqParsed = await parseReceiptTextWithGroq({
            rawOcrText: ocr.rawText,
            imageDataUrl,
            apiKey: groqKey.trim(),
            modelName: groqModel,
            defaultCurrency,
          });
          setGroqResult(groqParsed);
        } catch (err) {
          setGroqError(err instanceof Error ? err.message : String(err));
        }
      }
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="p-2 rounded-xl bg-slate-100 text-slate-700 shrink-0">
            <FlaskConical className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">
              Receipt Scanner Lab (Isolated Pipeline Inspector)
            </h3>
            <p className="text-xs text-slate-500">
              Compare Stage 1 (Preprocessed OCR), Stage 2 (Regex), and Stage 3 (Groq JSON) side by side without saving to your feed.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium text-xs transition cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span>{imageDataUrl ? 'Change Receipt' : 'Pick Receipt'}</span>
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
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white font-semibold text-xs transition cursor-pointer"
          >
            {running ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            <span>{running ? `Running (${ocrProgress}%)...` : 'Run 3-Stage Test'}</span>
          </button>
        </div>
      </div>

      {/* Original vs Preprocessed Image Strip */}
      {imageDataUrl && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="rounded-xl border border-slate-200 p-2.5 bg-slate-50">
            <div className="text-[11px] font-semibold text-slate-500 mb-1.5">
              Original (Width-Preserved JPEG)
            </div>
            <img
              src={imageDataUrl}
              alt="Original receipt"
              className="max-h-56 w-auto mx-auto rounded-lg object-contain"
            />
          </div>

          <div className="rounded-xl border border-slate-200 p-2.5 bg-slate-50">
            <div className="text-[11px] font-semibold text-slate-500 mb-1.5">
              Stage 1 Preprocessed (Grayscale + Auto-Contrast)
            </div>
            {ocrResult?.preprocessedDataUrl ? (
              <img
                src={ocrResult.preprocessedDataUrl}
                alt="Preprocessed receipt"
                className="max-h-56 w-auto mx-auto rounded-lg object-contain"
              />
            ) : (
              <div className="h-44 flex items-center justify-center text-xs text-slate-400">
                Click &quot;Run 3-Stage Test&quot; to inspect preprocessed image
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3 Isolated Output Columns */}
      {(ocrResult || regexResult || groqResult || groqError) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 pt-1">
          {/* Stage 1: Raw OCR */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                <ScanText className="w-3.5 h-3.5 text-slate-500" />
                <span>1. Raw OCR Text</span>
              </span>
              {ocrResult && (
                <span className="text-[10px] font-mono text-slate-500">
                  {ocrResult.durationMs}ms • {ocrResult.confidence}% conf
                </span>
              )}
            </div>
            <pre className="text-[11px] font-mono text-slate-700 bg-white border border-slate-200 rounded-lg p-2.5 overflow-auto max-h-72 whitespace-pre-wrap">
              {ocrResult?.rawText || '(empty OCR text)'}
            </pre>
          </div>

          {/* Stage 2: Regex Heuristic Output */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                <Code2 className="w-3.5 h-3.5 text-amber-600" />
                <span>2. Regex Parser</span>
              </span>
              {regexResult && (
                <span className="text-[10px] font-mono text-slate-500">
                  {regexResult.durationMs}ms • Total: {regexResult.totalAmount}
                </span>
              )}
            </div>
            <pre className="text-[11px] font-mono text-slate-700 bg-white border border-slate-200 rounded-lg p-2.5 overflow-auto max-h-72 whitespace-pre-wrap">
              {regexResult ? JSON.stringify(regexResult, null, 2) : '—'}
            </pre>
          </div>

          {/* Stage 3: Groq Output */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>3. Groq Output</span>
              </span>
              {groqResult && (
                <span className="text-[10px] font-mono text-slate-500">
                  {groqResult.durationMs}ms • {groqResult.modeUsed}
                </span>
              )}
            </div>
            {groqError ? (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="break-words">{groqError}</span>
              </div>
            ) : (
              <pre className="text-[11px] font-mono text-slate-700 bg-white border border-slate-200 rounded-lg p-2.5 overflow-auto max-h-72 whitespace-pre-wrap">
                {groqResult
                  ? JSON.stringify(
                      {
                        merchant: groqResult.merchant,
                        date: groqResult.date,
                        currency: groqResult.currency,
                        totalAmount: groqResult.totalAmount,
                        taxAmount: groqResult.taxAmount,
                        category: groqResult.category,
                        summaryNote: groqResult.summaryNote,
                        lineItems: groqResult.lineItems,
                      },
                      null,
                      2
                    )
                  : '—'}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
