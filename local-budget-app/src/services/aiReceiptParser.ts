import { GoogleGenAI } from '@google/genai';
import {
  SPENDEE_CATEGORIES,
  normalizeCategory,
  getSetting,
  type SpendeeCategory,
  type LineItem,
} from '../db/db';
import { extractBase64Payload } from '../utils/imageCompression';

export type AIProvider = 'groq' | 'gemini';

export interface ExtractedReceiptData {
  merchant: string;
  date: string; // YYYY-MM-DD
  currency: string;
  totalAmount: number;
  taxAmount?: number;
  category: SpendeeCategory;
  summaryNote: string;
  lineItems: LineItem[];
  extractionEngine: 'gemini' | 'groq' | 'tesseract_fallback';
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
  source: 'gemini' | 'groq' | 'local_smart_coach';
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function sanitizeDateISO(raw?: string): string {
  if (!raw) return todayISO();
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  return todayISO();
}

/**
 * Creates a GoogleGenAI client supporting BOTH:
 * - Google AI Studio keys (AIza...) -> standard Gemini Developer API
 * - Vertex AI Express Mode keys (AQ....) -> vertexai: true
 */
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

/**
 * Live API Key verification helper for Settings
 */
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
    if (res.text) {
      return {
        ok: true,
        provider: providerLabel,
        message: `Connected successfully via ${providerLabel} (${modelName}).`,
      };
    }
    return {
      ok: true,
      provider: providerLabel,
      message: `Connected via ${providerLabel}.`,
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

export const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b';

/**
 * Fetches live active chat/vision models directly from the user's Groq account
 * so the model dropdown never gets stuck on deprecated IDs.
 */
export async function fetchGroqModels(apiKey: string): Promise<string[]> {
  const trimmed = apiKey.trim();
  if (!trimmed) return [];

  const res = await fetch('https://api.groq.com/openai/v1/models', {
    headers: {
      Authorization: `Bearer ${trimmed}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to list Groq models (${res.status})`);
  }

  const data = (await res.json()) as {
    data?: Array<{ id: string; active?: boolean }>;
  };

  const models = (data.data || [])
    .filter((m) => m.active !== false)
    .map((m) => m.id)
    .filter(
      (id) =>
        !/whisper|tts|guard|prompt-guard|orpheus|playai|distil-whisper/i.test(id)
    )
    .sort((a, b) => {
      // Prioritize gpt-oss and llama-4 vision models at top
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

  return models;
}

/**
 * Live Groq API Key verification helper for Settings
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
    // Continue to chat completion test to get exact error
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

function isLikelyVisionModel(modelName: string): boolean {
  return /vision|scout|maverick|llava|pixtral|vl|4o|gemini/i.test(modelName);
}

/**
 * Groq Structured JSON Receipt Extraction
 * - For multimodal vision models: sends the compressed receipt image directly.
 * - For text-only fast models (like openai/gpt-oss-120b) or if vision is unsupported:
 *   extracts raw text via in-browser Tesseract.js and lets Groq LLM parse messy European/Lidl OCR text into strict JSON.
 */
export async function parseReceiptWithGroq(
  imageDataUrl: string,
  apiKey: string,
  modelName = DEFAULT_GROQ_MODEL,
  defaultCurrency = 'EUR',
  onProgress?: (progress: number) => void
): Promise<ExtractedReceiptData> {
  const today = todayISO();
  const targetModel = (modelName || DEFAULT_GROQ_MODEL).trim();

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

  const callGroqWithMessages = async (messages: unknown[]) => {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: targetModel,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages,
      }),
    });
    return res;
  };

  let res: Response | null = null;

  // 1. Try direct multimodal image input if the selected model is a vision model
  if (isLikelyVisionModel(targetModel)) {
    const visionRes = await callGroqWithMessages([
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Extract all receipt fields and line items into the required JSON object.',
          },
          {
            type: 'image_url',
            image_url: { url: imageDataUrl },
          },
        ],
      },
    ]);

    if (visionRes.ok) {
      res = visionRes;
    } else if (visionRes.status !== 400) {
      const errText = await visionRes.text();
      throw new Error(`Groq API error (${visionRes.status}): ${errText.slice(0, 180)}`);
    }
    // If 400 (model doesn't support image_url), fall through to OCR -> Groq LLM below!
  }

  // 2. OCR -> Groq Structured JSON (works with openai/gpt-oss-120b, openai/gpt-oss-20b, qwen, etc.)
  if (!res) {
    const Tesseract = await import('tesseract.js');
    const ocrResult = await Tesseract.recognize(imageDataUrl, 'eng', {
      logger: (m) => {
        if (m.status === 'recognizing text' && typeof m.progress === 'number' && onProgress) {
          onProgress(Math.round(m.progress * 100));
        }
      },
    });
    const rawOcrText = ocrResult.data.text || '';

    res = await callGroqWithMessages([
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Extract all receipt fields and line items from this raw receipt OCR text into the required JSON object:\n\n${rawOcrText}`,
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
    currency: String(parsed.currency || defaultCurrency)
      .toUpperCase()
      .slice(0, 3),
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
    extractionEngine: 'groq',
  };
}

/**
 * 1. Gemini Flash Structured Output Mode (Primary)
 * Direct client-side @google/genai call using Google AI Studio (AIza...) or Vertex AI Express (AQ...) key.
 * Uses responseMimeType: "application/json" and a strict JSON schema.
 */
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
      merchant: {
        type: 'string',
        description: 'Store, restaurant, or merchant name on the receipt',
      },
      date: {
        type: 'string',
        description: `Receipt date in YYYY-MM-DD format. Fallback to ${today} if illegible.`,
      },
      currency: {
        type: 'string',
        description: `3-letter ISO currency code such as EUR, USD, GBP. Default to ${defaultCurrency} if not shown.`,
      },
      totalAmount: {
        type: 'number',
        description: 'Final total amount paid on the receipt (SUMME / zu zahlen / TOTAL)',
      },
      taxAmount: {
        type: 'number',
        description: 'Total tax or VAT/MwSt amount if shown on the receipt (0 if not shown)',
      },
      category: {
        type: 'string',
        enum: SPENDEE_CATEGORIES,
        description: 'Best matching Spendee expense category',
      },
      summaryNote: {
        type: 'string',
        description: 'Short 3-6 word summary of what was bought',
      },
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
            text: `Analyze this receipt image (may be in English, German, French, or another European language like Lidl, Aldi, Rewe, etc.) and extract the structured financial data.
- Today's date is ${today}. If the receipt date is missing or unclear, use ${today}.
- Look carefully for the final paid total (e.g., "SUMME", "zu zahlen", "Kartenzahlung", "TOTAL", "Amount Due"). Note that European receipts use commas as decimal separators (e.g. 44,50 = 44.50).
- Map category strictly to one of: ${SPENDEE_CATEGORIES.join(', ')}.
- Extract every visible line item with its quantity, unitPrice, and totalPrice.
- Provide a concise 3-6 word summaryNote describing the purchase.`,
          },
          {
            inlineData: {
              data: base64,
              mimeType,
            },
          },
        ],
      },
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema,
      temperature: 0.1,
    },
  });

  const rawText = response.text || '{}';
  const parsed = JSON.parse(rawText);

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
    currency: String(parsed.currency || defaultCurrency)
      .toUpperCase()
      .slice(0, 3),
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
    extractionEngine: 'gemini',
  };
}

/**
 * 2. Keyless / Offline Smart Fallback (tesseract.js + Regex Heuristic Parser)
 * Improved to handle European/German/Lidl receipts (SUMME, zu zahlen, comma decimals like 44,50)
 * and never invents a fake 12.50 total.
 */
export async function parseReceiptWithLocalOCR(
  imageDataUrl: string,
  defaultCurrency = 'EUR',
  onProgress?: (progress: number) => void,
  fallbackReason?: string
): Promise<ExtractedReceiptData> {
  const Tesseract = await import('tesseract.js');
  const result = await Tesseract.recognize(imageDataUrl, 'eng', {
    logger: (m) => {
      if (m.status === 'recognizing text' && typeof m.progress === 'number' && onProgress) {
        onProgress(Math.round(m.progress * 100));
      }
    },
  });

  const text = result.data.text || '';
  const parsed = parseOCRTextHeuristically(text, defaultCurrency);
  return { ...parsed, fallbackReason };
}

function parseLocalizedNumber(raw: string): number {
  const cleaned = raw.replace(/\s+/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : 0;
}

export function parseOCRTextHeuristically(
  rawText: string,
  defaultCurrency = 'EUR'
): ExtractedReceiptData {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 1);

  // 1. Detect Currency
  let currency = defaultCurrency;
  if (rawText.includes('€') || /\bEUR\b/i.test(rawText)) currency = 'EUR';
  else if (rawText.includes('£') || /\bGBP\b/i.test(rawText)) currency = 'GBP';
  else if (rawText.includes('$') || /\bUSD\b/i.test(rawText)) currency = 'USD';

  // 2. Detect Merchant Name (check known supermarkets first, then top header lines)
  let merchant = 'Scanned Receipt';
  const knownMerchants = [
    { pattern: /\blidl\b/i, name: 'Lidl' },
    { pattern: /\baldi\b/i, name: 'Aldi' },
    { pattern: /\brewe\b/i, name: 'REWE' },
    { pattern: /\bedeka\b/i, name: 'EDEKA' },
    { pattern: /\bkaufland\b/i, name: 'Kaufland' },
    { pattern: /\bpenny\b/i, name: 'Penny' },
    { pattern: /\bnetto\b/i, name: 'Netto' },
    { pattern: /\bdm[\s-]?drogerie/i, name: 'dm-drogerie markt' },
    { pattern: /\brossmann\b/i, name: 'Rossmann' },
    { pattern: /\bcarrefour\b/i, name: 'Carrefour' },
    { pattern: /\btesco\b/i, name: 'Tesco' },
    { pattern: /\bikea\b/i, name: 'IKEA' },
    { pattern: /\bstarbucks\b/i, name: 'Starbucks' },
  ];

  const knownMatch = knownMerchants.find((m) => m.pattern.test(rawText));
  if (knownMatch) {
    merchant = knownMatch.name;
  } else {
    for (const line of lines.slice(0, 6)) {
      const clean = line.replace(/[^a-zA-Z0-9\s&'.-]/g, '').trim();
      if (
        clean.length >= 3 &&
        !/^(date|datum|time|zeit|receipt|bon|beleg|tel|phone|tax|vat|mwst|ust|invoice|welcome|thank|eur)/i.test(
          clean
        ) &&
        !/^\d+$/.test(clean)
      ) {
        merchant = clean
          .split(/\s+/)
          .slice(0, 4)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ');
        break;
      }
    }
  }

  // 3. Detect Date (YYYY-MM-DD, DD.MM.YYYY, DD/MM/YYYY, DD.MM.YY)
  let date = todayISO();
  const isoMatch = rawText.match(/\b(20\d{2})[-/.](0[1-9]|1[0-2])[-/.](0[1-9]|[12]\d|3[01])\b/);
  const dmyMatch = rawText.match(
    /\b(0?[1-9]|[12]\d|3[01])[./-](0?[1-9]|1[0-2])[./-](20\d{2}|\d{2})\b/
  );
  if (isoMatch) {
    date = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  } else if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3].length === 2 ? `20${dmyMatch[3]}` : dmyMatch[3];
    date = `${year}-${month}-${day}`;
  }

  // 4. Extract Line Items & Total Amount (supports German/European receipts like Lidl)
  const lineItems: LineItem[] = [];
  let explicitTotal = 0;
  let taxAmount: number | undefined;

  const totalRegex =
    /\b(zu\s*zahlen|summe|gesamt(?:betrag)?|total|amount\s*due|grand\s*total|kartenzahlung|ec-karte|visa|mastercard|bezahlt|bar)\b[^0-9]*?(\d{1,5}[.,]\d{2})\b/i;
  const taxRegex = /\b(tax|vat|mwst|ust|tva|gst|steuer)\b[^0-9]*?(\d{1,4}[.,]\d{2})\b/i;
  // Matches item lines like "Vollmilch 3,5%   1,29 A" or "Bananen   2.45"
  const linePriceRegex = /^(.+?)\s+[€$£]?(-?\d{1,4}[.,]\d{2})\s*[A-Z*]?$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const tMatch = line.match(totalRegex);
    if (tMatch) {
      const val = parseLocalizedNumber(tMatch[2]);
      if (val > explicitTotal) explicitTotal = val;
      continue;
    }

    // Sometimes "ZU ZAHLEN" or "SUMME" is on one line and the number is on the very next line
    if (/^(zu\s*zahlen|summe|gesamt|total)\b/i.test(line) && i + 1 < lines.length) {
      const nextNum = lines[i + 1].match(/(\d{1,5}[.,]\d{2})/);
      if (nextNum) {
        const val = parseLocalizedNumber(nextNum[1]);
        if (val > explicitTotal) explicitTotal = val;
        continue;
      }
    }

    const vatMatch = line.match(taxRegex);
    if (vatMatch) {
      const val = parseLocalizedNumber(vatMatch[2]);
      if (val > 0) taxAmount = val;
      continue;
    }

    const itemMatch = line.match(linePriceRegex);
    if (itemMatch) {
      const rawName = itemMatch[1].replace(/[.*_=-]{2,}/g, ' ').trim();
      const price = parseLocalizedNumber(itemMatch[2]);
      if (
        rawName.length >= 2 &&
        price > 0 &&
        price < 5000 &&
        !/\b(subtotal|sub-total|zwischensumme|rückgeld|rueckgeld|change|gegeben|cash|visa|mastercard|card|tendered|rabatt|discount|pfand\s*zurück|brutto|netto|mwst)\b/i.test(
          rawName
        )
      ) {
        const qtyPrefix = rawName.match(/^(\d+)\s*[xX*]\s*(.+)$/);
        if (qtyPrefix) {
          const qty = Math.max(1, parseInt(qtyPrefix[1], 10));
          lineItems.push({
            name: qtyPrefix[2].trim(),
            quantity: qty,
            unitPrice: Number((price / qty).toFixed(2)),
            totalPrice: price,
          });
        } else {
          lineItems.push({
            name: rawName,
            quantity: 1,
            unitPrice: price,
            totalPrice: price,
          });
        }
      }
    }
  }

  // Fallback: largest price in receipt (ignoring timestamps/barcodes)
  if (explicitTotal <= 0) {
    const allPrices = [...rawText.matchAll(/(?:^|[\s€$£])(\d{1,4}[.,]\d{2})(?:\s*[A-Z]?$|\s)/gm)]
      .map((m) => parseLocalizedNumber(m[1]))
      .filter((n) => n > 0 && n < 10000);
    if (allPrices.length > 0) {
      explicitTotal = Math.max(...allPrices);
    }
  }

  const itemsSum = lineItems.reduce((acc, i) => acc + i.totalPrice, 0);
  const totalAmount =
    explicitTotal > 0 ? explicitTotal : itemsSum > 0 ? Number(itemsSum.toFixed(2)) : 0;

  // 5. Infer category
  const combinedLower = `${merchant} ${rawText}`.toLowerCase();
  let category: SpendeeCategory = 'Other';
  if (
    /market|grocer|lidl|aldi|tesco|rewe|edeka|kaufland|penny|netto|carrefour|whole foods|organic|milk|milch|bread|brot|egg|fruit|obst|gemüse/i.test(
      combinedLower
    )
  ) {
    category = 'Groceries';
  } else if (
    /cafe|coffee|restaurant|bistro|pizza|burger|bakery|bäcker|bar|kitchen|grill|tea|latte|espresso/i.test(
      combinedLower
    )
  ) {
    category = 'Food & Drink';
  } else if (
    /uber|bolt|taxi|metro|train|rail|bahn|bus|fuel|tankstelle|shell|aral|bp|parking|transit|ticket/i.test(
      combinedLower
    )
  ) {
    category = 'Transport';
  } else if (
    /pharm|apotheke|dm-drogerie|rossmann|health|clinic|medical|dental|vitamin/i.test(combinedLower)
  ) {
    category = 'Health';
  } else if (/cinema|kino|movie|theater|museum|concert|netflix|spotify/i.test(combinedLower)) {
    category = 'Entertainment';
  } else if (/hotel|airbnb|flight|airline|booking/i.test(combinedLower)) {
    category = 'Travel';
  } else if (/uniqlo|zara|h&m|ikea|amazon|store|shop|apparel/i.test(combinedLower)) {
    category = 'Shopping';
  }

  const finalItems =
    lineItems.length > 0
      ? lineItems
      : [
          {
            name: `${merchant} Receipt`,
            quantity: 1,
            unitPrice: totalAmount,
            totalPrice: totalAmount,
          },
        ];

  const summaryNote =
    lineItems.length > 0
      ? lineItems
          .slice(0, 2)
          .map((i) => i.name)
          .join(', ')
          .slice(0, 42)
      : `Scanned receipt at ${merchant}`;

  return {
    merchant,
    date,
    currency,
    totalAmount,
    taxAmount,
    category,
    summaryNote,
    lineItems: finalItems,
    extractionEngine: 'tesseract_fallback',
  };
}

/**
 * Unified Dual-Mode Entry Point:
 * Uses Gemini Structured Output if an API key is configured; surfaces exact reason if fallback happens.
 */
export async function extractReceiptSmart(
  imageDataUrl: string,
  options?: {
    forceLocalOCR?: boolean;
    onProgress?: (progress: number) => void;
  }
): Promise<ExtractedReceiptData> {
  const aiProvider = await getSetting<AIProvider>('aiProvider', 'gemini');
  const groqApiKey = await getSetting<string>('groqApiKey', '');
  const groqModel = await getSetting<string>('groqModel', DEFAULT_GROQ_MODEL);
  const geminiApiKey = await getSetting<string>('geminiApiKey', '');
  const geminiModel = await getSetting<string>('geminiModel', 'gemini-2.5-flash');
  const defaultCurrency = await getSetting<string>('defaultCurrency', 'EUR');

  if (!options?.forceLocalOCR) {
    // Auto-route to Groq if Groq is selected OR if a gsk_ key is configured
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
        console.warn('Groq receipt extraction failed, falling back to local OCR:', reason);
        return await parseReceiptWithLocalOCR(
          imageDataUrl,
          defaultCurrency,
          options?.onProgress,
          reason
        );
      }
    }

    if (geminiApiKey && geminiApiKey.trim().length > 10) {
      try {
        return await parseReceiptWithGemini(
          imageDataUrl,
          geminiApiKey.trim(),
          geminiModel,
          defaultCurrency
        );
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        console.warn('Gemini receipt extraction failed, falling back to local OCR:', reason);
        return await parseReceiptWithLocalOCR(
          imageDataUrl,
          defaultCurrency,
          options?.onProgress,
          reason
        );
      }
    }

    // Fallback: if user selected Gemini without a Gemini key, still try Groq if they saved one
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
        return await parseReceiptWithLocalOCR(
          imageDataUrl,
          defaultCurrency,
          options?.onProgress,
          reason
        );
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

/**
 * AI Deep Financial Coach for Analytics Dashboard
 */
export async function generateAIFinancialCoachAdvice(summary: {
  periodLabel: string;
  currency: string;
  totalSpent: number;
  monthlyBudget: number;
  categoryTotals: Array<{ category: string; amount: number; percentage: number }>;
  topMerchants: Array<{ merchant: string; amount: number; count: number }>;
  weekendVsWeekdayRatio: number;
}): Promise<AICoachAdvice> {
  const aiProvider = await getSetting<AIProvider>('aiProvider', 'gemini');
  const groqApiKey = await getSetting<string>('groqApiKey', '');
  const groqModel = await getSetting<string>('groqModel', DEFAULT_GROQ_MODEL);
  const apiKey = await getSetting<string>('geminiApiKey', '');
  const modelName = await getSetting<string>('geminiModel', 'gemini-2.5-flash');

  const coachPrompt = `You are SpendeeAI's Deep Financial Coach. Analyze this user's anonymized spending summary for ${summary.periodLabel}:
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
      const responseSchema = {
        type: 'object',
        properties: {
          headline: { type: 'string' },
          habitBreakdown: {
            type: 'array',
            items: { type: 'string' },
          },
          savingTips: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                estimatedMonthlySavings: { type: 'string' },
                action: { type: 'string' },
              },
              required: ['title', 'estimatedMonthlySavings', 'action'],
            },
          },
        },
        required: ['headline', 'habitBreakdown', 'savingTips'],
      };

      const response = await client.models.generateContent({
        model: modelName || 'gemini-2.5-flash',
        contents: coachPrompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema,
          temperature: 0.3,
        },
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
      console.warn('Gemini coach fallback to local smart coach:', err);
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
          ? `Review your itemized grocery receipts in SpendeeAI — consolidating into 1 planned weekly basket typically cuts impulse add-ons by 15%.`
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
