/**
 * Isolated Stage 3: Groq Structured JSON Receipt Parser (src/services/groqReceiptParser.ts)
 * Can parse either directly from raw OCR text (for fast text LLMs like openai/gpt-oss-120b)
 * or directly from an image (when using a vision-capable Groq model).
 */
import { SPENDEE_CATEGORIES, normalizeCategory, type LineItem, type SpendeeCategory } from '../db/db';

export const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b';

export interface GroqParsedReceipt {
  merchant: string;
  date: string;
  currency: string;
  totalAmount: number;
  taxAmount?: number;
  category: SpendeeCategory;
  summaryNote: string;
  lineItems: LineItem[];
  modelUsed: string;
  modeUsed: 'vision' | 'ocr_to_llm';
  durationMs: number;
  rawJson: string;
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

export function isLikelyVisionModel(modelName: string): boolean {
  return /vision|scout|maverick|llava|pixtral|vl|4o|gemini/i.test(modelName);
}

/**
 * Fetches live active chat/vision models directly from the user's Groq account.
 */
export async function fetchGroqModels(apiKey: string): Promise<string[]> {
  const trimmed = apiKey.trim();
  if (!trimmed) return [];

  const res = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { Authorization: `Bearer ${trimmed}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to list Groq models (${res.status})`);
  }

  const data = (await res.json()) as {
    data?: Array<{ id: string; active?: boolean }>;
  };

  return (data.data || [])
    .filter((m) => m.active !== false)
    .map((m) => m.id)
    .filter(
      (id) => !/whisper|tts|guard|prompt-guard|orpheus|playai|distil-whisper/i.test(id)
    )
    .sort((a, b) => {
      const score = (s: string) =>
        s === 'openai/gpt-oss-120b'
          ? 0
          : s.includes('gpt-oss')
          ? 1
          : s.includes('vision') || s.includes('scout')
          ? 2
          : 3;
      return score(a) - score(b) || a.localeCompare(b);
    });
}

/**
 * Verifies a Groq API key live and returns available models on that account.
 */
export async function testGroqApiKey(
  apiKey: string,
  modelName = DEFAULT_GROQ_MODEL
): Promise<{ ok: boolean; provider: string; message: string; availableModels?: string[] }> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    return { ok: false, provider: 'Groq', message: 'Groq API key is empty.' };
  }

  let availableModels: string[] = [];
  try {
    availableModels = await fetchGroqModels(trimmed);
  } catch {
    // continue
  }

  const targetModel = (modelName || DEFAULT_GROQ_MODEL).trim();

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${trimmed}`,
      },
      body: JSON.stringify({
        model: targetModel,
        messages: [{ role: 'user', content: 'Reply with OK' }],
        max_tokens: 10,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      const hint =
        availableModels.length > 0
          ? ` Active models on your key: ${availableModels.slice(0, 5).join(', ')}.`
          : '';
      return {
        ok: false,
        provider: 'Groq',
        availableModels,
        message: `Groq rejected "${targetModel}" (${res.status}): ${errBody.slice(0, 140)}${hint}`,
      };
    }

    return {
      ok: true,
      provider: 'Groq',
      availableModels,
      message: `Connected successfully via Groq (${targetModel}).${
        availableModels.length > 0 ? ` Loaded ${availableModels.length} live models.` : ''
      }`,
    };
  } catch (err) {
    return {
      ok: false,
      provider: 'Groq',
      availableModels,
      message: `Network error connecting to Groq: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Isolated Stage 3: Takes raw OCR text (or optional image for vision models) and asks Groq
 * for a strict structured JSON receipt object.
 */
export async function parseReceiptTextWithGroq(params: {
  rawOcrText?: string;
  imageDataUrl?: string;
  apiKey: string;
  modelName?: string;
  defaultCurrency?: string;
}): Promise<GroqParsedReceipt> {
  const start = performance.now();
  const today = todayISO();
  const defaultCurrency = params.defaultCurrency || 'EUR';
  const targetModel = (params.modelName || DEFAULT_GROQ_MODEL).trim();

  const systemPrompt = `You are a precise receipt extraction engine. Return ONLY a valid JSON object matching this exact structure:
{
  "merchant": "Store or restaurant name",
  "date": "YYYY-MM-DD (fallback to ${today} if illegible)",
  "currency": "3-letter ISO code like EUR, USD, GBP (default ${defaultCurrency})",
  "totalAmount": 0.00,
  "taxAmount": 0.00,
  "category": "One of: ${SPENDEE_CATEGORIES.join(', ')}",
  "summaryNote": "Short 3-6 word summary of what was bought",
  "lineItems": [
    { "name": "Item name", "quantity": 1, "unitPrice": 0.00, "totalPrice": 0.00 }
  ]
}
Handle European/German receipts (Lidl, Aldi, REWE, etc.) where commas are decimal separators (44,50 = 44.50) and total may be labeled SUMME, zu zahlen, Kartenzahlung, or TOTAL. Fix minor OCR spelling mistakes in item names.`;

  const callGroq = async (messages: unknown[]) =>
    fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: targetModel,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages,
      }),
    });

  let res: Response | null = null;
  let modeUsed: 'vision' | 'ocr_to_llm' = 'ocr_to_llm';

  if (params.imageDataUrl && isLikelyVisionModel(targetModel)) {
    const visionRes = await callGroq([
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Extract all receipt fields and line items into the required JSON object.' },
          { type: 'image_url', image_url: { url: params.imageDataUrl } },
        ],
      },
    ]);
    if (visionRes.ok) {
      res = visionRes;
      modeUsed = 'vision';
    } else if (visionRes.status !== 400) {
      const errText = await visionRes.text();
      throw new Error(`Groq API error (${visionRes.status}): ${errText.slice(0, 180)}`);
    }
  }

  if (!res) {
    res = await callGroq([
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Extract all receipt fields and line items from this raw receipt OCR text into the required JSON object:\n\n${
          params.rawOcrText || ''
        }`,
      },
    ]);
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Groq API error (${res.status}): ${errText.slice(0, 180)}`);
    }
  }

  const data = await res.json();
  const content: string = data?.choices?.[0]?.message?.content || '{}';
  const cleanedJson = content.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  const parsed = JSON.parse(cleanedJson);

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

  const computedTotalFromItems = lineItems.reduce((acc, item) => acc + item.totalPrice, 0);
  const totalAmount =
    Number(parsed.totalAmount) > 0
      ? Number(parsed.totalAmount)
      : Number(computedTotalFromItems.toFixed(2));

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
        : [
            {
              name: String(parsed.merchant || 'Receipt Purchase'),
              quantity: 1,
              unitPrice: totalAmount,
              totalPrice: totalAmount,
            },
          ],
    modelUsed: targetModel,
    modeUsed,
    durationMs: Math.round(performance.now() - start),
    rawJson: cleanedJson,
  };
}
