import React, { useMemo, useState } from 'react';
import {
  X,
  Delete,
  Check,
  Calendar,
  Store,
  FileText,
  ImagePlus,
  Calculator,
  RotateCcw,
} from 'lucide-react';
import {
  db,
  SPENDEE_CATEGORIES,
  CATEGORY_META,
  CURRENCY_SYMBOLS,
  formatCurrency,
  type SpendeeCategory,
  type Transaction,
} from '../db/db';
import { compressImageToDataUrl } from '../utils/imageCompression';
import { CategoryIcon } from './CategoryIcon';

interface ManualEntryModalProps {
  currency: string;
  transactions: Transaction[];
  onClose: () => void;
  onSaved: (tx: Transaction) => void;
}

interface RecurringSuggestion {
  merchant: string;
  amount: number;
  category: SpendeeCategory;
  type: 'expense' | 'income';
  note: string;
  count: number;
}

export const ManualEntryModal: React.FC<ManualEntryModalProps> = ({
  currency,
  transactions,
  onClose,
  onSaved,
}) => {
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [amountInput, setAmountInput] = useState('');
  const [category, setCategory] = useState<SpendeeCategory>('Food & Drink');
  const [merchant, setMerchant] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');
  const [receiptDataUrl, setReceiptDataUrl] = useState<string | undefined>();
  const [showKeypad, setShowKeypad] = useState(false);
  const [merchantFocused, setMerchantFocused] = useState(false);

  const currencySymbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;

  // Build smart recurring suggestions from past transactions (merchant + typical price + category)
  const recurringSuggestions = useMemo<RecurringSuggestion[]>(() => {
    const map = new Map<string, RecurringSuggestion & { latestAt: number }>();
    for (const tx of transactions) {
      const cleanName = tx.merchant.trim();
      if (!cleanName) continue;
      const key = cleanName.toLowerCase();
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          merchant: cleanName,
          amount: tx.amount,
          category: tx.category,
          type: tx.type,
          note: tx.note,
          count: 1,
          latestAt: tx.createdAt,
        });
      } else {
        existing.count += 1;
        if (tx.createdAt > existing.latestAt) {
          existing.amount = tx.amount;
          existing.category = tx.category;
          existing.type = tx.type;
          existing.note = tx.note;
          existing.latestAt = tx.createdAt;
        }
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => b.count - a.count || b.latestAt - a.latestAt
    );
  }, [transactions]);

  const filteredSuggestions = useMemo(() => {
    const q = merchant.trim().toLowerCase();
    if (!q) return recurringSuggestions.slice(0, 5);
    return recurringSuggestions
      .filter(
        (s) =>
          s.merchant.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q) ||
          s.note.toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [merchant, recurringSuggestions]);

  const applySuggestion = (s: RecurringSuggestion) => {
    setMerchant(s.merchant);
    setAmountInput(s.amount.toFixed(2));
    setCategory(s.category);
    setType(s.type);
    if (s.note) setNote(s.note);
    setMerchantFocused(false);
  };

  // Safely evaluate simple calculator expressions (+, -, *, /)
  const evaluateExpression = (expr: string): number => {
    try {
      const normalized = expr.replace(/,/g, '.').replace(/[^0-9.+\-*/]/g, '');
      if (!normalized) return 0;
      const tokens = normalized.match(/(\d+\.?\d*|\.\d+|[+\-*/])/g);
      if (!tokens || tokens.length === 0) return 0;

      let total = parseFloat(tokens[0]) || 0;
      for (let i = 1; i < tokens.length; i += 2) {
        const op = tokens[i];
        const nextVal = parseFloat(tokens[i + 1]);
        if (Number.isNaN(nextVal)) break;
        if (op === '+') total += nextVal;
        else if (op === '-') total -= nextVal;
        else if (op === '*') total *= nextVal;
        else if (op === '/' && nextVal !== 0) total /= nextVal;
      }
      return Math.max(0, Number(total.toFixed(2)));
    } catch {
      return 0;
    }
  };

  const numericAmount = useMemo(() => evaluateExpression(amountInput), [amountInput]);

  const handleKeyPress = (key: string) => {
    if (key === 'C') {
      setAmountInput('');
      return;
    }
    if (key === '⌫') {
      setAmountInput((prev) => prev.slice(0, -1));
      return;
    }
    if (key === '=') {
      const val = evaluateExpression(amountInput);
      setAmountInput(val > 0 ? String(val) : '');
      return;
    }
    setAmountInput((prev) => prev + key);
  };

  const handleAttachPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImageToDataUrl(file, 1200, 0.78);
    setReceiptDataUrl(compressed);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalAmount = evaluateExpression(amountInput);
    if (finalAmount <= 0) return;

    const finalCategory: SpendeeCategory =
      type === 'income' && category !== 'Income' ? 'Income' : category;

    const newTx: Transaction = {
      id: crypto.randomUUID(),
      type,
      amount: finalAmount,
      currency,
      category: finalCategory,
      merchant: merchant.trim() || finalCategory,
      date,
      createdAt: Date.now(),
      note: note.trim() || `${finalCategory} entry`,
      lineItems: [
        {
          name: note.trim() || merchant.trim() || finalCategory,
          quantity: 1,
          unitPrice: finalAmount,
          totalPrice: finalAmount,
        },
      ],
      receiptImageDataUrl: receiptDataUrl,
      source: 'manual',
      syncStatus: 'local_only',
    };

    await db.transactions.put(newTx);
    onSaved(newTx);
    onClose();
  };

  const categoriesToShow = useMemo(
    () =>
      SPENDEE_CATEGORIES.filter((c) =>
        type === 'income' ? c === 'Income' || c === 'Other' : c !== 'Income'
      ),
    [type]
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => {
                setType('expense');
                if (category === 'Income') setCategory('Food & Drink');
              }}
              className={`px-3.5 py-1.5 rounded-md transition cursor-pointer ${
                type === 'expense'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Expense
            </button>
            <button
              type="button"
              onClick={() => {
                setType('income');
                setCategory('Income');
              }}
              className={`px-3.5 py-1.5 rounded-md transition cursor-pointer ${
                type === 'income'
                  ? 'bg-white text-emerald-700 shadow-2xs font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Income
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Merchant Input with Smart Recurring Suggestions (Name + Price + Category) */}
          <div className="relative">
            <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-slate-400" />
              <span>Merchant or Recurring Transaction</span>
            </label>
            <input
              type="text"
              value={merchant}
              onFocus={() => setMerchantFocused(true)}
              onBlur={() => setTimeout(() => setMerchantFocused(false), 160)}
              onChange={(e) => {
                setMerchant(e.target.value);
                setMerchantFocused(true);
              }}
              placeholder="Start typing (e.g. Lidl, Rent, Coffee)..."
              autoFocus
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 transition"
            />

            {/* Live Autocomplete Suggestions with Price */}
            {merchantFocused && filteredSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1.5 z-20 bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden">
                <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 text-[11px] font-medium text-slate-500 flex items-center gap-1.5">
                  <RotateCcw className="w-3 h-3" />
                  <span>Suggestions (tap to auto-fill price & category)</span>
                </div>
                <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
                  {filteredSuggestions.map((s) => (
                    <button
                      key={s.merchant}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        applySuggestion(s);
                      }}
                      className="w-full px-3 py-2 flex items-center justify-between gap-2 hover:bg-slate-50 text-left transition cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`w-7 h-7 rounded-lg ${CATEGORY_META[s.category].bgLight} ${CATEGORY_META[s.category].textColor} flex items-center justify-center shrink-0`}
                        >
                          <CategoryIcon category={s.category} className="w-3.5 h-3.5" />
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-900 truncate">
                            {s.merchant}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {s.category} • used {s.count}×
                          </div>
                        </div>
                      </div>
                      <span className="text-xs font-semibold tabular-nums text-slate-800 shrink-0">
                        {formatCurrency(s.amount, currency)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Quick-Tap Frequent Recurring Pills (when merchant is empty) */}
          {!merchant && recurringSuggestions.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              <span className="text-[11px] font-medium text-slate-400 shrink-0">Quick fill:</span>
              {recurringSuggestions.slice(0, 4).map((s) => (
                <button
                  key={s.merchant}
                  type="button"
                  onClick={() => applySuggestion(s)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200/80 text-xs text-slate-700 font-medium shrink-0 transition cursor-pointer"
                >
                  <span className="truncate max-w-[110px]">{s.merchant}</span>
                  <span className="text-slate-500 tabular-nums">
                    {formatCurrency(s.amount, currency)}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Clean Amount Input (Keypad hidden by default!) */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-500">
                Amount ({currency})
              </label>
              <button
                type="button"
                onClick={() => setShowKeypad((k) => !k)}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                <Calculator className="w-3.5 h-3.5" />
                <span>{showKeypad ? 'Hide calculator' : 'Calculator'}</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <span
                className={`text-2xl font-semibold ${
                  type === 'income' ? 'text-emerald-600' : 'text-slate-900'
                }`}
              >
                {type === 'income' ? '+' : ''}
                {currencySymbol}
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder="0.00"
                required
                className="w-full text-3xl font-bold tabular-nums text-slate-900 bg-transparent focus:outline-none placeholder:text-slate-300"
              />
            </div>

            {amountInput &&
              /[+\-*/]/.test(amountInput) &&
              numericAmount > 0 && (
                <div className="text-xs text-slate-500 mt-1 tabular-nums">
                  = {formatCurrency(numericAmount, currency)}
                </div>
              )}
          </div>

          {/* Optional Calculator Keypad (Hidden by Default) */}
          {showKeypad && (
            <div className="grid grid-cols-4 gap-1.5">
              {['7', '8', '9', '+', '4', '5', '6', '-', '1', '2', '3', '*', '.', '0', '⌫', '='].map(
                (key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleKeyPress(key)}
                    className={`py-2 rounded-lg font-semibold text-sm transition active:scale-95 cursor-pointer ${
                      ['+', '-', '*', '='].includes(key)
                        ? 'bg-slate-200 text-slate-900 hover:bg-slate-300'
                        : key === '⌫'
                        ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 flex items-center justify-center'
                        : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                    }`}
                  >
                    {key === '⌫' ? <Delete className="w-4 h-4 mx-auto" /> : key}
                  </button>
                )
              )}
            </div>
          )}

          {/* Category Grid */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">
              Category
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
              {categoriesToShow.map((cat) => {
                const meta = CATEGORY_META[cat];
                const selected = category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border text-xs font-medium transition cursor-pointer ${
                      selected
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                        selected ? 'bg-white/15 text-white' : `${meta.bgLight} ${meta.textColor}`
                      }`}
                    >
                      <CategoryIcon category={cat} className="w-3.5 h-3.5" />
                    </span>
                    <span className="truncate">{cat}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date, Note & Optional Receipt Attachment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Date</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span>Note</span>
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional details..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 cursor-pointer transition">
              <ImagePlus className="w-4 h-4 text-slate-500" />
              <span>{receiptDataUrl ? 'Receipt photo attached' : 'Attach receipt photo'}</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleAttachPhoto}
                className="hidden"
              />
            </label>

            <button
              type="submit"
              disabled={numericAmount <= 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-semibold text-sm shadow-xs transition cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>
                Save {numericAmount > 0 ? formatCurrency(numericAmount, currency) : ''}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
