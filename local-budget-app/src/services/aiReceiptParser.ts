import { GoogleGenAI } from '@google/genai';
import {
  SPENDEE_CATEGORIES,
  normalizeCategory,
  getSetting,
  type SpendeeCategory,
  type LineItem,
} from '../db/db';
import { extractBase64Payload } from '../utils/imageCompression';
import { runReceiptOCR } from './ocrService';
import { parseOCRTextWithRegex } from './regexReceiptParser';
import {
  DEFAULT_GROQ_MODEL,
  fetchGroqModels,
  testGroqApiKey,
  parseReceiptTextWithGroq,
  isLikelyVisionModel,
} from './groqReceiptParser';
import {
  DEFAULT_OPENROUTER_MODEL,
  fetchOpenRouterFreeVisionModels,
  testOpenRouterApiKey,
  parseReceiptWithOpenRouter,
} from './openRouterReceiptParser';

export {
  DEFAULT_GROQ_MODEL,
  fetchGroqModels,
  testGroqApiKey,
  DEFAULT_OPENROUTER_MODEL,
  fetchOpenRouterFreeVisionModels,
  testOpenRouterApiKey,
};

export type AIProvider = 'openrouter' | 'groq' | 'gemini';

export interface ExtractedReceiptData {
  merchant: string;
  date: string; // YYYY-MM-DD
  currency: string;
  totalAmount: number;
  taxAmount?: number;
  category: SpendeeCategory;
  summaryNote: string;
  lineItems: LineItem[];
  extractionEngine: 'openrouter' | 'gemini' | 'groq' | 'tesseract_fallback';
  fallbackReason?: string;
}

export interface AICoachAdvice {
  headline: string;
  habitBreakdown: string[];
  savingTips: Array<{
    title: string;
    estimatedMonthlySavings: string;
    action: string;
  }>;
  source: 'openrouter' | 'gemini' | 'groq' | 'local_smart_coach';
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function sanitizeDateISO(raw?: string): string {
  if (!raw) return todayISO();
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
  return todayISO();
}

export function createGeminiClient(apiKey: string): {
  client: GoogleGenAI;
  providerLabel: string;
} {
  const trimmed = apiKey.trim();
  if (trimmed.startsWith('AQ.')) {
    return {
      client: new GoogleGenAI({ apiKey: trimmed, vertexai: true }),
      providerLabel: 'Vertex AI Express',
    };
  }
  return {
    client: new GoogleGenAI({ apiKey: trimmed }),
    providerLabel: 'Google AI Studio',
  };
}

export async function testGeminiApiKey(
  apiKey: string,
  modelName = 'gemini-2.5-flash'
): Promise<{ ok: boolean; provider: string; message: string }> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    return { ok: false, provider: 'None', message: 'API key is empty.' };
  }

  const { client, providerLabel } = createGeminiClient(trimmed);
  try {
    const res = await client.models.generateContent({
      model: modelName || 'gemini-2.5-flash',
      contents: 'Reply with OK',
      config: { maxOutputTokens: 10 },
    });
    return {
      ok: true,
      provider: providerLabel,
      message: res.text
        ? `Connected successfully via ${providerLabel} (${modelName}).`
        : `Connected via ${providerLabel}.`,
    };
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      provider: providerLabel,
      message: `${providerLabel} rejected the key: ${rawMsg}`,
    };
  }
}

export async function parseReceiptWithGroq(
  imageDataUrl: string,
  apiKey: string,
  modelName = DEFAULT_GROQ_MODEL,
  defaultCurrency = 'EUR',
  onProgress?: (progress: number) => void
): Promise<ExtractedReceiptData> {
  const targetModel = (modelName || DEFAULT_GROQ_MODEL).trim();
  let rawOcrText: string | undefined;

  if (!isLikelyVisionModel(targetModel)) {
    const ocr = await runReceiptOCR(imageDataUrl, onProgress);
    rawOcrText = ocr.rawText;
  }

  const parsed = await parseReceiptTextWithGroq({
    rawOcrText,
    imageDataUrl,
    apiKey,
    modelName: targetModel,
    defaultCurrency,
  });

  return {
    merchant: parsed.merchant,
    date: parsed.date,
    currency: parsed.currency,
    totalAmount: parsed.totalAmount,
    taxAmount: parsed.taxAmount,
    category: parsed.category,
    summaryNote: parsed.summaryNote,
    lineItems: parsed.lineItems,
    extractionEngine: 'groq',
  };
}

export async function parseReceiptWithGemini(
  imageDataUrl: string,
  apiKey: string,
  modelName = 'gemini-2.5-flash',
  defaultCurrency = 'EUR'
): Promise<ExtractedReceiptData> {
  const { client } = createGeminiClient(apiKey);
  const { base64, mimeType } = extractBase64Payload(imageDataUrl);
  const today = todayISO();

  const responseSchema = {
    type: 'object',
    properties: {
      merchant: { type: 'string' },
      date: { type: 'string' },
      currency: { type: 'string' },
      totalAmount: { type: 'number' },
      taxAmount: { type: 'number' },
      category: { type: 'string', enum: SPENDEE_CATEGORIES },
      summaryNote: { type: 'string' },
      lineItems: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            quantity: { type: 'number' },
            unitPrice: { type: 'number' },
            totalPrice: { type: 'number' },
          },
          required: ['name', 'quantity', 'unitPrice', 'totalPrice'],
        },
      },
    },
    required: [
      'merchant',
      'date',
      'currency',
      'totalAmount',
      'category',
      'summaryNote',
      'lineItems',
    ],
  };

  const response = await client.models.generateContent({
    model: modelName || 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Analyze this receipt image (may be English, German, or another European language like Lidl, Aldi, REWE) and extract structured JSON.
- Today's date is ${today}. Fallback to ${today} if illegible.
- Look carefully for final paid total (SUMME, zu zahlen, Kartenzahlung, TOTAL). Note comma decimals (44,50 = 44.50).
- Map category strictly to: ${SPENDEE_CATEGORIES.join(', ')}.`,
          },
          { inlineData: { data: base64, mimeType } },
        ],
      },
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema,
      temperature: 0.1,
    },
  });

  const parsed = JSON.parse(response.text || '{}');
  const lineItems: LineItem[] = Array.isArray(parsed.lineItems)
    ? parsed.lineItems.map((it: Partial<LineItem>) => {
        const qty = Number(it.quantity) > 0 ? Number(it.quantity) : 1;
        const total = Number(it.totalPrice) || Number(it.unitPrice) || 0;
        const unit = Number(it.unitPrice) || Number((total / qty).toFixed(2));
        return {
          name: String(it.name || 'Item').trim(),
          quantity: qty,
          unitPrice: unit,
          totalPrice: total,
        };
      })
    : [];

  const computedTotal = lineItems.reduce((acc, i) => acc + i.totalPrice, 0);
  const totalAmount =
    Number(parsed.totalAmount) > 0
      ? Number(parsed.totalAmount)
      : Number(computedTotal.toFixed(2));

  return {
    merchant: String(parsed.merchant || 'Receipt Merchant').trim(),
    date: sanitizeDateISO(parsed.date),
    currency: String(parsed.currency || defaultCurrency).toUpperCase().slice(0, 3),
    totalAmount,
    taxAmount: Number(parsed.taxAmount) > 0 ? Number(parsed.taxAmount) : undefined,
    category: normalizeCategory(parsed.category),
    summaryNote: String(parsed.summaryNote || 'Receipt purchase').trim(),
    lineItems:
      lineItems.length > 0
        ? lineItems
        : [{ name: String(parsed.merchant || 'Receipt Purchase'), quantity: 1, unitPrice: totalAmount, totalPrice: totalAmount }],
    extractionEngine: 'gemini',
  };
}

export async function parseReceiptWithLocalOCR(
  imageDataUrl: string,
  defaultCurrency = 'EUR',
  onProgress?: (progress: number) => void,
  fallbackReason?: string
): Promise<ExtractedReceiptData> {
  const ocr = await runReceiptOCR(imageDataUrl, onProgress);
  const regexParsed = parseOCRTextWithRegex(ocr.rawText, defaultCurrency);
  return {
    merchant: regexParsed.merchant,
    date: regexParsed.date,
    currency: regexParsed.currency,
    totalAmount: regexParsed.totalAmount,
    taxAmount: regexParsed.taxAmount,
    category: regexParsed.category,
    summaryNote: regexParsed.summaryNote,
    lineItems: regexParsed.lineItems,
    extractionEngine: 'tesseract_fallback',
    fallbackReason,
  };
}

export async function extractReceiptSmart(
  imageDataUrl: string,
  options?: {
    forceLocalOCR?: boolean;
    onProgress?: (progress: number) => void;
  }
): Promise<ExtractedReceiptData> {
  const aiProvider = await getSetting<AIProvider>('aiProvider', 'openrouter');
  const openRouterKey = await getSetting<string>('openRouterApiKey', '');
  const openRouterModel = await getSetting<string>('openRouterModel', DEFAULT_OPENROUTER_MODEL);
  const groqApiKey = await getSetting<string>('groqApiKey', '');
  const groqModel = await getSetting<string>('groqModel', DEFAULT_GROQ_MODEL);
  const geminiApiKey = await getSetting<string>('geminiApiKey', '');
  const geminiModel = await getSetting<string>('geminiModel', 'gemini-2.5-flash');
  const defaultCurrency = await getSetting<string>('defaultCurrency', 'EUR');

  if (!options?.forceLocalOCR) {
    const effectiveOpenRouterKey =
      openRouterKey.trim() ||
      (groqApiKey.trim().startsWith('sk-or-') ? groqApiKey.trim() : '') ||
      (geminiApiKey.trim().startsWith('sk-or-') ? geminiApiKey.trim() : '');

    if (
      (aiProvider === 'openrouter' ||
        groqApiKey.trim().startsWith('sk-or-') ||
        geminiApiKey.trim().startsWith('sk-or-')) &&
      effectiveOpenRouterKey.length > 10
    ) {
      try {
        const res = await parseReceiptWithOpenRouter({
          imageDataUrl,
          apiKey: effectiveOpenRouterKey,
          modelName: openRouterModel,
          defaultCurrency,
        });
        return {
          merchant: res.merchant,
          date: res.date,
          currency: res.currency,
          totalAmount: res.totalAmount,
          taxAmount: res.taxAmount,
          category: res.category,
          summaryNote: res.summaryNote,
          lineItems: res.lineItems,
          extractionEngine: 'openrouter',
        };
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        console.warn('OpenRouter extraction failed, falling back to local OCR:', reason);
        return await parseReceiptWithLocalOCR(imageDataUrl, defaultCurrency, options?.onProgress, reason);
      }
    }

    const effectiveGroqKey =
      groqApiKey.trim() || (geminiApiKey.trim().startsWith('gsk_') ? geminiApiKey.trim() : '');

    if ((aiProvider === 'groq' || geminiApiKey.trim().startsWith('gsk_')) && effectiveGroqKey.length > 10) {
      try {
        return await parseReceiptWithGroq(
          imageDataUrl,
          effectiveGroqKey,
          groqModel,
          defaultCurrency,
          options?.onProgress
        );
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        console.warn('Groq extraction failed, falling back to local OCR:', reason);
        return await parseReceiptWithLocalOCR(imageDataUrl, defaultCurrency, options?.onProgress, reason);
      }
    }

    if (geminiApiKey && geminiApiKey.trim().length > 10) {
      try {
        return await parseReceiptWithGemini(imageDataUrl, geminiApiKey.trim(), geminiModel, defaultCurrency);
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        console.warn('Gemini extraction failed, falling back to local OCR:', reason);
        return await parseReceiptWithLocalOCR(imageDataUrl, defaultCurrency, options?.onProgress, reason);
      }
    }

    if (effectiveOpenRouterKey.length > 10) {
      try {
        const res = await parseReceiptWithOpenRouter({
          imageDataUrl,
          apiKey: effectiveOpenRouterKey,
          modelName: openRouterModel,
          defaultCurrency,
        });
        return {
          merchant: res.merchant,
          date: res.date,
          currency: res.currency,
          totalAmount: res.totalAmount,
          taxAmount: res.taxAmount,
          category: res.category,
          summaryNote: res.summaryNote,
          lineItems: res.lineItems,
          extractionEngine: 'openrouter',
        };
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        return await parseReceiptWithLocalOCR(imageDataUrl, defaultCurrency, options?.onProgress, reason);
      }
    }

    if (effectiveGroqKey.length > 10) {
      try {
        return await parseReceiptWithGroq(
          imageDataUrl,
          effectiveGroqKey,
          groqModel,
          defaultCurrency,
          options?.onProgress
        );
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        return await parseReceiptWithLocalOCR(imageDataUrl, defaultCurrency, options?.onProgress, reason);
      }
    }
  }

  return await parseReceiptWithLocalOCR(
    imageDataUrl,
    defaultCurrency,
    options?.onProgress,
    options?.forceLocalOCR ? undefined : 'No AI API key configured'
  );
}

export async function generateAIFinancialCoachAdvice(summary: {
  periodLabel: string;
  currency: string;
  totalSpent: number;
  monthlyBudget: number;
  categoryTotals: Array<{ category: string; amount: number; percentage: number }>;
  topMerchants: Array<{ merchant: string; amount: number; count: number }>;
  weekendVsWeekdayRatio: number;
}): Promise<AICoachAdvice> {
  const aiProvider = await getSetting<AIProvider>('aiProvider', 'openrouter');
  const openRouterKey = await getSetting<string>('openRouterApiKey', '');
  const openRouterModel = await getSetting<string>('openRouterModel', DEFAULT_OPENROUTER_MODEL);
  const groqApiKey = await getSetting<string>('groqApiKey', '');
  const groqModel = await getSetting<string>('groqModel', DEFAULT_GROQ_MODEL);
  const apiKey = await getSetting<string>('geminiApiKey', '');
  const modelName = await getSetting<string>('geminiModel', 'gemini-2.5-flash');

  const coachPrompt = `You are Manni's Deep Financial Coach. Analyze this user's anonymized spending summary for ${summary.periodLabel}:
- Currency: ${summary.currency}
- Total Spent: ${summary.totalSpent.toFixed(2)} (Monthly Budget Target: ${summary.monthlyBudget.toFixed(2)})
- Weekend vs Weekday Daily Spend Ratio: ${summary.weekendVsWeekdayRatio.toFixed(2)}x
- Category Breakdown: ${JSON.stringify(summary.categoryTotals)}
- Top Merchants: ${JSON.stringify(summary.topMerchants)}

Return a JSON object with:
{
  "headline": "A motivating, specific 1-sentence headline",
  "habitBreakdown": ["3 bullet points with concrete numbers"],
  "savingTips": [
    { "title": "Short title", "estimatedMonthlySavings": "e.g. EUR 45/mo", "action": "Concrete tip" }
  ]
}
Include exactly 3 savingTips.`;

  if (aiProvider === 'openrouter' && openRouterKey.trim().length > 10) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openRouterKey.trim()}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Manni Expense Tracker',
        },
        body: JSON.stringify({
          model: openRouterModel || DEFAULT_OPENROUTER_MODEL,
          temperature: 0.3,
          messages: [{ role: 'user', content: coachPrompt }],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const raw: string = data?.choices?.[0]?.message?.content || '{}';
        const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
        const parsed = JSON.parse(cleaned);
        if (parsed.headline && Array.isArray(parsed.savingTips)) {
          return {
            headline: parsed.headline,
            habitBreakdown: parsed.habitBreakdown || [],
            savingTips: parsed.savingTips.slice(0, 3),
            source: 'openrouter',
          };
        }
      }
    } catch (err) {
      console.warn('OpenRouter coach fallback:', err);
    }
  }

  if ((aiProvider === 'groq' || apiKey.trim().startsWith('gsk_')) && (groqApiKey.trim() || apiKey.trim()).length > 10) {
    try {
      const keyToUse = groqApiKey.trim() || apiKey.trim();
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${keyToUse}`,
        },
        body: JSON.stringify({
          model: groqModel || DEFAULT_GROQ_MODEL,
          temperature: 0.3,
          response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: coachPrompt }],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const parsed = JSON.parse(data?.choices?.[0]?.message?.content || '{}');
        if (parsed.headline && Array.isArray(parsed.savingTips)) {
          return {
            headline: parsed.headline,
            habitBreakdown: parsed.habitBreakdown || [],
            savingTips: parsed.savingTips.slice(0, 3),
            source: 'groq',
          };
        }
      }
    } catch (err) {
      console.warn('Groq coach fallback:', err);
    }
  }

  if (apiKey && apiKey.trim().length > 10 && !apiKey.trim().startsWith('gsk_')) {
    try {
      const { client } = createGeminiClient(apiKey);
      const response = await client.models.generateContent({
        model: modelName || 'gemini-2.5-flash',
        contents: coachPrompt,
        config: { responseMimeType: 'application/json', temperature: 0.3 },
      });
      const parsed = JSON.parse(response.text || '{}');
      if (parsed.headline && Array.isArray(parsed.savingTips)) {
        return {
          headline: parsed.headline,
          habitBreakdown: parsed.habitBreakdown || [],
          savingTips: parsed.savingTips.slice(0, 3),
          source: 'gemini',
        };
      }
    } catch (err) {
      console.warn('Gemini coach fallback:', err);
    }
  }

  const topCat = summary.categoryTotals[0];
  const secondCat = summary.categoryTotals[1];
  const topMerch = summary.topMerchants[0];
  const cur = summary.currency;
  const diningAndFood = summary.categoryTotals.find((c) => c.category === 'Food & Drink');
  const groceries = summary.categoryTotals.find((c) => c.category === 'Groceries');
  const shopping = summary.categoryTotals.find((c) => c.category === 'Shopping');

  return {
    headline: topCat
      ? `${topCat.category} leads your spending at ${topCat.percentage.toFixed(0)}% of your ${summary.periodLabel.toLowerCase()} outflow.`
      : 'Your spending is well-tracked — here is your personalized savings roadmap.',
    habitBreakdown: [
      topCat
        ? `Your #1 category is ${topCat.category} (${cur} ${topCat.amount.toFixed(2)}), accounting for ${topCat.percentage.toFixed(1)}% of total spend.`
        : 'Add more categorized expenses to unlock deeper category trends.',
      summary.weekendVsWeekdayRatio > 1.25
        ? `You spend ${summary.weekendVsWeekdayRatio.toFixed(1)}x more per day on weekends than on weekdays.`
        : `Your weekday and weekend spending pace is balanced (${summary.weekendVsWeekdayRatio.toFixed(1)}x ratio).`,
      topMerch
        ? `Your top merchant is ${topMerch.merchant} (${cur} ${topMerch.amount.toFixed(2)} across ${topMerch.count} visit${topMerch.count > 1 ? 's' : ''}).`
        : 'Track merchant names on receipts to spot recurring store habits.',
    ],
    savingTips: [
      {
        title: diningAndFood
          ? 'Trim Impulse Dining & Coffee Runs by 25%'
          : `Set a Weekly Cap on ${topCat?.category || 'Discretionary Spend'}`,
        estimatedMonthlySavings: `${cur} ${Math.max(25, (diningAndFood?.amount || topCat?.amount || 120) * 0.25).toFixed(0)}/mo`,
        action: diningAndFood
          ? `You spent ${cur} ${diningAndFood.amount.toFixed(2)} on Food & Drink. Swapping 2 restaurant/cafe orders per week for home prep saves ~25% immediately.`
          : `Cap your weekly ${topCat?.category || 'top category'} spend at ${cur} ${(((topCat?.amount || 200) * 0.8) / 4).toFixed(0)} to stay comfortably below budget.`,
      },
      {
        title: groceries
          ? 'Consolidate Grocery Trips & Check Itemized Prices'
          : 'Use the 48-Hour Rule for Non-Essential Purchases',
        estimatedMonthlySavings: `${cur} ${Math.max(20, (groceries?.amount || secondCat?.amount || 140) * 0.15).toFixed(0)}/mo`,
        action: groceries
          ? `Review your itemized grocery receipts in Manni — consolidating into 1 planned weekly basket typically cuts impulse add-ons by 15%.`
          : `Waiting 48 hours before completing non-essential purchases reduces impulse checkout totals by 15-20%.`,
      },
      {
        title:
          summary.weekendVsWeekdayRatio > 1.3
            ? 'Pre-Budget Your Weekend Spend Every Friday'
            : 'Automate Savings Before Discretionary Shopping',
        estimatedMonthlySavings: `${cur} ${Math.max(30, (shopping?.amount || summary.totalSpent * 0.1) * 0.3).toFixed(0)}/mo`,
        action:
          summary.weekendVsWeekdayRatio > 1.3
            ? `Since your weekend spend is ${summary.weekendVsWeekdayRatio.toFixed(1)}x higher than weekdays, setting a fixed Friday-to-Sunday allowance prevents budget creep.`
            : `Set aside 10% of your monthly income right on payday and track category sub-budgets in Settings.`,
      },
    ],
    source: 'local_smart_coach',
  };
}
