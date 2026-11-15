import { GoogleGenAI } from '@google/genai';
import {
  SPENDEE_CATEGORIES,
  normalizeCategory,
  getSetting,
  type SpendeeCategory,
  type LineItem,
} from '../db/db';
import { extractBase64Payload } from '../utils/imageCompression';

export interface ExtractedReceiptData {
  merchant: string;
  date: string; // YYYY-MM-DD
  currency: string;
  totalAmount: number;
  taxAmount?: number;
  category: SpendeeCategory;
  summaryNote: string;
  lineItems: LineItem[];
  extractionEngine: 'gemini' | 'tesseract_fallback';
}

export interface AICoachAdvice {
  headline: string;
  habitBreakdown: string[];
  savingTips: Array<{
    title: string;
    estimatedMonthlySavings: string;
    action: string;
  }>;
  source: 'gemini' | 'local_smart_coach';
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
 * 1. Gemini Flash Structured Output Mode (Primary)
 * Direct client-side @google/genai call using free-tier Google AI Studio API Key.
 * Uses responseMimeType: "application/json" and a strict JSON schema.
 */
export async function parseReceiptWithGemini(
  imageDataUrl: string,
  apiKey: string,
  modelName = 'gemini-2.5-flash',
  defaultCurrency = 'EUR'
): Promise<ExtractedReceiptData> {
  const client = new GoogleGenAI({ apiKey });
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
        description: 'Final total amount paid on the receipt',
      },
      taxAmount: {
        type: 'number',
        description: 'Total tax or VAT amount if shown on the receipt (0 if not shown)',
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
            text: `Analyze this receipt image and extract the structured financial data.
- Today's date is ${today}. If the receipt date is missing or unclear, use ${today}.
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
 * Runs free in-browser OCR via tesseract.js and applies regex heuristics to extract
 * merchant name, date, currency, line items, and total amount with zero API key setup.
 */
export async function parseReceiptWithLocalOCR(
  imageDataUrl: string,
  defaultCurrency = 'EUR',
  onProgress?: (progress: number) => void
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
  return parseOCRTextHeuristically(text, defaultCurrency);
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

  // 2. Detect Merchant Name (first meaningful non-date, non-numeric header line)
  let merchant = 'Scanned Receipt';
  for (const line of lines.slice(0, 6)) {
    const clean = line.replace(/[^a-zA-Z0-9\s&'.-]/g, '').trim();
    if (
      clean.length >= 3 &&
      !/^(date|time|receipt|tel|phone|tax|vat|invoice|welcome|thank)/i.test(clean) &&
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

  // 3. Detect Date (YYYY-MM-DD, DD/MM/YYYY, DD.MM.YYYY, MM/DD/YYYY)
  let date = todayISO();
  const isoMatch = rawText.match(/\b(20\d{2})[-/.](0[1-9]|1[0-2])[-/.](0[1-9]|[12]\d|3[01])\b/);
  const dmyMatch = rawText.match(/\b(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.](20\d{2}|\d{2})\b/);
  if (isoMatch) {
    date = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  } else if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3].length === 2 ? `20${dmyMatch[3]}` : dmyMatch[3];
    date = `${year}-${month}-${day}`;
  }

  // 4. Extract Line Items & Total Amount
  const lineItems: LineItem[] = [];
  let explicitTotal = 0;
  let taxAmount: number | undefined;

  const totalRegex = /\b(total|amount\s*due|grand\s*total|summe|gesamt|balance|to\s*pay)\b.*?(\d+[.,]\d{2})\b/i;
  const taxRegex = /\b(tax|vat|mwst|tva|gst)\b.*?(\d+[.,]\d{2})\b/i;
  const linePriceRegex = /^(.+?)\s+[€$£]?(\d+[.,]\d{2})\s*[A-Z]?$/;

  for (const line of lines) {
    const tMatch = line.match(totalRegex);
    if (tMatch) {
      const val = parseFloat(tMatch[2].replace(',', '.'));
      if (val > explicitTotal) explicitTotal = val;
      continue;
    }

    const vatMatch = line.match(taxRegex);
    if (vatMatch) {
      const val = parseFloat(vatMatch[2].replace(',', '.'));
      if (val > 0) taxAmount = val;
      continue;
    }

    const itemMatch = line.match(linePriceRegex);
    if (itemMatch) {
      const rawName = itemMatch[1].replace(/[.*_=-]{2,}/g, ' ').trim();
      const price = parseFloat(itemMatch[2].replace(',', '.'));
      if (
        rawName.length >= 2 &&
        price > 0 &&
        price < 10000 &&
        !/\b(subtotal|sub-total|change|cash|visa|mastercard|card|tendered|discount)\b/i.test(rawName)
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

  // Fallback: find the largest currency number in the receipt if explicit total wasn't matched
  if (explicitTotal <= 0) {
    const allPrices = [...rawText.matchAll(/(\d+[.,]\d{2})/g)]
      .map((m) => parseFloat(m[1].replace(',', '.')))
      .filter((n) => !Number.isNaN(n) && n > 0 && n < 25000);
    if (allPrices.length > 0) {
      explicitTotal = Math.max(...allPrices);
    }
  }

  const itemsSum = lineItems.reduce((acc, i) => acc + i.totalPrice, 0);
  const totalAmount = explicitTotal > 0 ? explicitTotal : Number(itemsSum.toFixed(2)) || 12.5;

  // 5. Infer category from merchant + OCR text keywords
  const combinedLower = `${merchant} ${rawText}`.toLowerCase();
  let category: SpendeeCategory = 'Other';
  if (/market|grocer|lidl|aldi|tesco|rewe|edeka|carrefour|whole foods|organic|milk|bread|egg|fruit/i.test(combinedLower)) {
    category = 'Groceries';
  } else if (/cafe|coffee|restaurant|bistro|pizza|burger|bakery|bar|kitchen|grill|tea|latte|espresso/i.test(combinedLower)) {
    category = 'Food & Drink';
  } else if (/uber|bolt|taxi|metro|train|rail|bus|fuel|shell|bp|parking|transit|ticket/i.test(combinedLower)) {
    category = 'Transport';
  } else if (/pharm|apotheke|health|clinic|medical|dental|vitamin/i.test(combinedLower)) {
    category = 'Health';
  } else if (/cinema|movie|theater|museum|concert|netflix|spotify/i.test(combinedLower)) {
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
 * Uses Gemini Structured Output if an API key is configured; otherwise falls back automatically
 * to Keyless In-Browser OCR (tesseract.js + Regex Heuristic Parser).
 */
export async function extractReceiptSmart(
  imageDataUrl: string,
  options?: {
    forceLocalOCR?: boolean;
    onProgress?: (progress: number) => void;
  }
): Promise<ExtractedReceiptData> {
  const apiKey = await getSetting<string>('geminiApiKey', '');
  const modelName = await getSetting<string>('geminiModel', 'gemini-2.5-flash');
  const defaultCurrency = await getSetting<string>('defaultCurrency', 'EUR');

  if (!options?.forceLocalOCR && apiKey && apiKey.trim().length > 10) {
    try {
      return await parseReceiptWithGemini(
        imageDataUrl,
        apiKey.trim(),
        modelName,
        defaultCurrency
      );
    } catch (err) {
      console.warn('Gemini receipt extraction failed, falling back to local Tesseract OCR:', err);
      return await parseReceiptWithLocalOCR(imageDataUrl, defaultCurrency, options?.onProgress);
    }
  }

  return await parseReceiptWithLocalOCR(imageDataUrl, defaultCurrency, options?.onProgress);
}

/**
 * AI Deep Financial Coach for Analytics Dashboard
 * Sends anonymized category & merchant totals to Gemini (or generates smart local coaching if no key is configured).
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
  const apiKey = await getSetting<string>('geminiApiKey', '');
  const modelName = await getSetting<string>('geminiModel', 'gemini-2.5-flash');

  if (apiKey && apiKey.trim().length > 10) {
    try {
      const client = new GoogleGenAI({ apiKey: apiKey.trim() });
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

      const prompt = `You are SpendeeAI's Deep Financial Coach. Analyze this user's anonymized spending summary for ${summary.periodLabel}:
- Currency: ${summary.currency}
- Total Spent: ${summary.totalSpent.toFixed(2)} (Monthly Budget Target: ${summary.monthlyBudget.toFixed(2)})
- Weekend vs Weekday Daily Spend Ratio: ${summary.weekendVsWeekdayRatio.toFixed(2)}x
- Category Breakdown: ${JSON.stringify(summary.categoryTotals)}
- Top Merchants: ${JSON.stringify(summary.topMerchants)}

Provide:
1. A motivating, specific 1-sentence headline.
2. 3 bullet points breaking down their spending habits with concrete numbers.
3. Exactly 3 concrete, actionable ways to save money next month with estimated monthly savings in ${summary.currency}.`;

      const response = await client.models.generateContent({
        model: modelName || 'gemini-2.5-flash',
        contents: prompt,
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

  // Local Smart Financial Coach fallback (works 100% offline & keyless)
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
        ? `You spend ${summary.weekendVsWeekdayRatio.toFixed(1)}x more per day on weekends than on weekdays — mostly driven by leisure and dining.`
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
        estimatedMonthlySavings: `${cur} ${Math.max(25, ((diningAndFood?.amount || topCat?.amount || 120) * 0.25)).toFixed(0)}/mo`,
        action: diningAndFood
          ? `You spent ${cur} ${diningAndFood.amount.toFixed(2)} on Food & Drink. Swapping 2 restaurant/cafe orders per week for home prep saves ~25% immediately.`
          : `Cap your weekly ${topCat?.category || 'top category'} spend at ${cur} ${(((topCat?.amount || 200) * 0.8) / 4).toFixed(0)} to stay comfortably below budget.`,
      },
      {
        title: groceries
          ? 'Consolidate Grocery Trips & Use Line-Item Price Checks'
          : 'Use the 48-Hour Rule for Non-Essential Purchases',
        estimatedMonthlySavings: `${cur} ${Math.max(20, ((groceries?.amount || secondCat?.amount || 140) * 0.15)).toFixed(0)}/mo`,
        action: groceries
          ? `Review your itemized grocery receipts in SpendeeAI — consolidating into 1 planned weekly basket typically cuts impulse add-ons by 15%.`
          : `Waiting 48 hours before completing non-essential purchases reduces impulse checkout totals by 15-20%.`,
      },
      {
        title:
          summary.weekendVsWeekdayRatio > 1.3
            ? 'Pre-Budget Your Weekend Spend Every Friday'
            : 'Automate Savings Before Discretionary Shopping',
        estimatedMonthlySavings: `${cur} ${Math.max(30, ((shopping?.amount || summary.totalSpent * 0.1) * 0.3)).toFixed(0)}/mo`,
        action:
          summary.weekendVsWeekdayRatio > 1.3
            ? `Since your weekend spend is ${summary.weekendVsWeekdayRatio.toFixed(1)}x higher than weekdays, setting a fixed Friday-to-Sunday allowance prevents end-of-month budget creep.`
            : `Set aside 10% of your monthly income right on payday and track category sub-budgets in Settings.`,
      },
    ],
    source: 'local_smart_coach',
  };
}
