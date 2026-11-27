/**
 * Isolated OpenRouter Vision Receipt Parser (src/services/openRouterReceiptParser.ts)
 * Uses OpenRouter's zero-credit-card free tier (`openrouter/free` smart vision router
 * or any live `:free` vision model) to read receipt pixels directly.
 */
import {
  SPENDEE_CATEGORIES,
  normalizeCategory,
  type LineItem,
  type SpendeeCategory,
} from '../db/db';

export const DEFAULT_OPENROUTER_MODEL = 'openrouter/free';

export interface OpenRouterParsedReceipt {
  merchant: string;
  date: string;
  currency: string;
  totalAmount: number;
  taxAmount?: number;
  category: SpendeeCategory;
  summaryNote: string;
  lineItems: LineItem[];
  modelUsed: string;
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

function extractJsonObject(raw: string): string {
  const stripped = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  const firstBrace = stripped.indexOf('{');
  const lastBrace = stripped.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return stripped.slice(firstBrace, lastBrace + 1);
  }
  return stripped;
}

/**
 * Fetches live `:free` vision-capable models from OpenRouter's public catalog.
 */
export async function fetchOpenRouterFreeVisionModels(): Promise<string[]> {
  const res = await fetch('https://openrouter.ai/api/v1/models');
  if (!res.ok) {
    throw new Error(`Failed to load OpenRouter models (${res.status})`);
  }

  const data = (await res.json()) as {
    data?: Array<{
      id: string;
      architecture?: {
        modality?: string;
        input_modalities?: string[];
      };
    }>;
  };

  const freeVision = (data.data || [])
    .filter((m) => {
      const isFree = m.id.endsWith(':free') || m.id === 'openrouter/free';
      const modalities = m.architecture?.input_modalities || [];
      const modalityStr = m.architecture?.modality || '';
      const hasVision =
        modalities.includes('image') || /image/i.test(modalityStr);
      return isFree && hasVision;
    })
    .map((m) => m.id)
    .sort((a, b) => a.localeCompare(b));

  return [DEFAULT_OPENROUTER_MODEL, ...freeVision.filter((m) => m !== DEFAULT_OPENROUTER_MODEL)];
}

/**
 * Live OpenRouter API Key verification helper for Settings
 */
export async function testOpenRouterApiKey(
  apiKey: string,
  modelName = DEFAULT_OPENROUTER_MODEL
): Promise<{ ok: boolean; provider: string; message: string; availableModels?: string[] }> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    return { ok: false, provider: 'OpenRouter', message: 'OpenRouter API key is empty.' };
  }

  let availableModels: string[] = [DEFAULT_OPENROUTER_MODEL];
  try {
    availableModels = await fetchOpenRouterFreeVisionModels();
  } catch {
    // keep default
  }

  const targetModel = (modelName || DEFAULT_OPENROUTER_MODEL).trim();

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${trimmed}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Manni Expense Tracker',
      },
      body: JSON.stringify({
        model: targetModel,
        messages: [{ role: 'user', content: 'Reply with OK' }],
        max_tokens: 16,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      return {
        ok: false,
        provider: 'OpenRouter',
        availableModels,
        message: `OpenRouter rejected "${targetModel}" (${res.status}): ${errBody.slice(0, 180)}`,
      };
    }

    const body = await res.json();
    const routedModel = body?.model || targetModel;

    return {
      ok: true,
      provider: 'OpenRouter',
      availableModels,
      message: `Connected via OpenRouter (${routedModel}). Loaded ${availableModels.length} free vision option(s).`,
    };
  } catch (err) {
    return {
      ok: false,
      provider: 'OpenRouter',
      availableModels,
      message: `Network error connecting to OpenRouter: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }
}

/**
 * Direct Multimodal Vision Receipt Extraction via OpenRouter (`openrouter/free` or any `:free` VL model).
 * Sends the actual receipt pixels directly so paper bleed-through & wrinkles don't break extraction.
 */
export async function parseReceiptWithOpenRouter(params: {
  imageDataUrl: string;
  apiKey: string;
  modelName?: string;
  defaultCurrency?: string;
}): Promise<OpenRouterParsedReceipt> {
  const start = performance.now();
  const today = todayISO();
  const defaultCurrency = params.defaultCurrency || 'EUR';
  const targetModel = (params.modelName || DEFAULT_OPENROUTER_MODEL).trim();

  const systemPrompt = `You are a precise multimodal receipt extraction engine. Look directly at the receipt image (ignoring any faint logo or QR code bleeding through from the back of the paper) and return ONLY a valid JSON object matching this exact structure:
{
  "merchant": "Store or restaurant name (never a street address or city)",
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
CRITICAL RULES:
1. Supermarkets (Lidl, Aldi, Aldi Süd, REWE, EDEKA, Kaufland, Netto, Penny, Carrefour, Tesco, BioMarkt, etc.) MUST ALWAYS be categorized as "Groceries" (never "Shopping" or "Food & Drink").
2. Recognize brand logos at the top (e.g., LIDL, ALDI) or cues like "Lidl Plus" / "LDL-". Never use a street address (Str., Straße, postal code) as the merchant name.
3. European receipts use commas as decimal separators (49,22 = 49.22) and totals may be labeled "zu zahlen", "Summe", "ALDI PREIS", "Kreditkarte", "Kartenzahlung", or "TOTAL".
4. Parse multi-quantity items accurately (e.g. "Speisequark 0%  1,19 x 4  4,76 A" -> quantity: 4, unitPrice: 1.19, totalPrice: 4.76).
5. Strip leading 5-6 digit product/SKU numbers from item names. NEVER invent fake "Miscellaneous" filler items.
6. Return ONLY raw JSON with no markdown fences or commentary.`;

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.apiKey.trim()}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Manni Expense Tracker',
    },
    body: JSON.stringify({
      model: targetModel,
      temperature: 0.1,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract all receipt fields and itemized line items from this receipt photo into the required JSON object.',
            },
            {
              type: 'image_url',
              image_url: { url: params.imageDataUrl },
            },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter API error (${res.status}): ${errText.slice(0, 180)}`);
  }

  const data = await res.json();
  const content: string = data?.choices?.[0]?.message?.content || '{}';
  const cleanedJson = extractJsonObject(content);
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
        : [
            {
              name: String(parsed.merchant || 'Receipt Purchase'),
              quantity: 1,
              unitPrice: totalAmount,
              totalPrice: totalAmount,
            },
          ],
    modelUsed: data?.model || targetModel,
    durationMs: Math.round(performance.now() - start),
    rawJson: cleanedJson,
  };
}
