/**
 * Isolated Stage 2: Regex Heuristic Receipt Parser (src/services/regexReceiptParser.ts)
 * Pure function that parses raw OCR text into structured receipt fields without any network calls.
 */
import type { LineItem, SpendeeCategory } from '../db/db';

export interface RegexParsedReceipt {
  merchant: string;
  date: string;
  currency: string;
  totalAmount: number;
  taxAmount?: number;
  category: SpendeeCategory;
  summaryNote: string;
  lineItems: LineItem[];
  durationMs: number;
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function parseLocalizedNumber(raw: string): number {
  const cleaned = raw.replace(/\s+/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : 0;
}

export function parseOCRTextWithRegex(
  rawText: string,
  defaultCurrency = 'EUR'
): RegexParsedReceipt {
  const start = performance.now();

  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 1);

  // 1. Detect Currency
  let currency = defaultCurrency;
  if (rawText.includes('€') || /\bEUR\b/i.test(rawText)) currency = 'EUR';
  else if (rawText.includes('£') || /\bGBP\b/i.test(rawText)) currency = 'GBP';
  else if (rawText.includes('$') || /\bUSD\b/i.test(rawText)) currency = 'USD';

  // 2. Detect Merchant Name
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

  // 3. Detect Date
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

  // 4. Extract Line Items & Total Amount
  const lineItems: LineItem[] = [];
  let explicitTotal = 0;
  let taxAmount: number | undefined;

  const totalRegex =
    /\b(zu\s*zahlen|summe|gesamt(?:betrag)?|total|amount\s*due|grand\s*total|kartenzahlung|ec-karte|visa|mastercard|bezahlt|bar)\b[^0-9]*?(\d{1,5}[.,]\d{2})\b/i;
  const taxRegex = /\b(tax|vat|mwst|ust|tva|gst|steuer)\b[^0-9]*?(\d{1,4}[.,]\d{2})\b/i;
  const linePriceRegex = /^(.+?)\s+[€$£]?(-?\d{1,4}[.,]\d{2})\s*[A-Z*]?$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const tMatch = line.match(totalRegex);
    if (tMatch) {
      const val = parseLocalizedNumber(tMatch[2]);
      if (val > explicitTotal) explicitTotal = val;
      continue;
    }

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

  // 5. Category inference
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
    durationMs: Math.round(performance.now() - start),
  };
}
