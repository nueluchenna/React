import Dexie, { type EntityTable } from 'dexie';

export type SpendeeCategory =
  | 'Groceries'
  | 'Food & Drink'
  | 'Transport'
  | 'Shopping'
  | 'Housing'
  | 'Utilities'
  | 'Entertainment'
  | 'Health'
  | 'Travel'
  | 'Income'
  | 'Other';

export const SPENDEE_CATEGORIES: SpendeeCategory[] = [
  'Groceries',
  'Food & Drink',
  'Transport',
  'Shopping',
  'Housing',
  'Utilities',
  'Entertainment',
  'Health',
  'Travel',
  'Income',
  'Other',
];

export interface CategoryMeta {
  name: SpendeeCategory;
  color: string;
  bgLight: string;
  textColor: string;
  borderColor: string;
  emoji: string;
  type: 'expense' | 'income' | 'both';
}

export const CATEGORY_META: Record<SpendeeCategory, CategoryMeta> = {
  Groceries: {
    name: 'Groceries',
    color: '#10b981',
    bgLight: 'bg-emerald-50',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-200',
    emoji: '🛒',
    type: 'expense',
  },
  'Food & Drink': {
    name: 'Food & Drink',
    color: '#f59e0b',
    bgLight: 'bg-amber-50',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-200',
    emoji: '🍽️',
    type: 'expense',
  },
  Transport: {
    name: 'Transport',
    color: '#3b82f6',
    bgLight: 'bg-blue-50',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200',
    emoji: '🚆',
    type: 'expense',
  },
  Shopping: {
    name: 'Shopping',
    color: '#ec4899',
    bgLight: 'bg-pink-50',
    textColor: 'text-pink-700',
    borderColor: 'border-pink-200',
    emoji: '🛍️',
    type: 'expense',
  },
  Housing: {
    name: 'Housing',
    color: '#6366f1',
    bgLight: 'bg-indigo-50',
    textColor: 'text-indigo-700',
    borderColor: 'border-indigo-200',
    emoji: '🏠',
    type: 'expense',
  },
  Utilities: {
    name: 'Utilities',
    color: '#06b6d4',
    bgLight: 'bg-cyan-50',
    textColor: 'text-cyan-700',
    borderColor: 'border-cyan-200',
    emoji: '⚡',
    type: 'expense',
  },
  Entertainment: {
    name: 'Entertainment',
    color: '#8b5cf6',
    bgLight: 'bg-violet-50',
    textColor: 'text-violet-700',
    borderColor: 'border-violet-200',
    emoji: '🎬',
    type: 'expense',
  },
  Health: {
    name: 'Health',
    color: '#ef4444',
    bgLight: 'bg-rose-50',
    textColor: 'text-rose-700',
    borderColor: 'border-rose-200',
    emoji: '💊',
    type: 'expense',
  },
  Travel: {
    name: 'Travel',
    color: '#14b8a6',
    bgLight: 'bg-teal-50',
    textColor: 'text-teal-700',
    borderColor: 'border-teal-200',
    emoji: '✈️',
    type: 'expense',
  },
  Income: {
    name: 'Income',
    color: '#059669',
    bgLight: 'bg-emerald-100',
    textColor: 'text-emerald-800',
    borderColor: 'border-emerald-300',
    emoji: '💰',
    type: 'income',
  },
  Other: {
    name: 'Other',
    color: '#64748b',
    bgLight: 'bg-slate-100',
    textColor: 'text-slate-700',
    borderColor: 'border-slate-200',
    emoji: '📦',
    type: 'both',
  },
};

export interface LineItem {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  category?: string;
}

export interface Transaction {
  id: string;
  type: 'expense' | 'income';
  amount: number;
  taxAmount?: number;
  currency: string;
  category: SpendeeCategory;
  merchant: string;
  date: string; // ISO YYYY-MM-DD
  createdAt: number;
  note: string;
  lineItems: LineItem[];
  receiptImageDataUrl?: string;
  source: 'manual' | 'ai_receipt' | 'csv_import';
  syncStatus: 'local_only' | 'pending_ai' | 'synced';
}

export interface PendingReceipt {
  id: string;
  imageDataUrl: string;
  createdAt: number;
  status: 'queued' | 'processing' | 'failed';
  errorMessage?: string;
  fileName?: string;
}

export interface Budget {
  id: string;
  category: SpendeeCategory | 'ALL';
  monthlyLimit: number;
}

export interface AppSetting {
  key: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any;
}

export const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: '€',
  USD: '$',
  GBP: '£',
  CHF: 'CHF ',
  CAD: 'CA$',
  AUD: 'A$',
  JPY: '¥',
};

export function formatCurrency(amount: number, currency = 'EUR'): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  const formatted = Math.abs(amount).toLocaleString(undefined, {
    minimumFractionDigits: currency === 'JPY' ? 0 : 2,
    maximumFractionDigits: currency === 'JPY' ? 0 : 2,
  });
  return amount < 0 ? `-${symbol}${formatted}` : `${symbol}${formatted}`;
}

export function normalizeCategory(raw?: string): SpendeeCategory {
  if (!raw) return 'Other';
  const cleaned = raw.trim().toLowerCase();
  for (const cat of SPENDEE_CATEGORIES) {
    if (cat.toLowerCase() === cleaned) return cat;
  }
  if (cleaned.includes('grocer') || cleaned.includes('supermarket') || cleaned.includes('market'))
    return 'Groceries';
  if (
    cleaned.includes('food') ||
    cleaned.includes('drink') ||
    cleaned.includes('restaurant') ||
    cleaned.includes('cafe') ||
    cleaned.includes('coffee') ||
    cleaned.includes('dining')
  )
    return 'Food & Drink';
  if (
    cleaned.includes('transport') ||
    cleaned.includes('uber') ||
    cleaned.includes('taxi') ||
    cleaned.includes('fuel') ||
    cleaned.includes('gas') ||
    cleaned.includes('train') ||
    cleaned.includes('transit')
  )
    return 'Transport';
  if (cleaned.includes('shop') || cleaned.includes('cloth') || cleaned.includes('retail'))
    return 'Shopping';
  if (cleaned.includes('rent') || cleaned.includes('hous') || cleaned.includes('home'))
    return 'Housing';
  if (
    cleaned.includes('util') ||
    cleaned.includes('electric') ||
    cleaned.includes('water') ||
    cleaned.includes('internet') ||
    cleaned.includes('phone')
  )
    return 'Utilities';
  if (cleaned.includes('entertain') || cleaned.includes('movie') || cleaned.includes('game'))
    return 'Entertainment';
  if (cleaned.includes('health') || cleaned.includes('pharm') || cleaned.includes('doctor'))
    return 'Health';
  if (cleaned.includes('travel') || cleaned.includes('hotel') || cleaned.includes('flight'))
    return 'Travel';
  if (cleaned.includes('income') || cleaned.includes('salary') || cleaned.includes('pay'))
    return 'Income';
  return 'Other';
}

const db = new Dexie('SpendeeAIDB') as Dexie & {
  transactions: EntityTable<Transaction, 'id'>;
  pendingReceipts: EntityTable<PendingReceipt, 'id'>;
  budgets: EntityTable<Budget, 'id'>;
  settings: EntityTable<AppSetting, 'key'>;
};

db.version(1).stores({
  transactions: 'id, type, amount, currency, category, merchant, date, createdAt, source, syncStatus',
  pendingReceipts: 'id, createdAt, status',
  budgets: 'id, category, monthlyLimit',
  settings: 'key',
});

// LocalStorage + IndexedDB settings helpers
export const LS_KEYS = {
  AI_PROVIDER: 'spendeeai_ai_provider',
  OPENROUTER_API_KEY: 'spendeeai_openrouter_api_key',
  OPENROUTER_MODEL: 'spendeeai_openrouter_model',
  GEMINI_API_KEY: 'spendeeai_gemini_api_key',
  GEMINI_MODEL: 'spendeeai_gemini_model',
  GROQ_API_KEY: 'spendeeai_groq_api_key',
  GROQ_MODEL: 'spendeeai_groq_model',
  DEFAULT_CURRENCY: 'spendeeai_default_currency',
  MONTHLY_BUDGET: 'spendeeai_monthly_budget',
};

export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  try {
    const rec = await db.settings.get(key);
    if (rec && rec.value !== undefined && rec.value !== null) {
      return rec.value as T;
    }
  } catch {
    // ignore
  }
  const lsMap: Record<string, string> = {
    aiProvider: LS_KEYS.AI_PROVIDER,
    openRouterApiKey: LS_KEYS.OPENROUTER_API_KEY,
    openRouterModel: LS_KEYS.OPENROUTER_MODEL,
    geminiApiKey: LS_KEYS.GEMINI_API_KEY,
    geminiModel: LS_KEYS.GEMINI_MODEL,
    groqApiKey: LS_KEYS.GROQ_API_KEY,
    groqModel: LS_KEYS.GROQ_MODEL,
  };
  if (lsMap[key]) {
    const ls = localStorage.getItem(lsMap[key]);
    if (ls) return ls as unknown as T;
  }
  return defaultValue;
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  await db.settings.put({ key, value });
  const lsMap: Record<string, string> = {
    aiProvider: LS_KEYS.AI_PROVIDER,
    openRouterApiKey: LS_KEYS.OPENROUTER_API_KEY,
    openRouterModel: LS_KEYS.OPENROUTER_MODEL,
    geminiApiKey: LS_KEYS.GEMINI_API_KEY,
    geminiModel: LS_KEYS.GEMINI_MODEL,
    groqApiKey: LS_KEYS.GROQ_API_KEY,
    groqModel: LS_KEYS.GROQ_MODEL,
  };
  if (lsMap[key]) {
    if (value) {
      localStorage.setItem(lsMap[key], String(value));
    } else {
      localStorage.removeItem(lsMap[key]);
    }
  }
}

export { db };
