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
} from 'lucide-react';
import {
  db,
  SPENDEE_CATEGORIES,
  CATEGORY_META,
  CURRENCY_SYMBOLS,
  type SpendeeCategory,
  type Transaction,
} from '../db/db';
import { compressImageToDataUrl } from '../utils/imageCompression';

interface ManualEntryModalProps {
  currency: string;
  existingMerchants: string[];
  onClose: () => void;
  onSaved: (tx: Transaction) => void;
}

export const ManualEntryModal: React.FC<ManualEntryModalProps> = ({
  currency,
  existingMerchants,
  onClose,
  onSaved,
}) => {
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [expression, setExpression] = useState('0');
  const [category, setCategory] = useState<SpendeeCategory>('Food & Drink');
  const [merchant, setMerchant] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');
  const [receiptDataUrl, setReceiptDataUrl] = useState<string | undefined>();
  const [showKeypad, setShowKeypad] = useState(true);

  const currencySymbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;

  // Safely evaluate simple calculator expressions (+, -, *, /)
  const evaluateExpression = (expr: string): number => {
    try {
      const sanitized = expr.replace(/[^0-9.+\-*/]/g, '');
      if (!sanitized) return 0;
      const tokens = sanitized.match(/(\d+\.?\d*|\.\d+|[+\-*/])/g);
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

  const numericAmount = useMemo(() => evaluateExpression(expression), [expression]);

  const handleKeyPress = (key: string) => {
    if (key === 'C') {
      setExpression('0');
      return;
    }
    if (key === '⌫') {
      setExpression((prev) => (prev.length <= 1 ? '0' : prev.slice(0, -1)));
      return;
    }
    if (key === '=') {
      setExpression(String(evaluateExpression(expression)));
      return;
    }
    setExpression((prev) => {
      if (prev === '0' && !['.', '+', '-', '*', '/'].includes(key)) {
        return key;
      }
      return prev + key;
    });
  };

  const handleAttachPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImageToDataUrl(file, 1200, 0.75);
    setReceiptDataUrl(compressed);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalAmount = evaluateExpression(expression);
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
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full max-h-[94vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Top Bar with Expense / Income Toggle */}
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="inline-flex rounded-xl bg-slate-200/80 p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setType('expense');
                if (category === 'Income') setCategory('Food & Drink');
              }}
              className={`px-4 py-1.5 rounded-lg transition cursor-pointer ${
                type === 'expense'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
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
              className={`px-4 py-1.5 rounded-lg transition cursor-pointer ${
                type === 'income'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Income
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Big Spendee Amount Display */}
          <div className="text-center py-3 px-4 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
              <span>Amount ({currency})</span>
              <button
                type="button"
                onClick={() => setShowKeypad((k) => !k)}
                className="inline-flex items-center gap-1 text-emerald-600 hover:underline cursor-pointer"
              >
                <Calculator className="w-3.5 h-3.5" />
                <span>{showKeypad ? 'Hide Keypad' : 'Show Keypad'}</span>
              </button>
            </div>

            <div className="flex items-baseline justify-center gap-1">
              <span
                className={`text-2xl font-bold ${
                  type === 'income' ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {type === 'income' ? '+' : '-'}
                {currencySymbol}
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={expression}
                onChange={(e) => setExpression(e.target.value)}
                className="text-4xl font-extrabold text-slate-900 bg-transparent text-center w-48 focus:outline-none"
              />
            </div>

            {expression !== String(numericAmount) && (
              <div className="text-xs text-slate-500 mt-1">
                = {currencySymbol}
                {numericAmount.toFixed(2)}
              </div>
            )}
          </div>

          {/* Calculator Keypad */}
          {showKeypad && (
            <div className="grid grid-cols-4 gap-2">
              {['7', '8', '9', '+', '4', '5', '6', '-', '1', '2', '3', '*', '.', '0', '⌫', '='].map(
                (key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleKeyPress(key)}
                    className={`py-2.5 rounded-xl font-bold text-base transition active:scale-95 cursor-pointer ${
                      ['+', '-', '*', '='].includes(key)
                        ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
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

          {/* Spendee Color-Coded Category Pills Grid */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Select Category
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {categoriesToShow.map((cat) => {
                const meta = CATEGORY_META[cat];
                const selected = category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border text-xs font-semibold transition cursor-pointer ${
                      selected
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm scale-[1.02]'
                        : `${meta.bgLight} ${meta.textColor} ${meta.borderColor} hover:opacity-90`
                    }`}
                  >
                    <span className="text-lg mb-0.5">{meta.emoji}</span>
                    <span className="truncate max-w-full">{cat}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Merchant with Autocomplete & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
                <Store className="w-3.5 h-3.5 text-slate-400" />
                <span>Merchant / Payee</span>
              </label>
              <input
                type="text"
                list="past-merchants-list"
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                placeholder="e.g. Lidl, Blue Bottle, Rent..."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <datalist id="past-merchants-list">
                {existingMerchants.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Date</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Note & Optional Receipt Attachment */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span>Note</span>
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional note or item details..."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer transition">
                <ImagePlus className="w-4 h-4 text-emerald-600" />
                <span>{receiptDataUrl ? 'Photo Added ✓' : 'Attach Receipt'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAttachPhoto}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={numericAmount <= 0}
            className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Check className="w-5 h-5" />
            <span>
              Save {type === 'income' ? 'Income' : 'Expense'} ({currencySymbol}
              {numericAmount.toFixed(2)})
            </span>
          </button>
        </form>
      </div>
    </div>
  );
};
