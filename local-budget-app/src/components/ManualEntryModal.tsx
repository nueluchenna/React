import React, { useMemo, useRef, useState } from 'react';
import {
  X,
  Delete,
  Calendar,
  Store,
  FileText,
  ImagePlus,
  Calculator,
  RotateCcw,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import {
  db,
  SPENDEE_CATEGORIES,
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const submitLockRef = useRef(false);

  const currencySymbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;

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
    setFormError(null);
  };

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
    setFormError(null);
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
    const compressed = await compressImageToDataUrl(file, 1400, 0.82);
    setReceiptDataUrl(compressed);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitLockRef.current || isSubmitting) return;

    const finalAmount = evaluateExpression(amountInput);
    if (finalAmount <= 0) {
      setFormError('Enter an amount greater than 0.00 before saving.');
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);
    setFormError(null);

    try {
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
    } catch (err) {
      submitLockRef.current = false;
      setIsSubmitting(false);
      setFormError(err instanceof Error ? err.message : 'Failed to save transaction.');
    }
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
      className="fixed inset-0 z-50 bg-[#0B1221]/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Segmented Pill Switch */}
        <div className="px-6 pt-5 pb-4 flex items-center justify-between">
          <div className="inline-flex rounded-full bg-[#EBF0F5] p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setType('expense');
                if (category === 'Income') setCategory('Food & Drink');
              }}
              className={`px-4 py-1.5 rounded-full transition cursor-pointer ${
                type === 'expense'
                  ? 'bg-white text-[#0B1221] shadow-2xs'
                  : 'text-[#526077] hover:text-[#0B1221]'
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
              className={`px-4 py-1.5 rounded-full transition cursor-pointer ${
                type === 'income'
                  ? 'bg-white text-[#0D9488] shadow-2xs'
                  : 'text-[#526077] hover:text-[#0B1221]'
              }`}
            >
              Income
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 rounded-full bg-[#EBF0F5] hover:bg-[#E1E8F0] text-[#0B1221] flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 pb-6 space-y-5">
          {/* Amount Input First so user immediately enters the figure */}
          <div className="p-5 rounded-3xl bg-[#F4F6F9]">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-[#526077]">
                Amount ({currency})
              </label>
              <button
                type="button"
                onClick={() => setShowKeypad((k) => !k)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] hover:opacity-75 cursor-pointer"
              >
                <Calculator className="w-3.5 h-3.5" />
                <span>{showKeypad ? 'Hide keypad' : 'Calculator'}</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <span
                className={`text-3xl font-display font-bold ${
                  type === 'income' ? 'text-[#0D9488]' : 'text-[#0B1221]'
                }`}
              >
                {type === 'income' ? '+' : ''}
                {currencySymbol}
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={amountInput}
                onChange={(e) => {
                  setAmountInput(e.target.value);
                  setFormError(null);
                }}
                placeholder="0.00"
                autoFocus
                className="w-full text-4xl font-display font-extrabold tabular-nums text-[#0B1221] bg-transparent focus:outline-none placeholder:text-[#94A3B8]"
              />
            </div>

            {amountInput && /[+\-*/]/.test(amountInput) && numericAmount > 0 && (
              <div className="text-xs text-[#526077] mt-1.5 tabular-nums font-medium">
                = {formatCurrency(numericAmount, currency)}
              </div>
            )}
          </div>

          {formError && (
            <div className="p-3 rounded-2xl bg-[#FEE2E2] text-xs text-[#BE123C] flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {showKeypad && (
            <div className="grid grid-cols-4 gap-2">
              {['7', '8', '9', '+', '4', '5', '6', '-', '1', '2', '3', '*', '.', '0', '⌫', '='].map(
                (key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleKeyPress(key)}
                    className={`py-2.5 rounded-2xl font-semibold text-sm transition active:scale-95 cursor-pointer ${
                      ['+', '-', '*', '='].includes(key)
                        ? 'bg-[#0B1221] text-white'
                        : key === '⌫'
                        ? 'bg-[#FEE2E2] text-[#BE123C] flex items-center justify-center'
                        : 'bg-[#F4F6F9] text-[#0B1221] hover:bg-[#E9EEF5]'
                    }`}
                  >
                    {key === '⌫' ? <Delete className="w-4 h-4 mx-auto" /> : key}
                  </button>
                )
              )}
            </div>
          )}

          {/* Merchant Input with Recurring Suggestions */}
          <div className="relative">
            <label className="block text-xs font-medium text-[#526077] mb-1.5 flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5" />
              <span>Merchant or recurring payment</span>
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
              placeholder="e.g. Aldi, Lidl, Rent, Coffee (optional)"
              className="w-full px-4 py-3 rounded-2xl bg-[#F4F6F9] text-sm font-medium text-[#0B1221] placeholder:text-[#7C8BA1] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 transition"
            />

            {merchantFocused && filteredSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-2 z-20 bg-white rounded-2xl border border-[#E6EAF0] shadow-xl overflow-hidden">
                <div className="px-3.5 py-2 bg-[#F4F6F9] text-[11px] font-semibold text-[#526077] flex items-center gap-1.5">
                  <RotateCcw className="w-3 h-3" />
                  <span>Tap to auto-fill price & category</span>
                </div>
                <div className="max-h-48 overflow-y-auto divide-y divide-[#F1F5F9]">
                  {filteredSuggestions.map((s) => (
                    <button
                      key={s.merchant}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        applySuggestion(s);
                      }}
                      className="w-full px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-[#F8FAFC] text-left transition cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-8 h-8 rounded-full border border-[#E2E8F0] bg-white text-[#2563EB] flex items-center justify-center shrink-0">
                          <CategoryIcon category={s.category} className="w-3.5 h-3.5" />
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-[#0B1221] truncate">
                            {s.merchant}
                          </div>
                          <div className="text-[11px] text-[#7C8BA1]">
                            {s.category} · {s.count}×
                          </div>
                        </div>
                      </div>
                      <span className="text-xs font-bold tabular-nums text-[#0B1221] shrink-0">
                        {formatCurrency(s.amount, currency)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Quick-Fill Recurring Chips */}
          {!merchant && recurringSuggestions.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
              {recurringSuggestions.slice(0, 4).map((s) => (
                <button
                  key={s.merchant}
                  type="button"
                  onClick={() => applySuggestion(s)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#EBF0F5] hover:bg-[#E1E8F0] text-xs text-[#0B1221] font-medium shrink-0 transition cursor-pointer"
                >
                  <span className="truncate max-w-[110px]">{s.merchant}</span>
                  <span className="text-[#526077] tabular-nums">
                    {formatCurrency(s.amount, currency)}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Category Pill Grid */}
          <div>
            <label className="block text-xs font-medium text-[#526077] mb-2.5">
              Category
            </label>
            <div className="flex flex-wrap gap-2">
              {categoriesToShow.map((cat) => {
                const selected = category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold transition cursor-pointer ${
                      selected
                        ? 'bg-[#0B1221] text-white'
                        : 'bg-[#EBF0F5] text-[#526077] hover:text-[#0B1221]'
                    }`}
                  >
                    <CategoryIcon category={cat} className="w-3.5 h-3.5" />
                    <span>{cat}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date & Note */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-[#526077] mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>Date</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F4F6F9] text-sm text-[#0B1221] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#526077] mb-1.5 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                <span>Note</span>
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional note"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F4F6F9] text-sm text-[#0B1221] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#EBF0F5] hover:bg-[#E1E8F0] text-xs font-semibold text-[#0B1221] cursor-pointer transition">
              <ImagePlus className="w-4 h-4" />
              <span>{receiptDataUrl ? 'Photo attached' : 'Attach photo'}</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleAttachPhoto}
                className="hidden"
              />
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-50 text-white font-semibold text-sm transition cursor-pointer"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>
                {isSubmitting
                  ? 'Saving...'
                  : `Save ${numericAmount > 0 ? formatCurrency(numericAmount, currency) : ''}`}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
