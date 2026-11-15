import React, { useState } from 'react';
import {
  X,
  Trash2,
  Plus,
  Save,
  Receipt,
  Calculator,
  ZoomIn,
  ZoomOut,
  Upload,
} from 'lucide-react';
import {
  db,
  SPENDEE_CATEGORIES,
  CATEGORY_META,
  formatCurrency,
  type Transaction,
  type LineItem,
  type SpendeeCategory,
} from '../db/db';
import { compressImageToDataUrl } from '../utils/imageCompression';

interface TransactionDetailModalProps {
  transaction: Transaction;
  onClose: () => void;
  onUpdated?: () => void;
}

export const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  transaction,
  onClose,
  onUpdated,
}) => {
  const [merchant, setMerchant] = useState(transaction.merchant);
  const [type, setType] = useState<'expense' | 'income'>(transaction.type);
  const [amount, setAmount] = useState(String(transaction.amount));
  const [taxAmount, setTaxAmount] = useState(
    transaction.taxAmount !== undefined ? String(transaction.taxAmount) : ''
  );
  const [currency, setCurrency] = useState(transaction.currency || 'EUR');
  const [category, setCategory] = useState<SpendeeCategory>(transaction.category);
  const [date, setDate] = useState(transaction.date);
  const [note, setNote] = useState(transaction.note);
  const [lineItems, setLineItems] = useState<LineItem[]>(
    transaction.lineItems?.length ? [...transaction.lineItems] : []
  );
  const [receiptImageDataUrl, setReceiptImageDataUrl] = useState<string | undefined>(
    transaction.receiptImageDataUrl
  );
  const [zoomReceipt, setZoomReceipt] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleLineItemChange = (
    idx: number,
    field: keyof LineItem,
    rawVal: string
  ) => {
    setLineItems((prev) => {
      const next = [...prev];
      const current = { ...next[idx] };
      if (field === 'name') {
        current.name = rawVal;
      } else if (field === 'quantity') {
        const q = Math.max(0.01, parseFloat(rawVal) || 1);
        current.quantity = q;
        current.totalPrice = Number((q * current.unitPrice).toFixed(2));
      } else if (field === 'unitPrice') {
        const u = parseFloat(rawVal) || 0;
        current.unitPrice = u;
        current.totalPrice = Number((current.quantity * u).toFixed(2));
      } else if (field === 'totalPrice') {
        const t = parseFloat(rawVal) || 0;
        current.totalPrice = t;
        current.unitPrice = Number((t / (current.quantity || 1)).toFixed(2));
      }
      next[idx] = current;
      return next;
    });
  };

  const handleAddLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      { name: 'New Item', quantity: 1, unitPrice: 0, totalPrice: 0 },
    ]);
  };

  const handleRemoveLineItem = (idx: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const recalculateTotalFromItems = () => {
    const sum = lineItems.reduce((acc, item) => acc + (Number(item.totalPrice) || 0), 0);
    if (sum > 0) {
      setAmount(sum.toFixed(2));
    }
  };

  const handleReplaceReceiptImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImageToDataUrl(file, 1200, 0.75);
    setReceiptImageDataUrl(compressed);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated: Transaction = {
        ...transaction,
        merchant: merchant.trim() || 'Unnamed Merchant',
        type,
        amount: Math.max(0, parseFloat(amount) || 0),
        taxAmount: taxAmount ? parseFloat(taxAmount) : undefined,
        currency,
        category,
        date,
        note: note.trim(),
        lineItems,
        receiptImageDataUrl,
      };
      await db.transactions.put(updated);
      onUpdated?.();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    await db.transactions.delete(transaction.id);
    onUpdated?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">{CATEGORY_META[category]?.emoji || '🧾'}</span>
            <div>
              <h3 className="font-bold text-slate-900 text-base sm:text-lg">
                Receipt & Transaction Inspector
              </h3>
              <p className="text-xs text-slate-500">
                Inspect original receipt image side-by-side with itemized line items
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Side-by-Side Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Receipt Image Preview */}
            <div className="lg:col-span-5 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Original Receipt Image</span>
                </span>
                <div className="flex items-center gap-1.5">
                  {receiptImageDataUrl && (
                    <button
                      type="button"
                      onClick={() => setZoomReceipt((z) => !z)}
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                    >
                      {zoomReceipt ? <ZoomOut className="w-3.5 h-3.5" /> : <ZoomIn className="w-3.5 h-3.5" />}
                      <span>{zoomReceipt ? 'Fit' : 'Zoom'}</span>
                    </button>
                  )}
                  <label className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-medium cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{receiptImageDataUrl ? 'Replace' : 'Attach Photo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleReplaceReceiptImage}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {receiptImageDataUrl ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-900/5 overflow-auto max-h-[460px] flex items-center justify-center p-2">
                  <img
                    src={receiptImageDataUrl}
                    alt={`Receipt from ${merchant}`}
                    className={`rounded-xl shadow-xs transition-all ${
                      zoomReceipt ? 'w-[160%] max-w-none' : 'max-h-[430px] w-auto object-contain'
                    }`}
                  />
                </div>
              ) : (
                <label className="flex-1 min-h-[240px] rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 hover:bg-slate-100/70 transition flex flex-col items-center justify-center p-6 text-center cursor-pointer">
                  <Receipt className="w-10 h-10 text-slate-300 mb-2" />
                  <span className="text-sm font-medium text-slate-600">
                    No receipt image attached
                  </span>
                  <span className="text-xs text-slate-400 mt-1">
                    Click to attach & compress a receipt photo (stored 100% locally)
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleReplaceReceiptImage}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* Right Column: Editable Transaction Fields & Line Items */}
            <div className="lg:col-span-7 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Merchant / Store Name
                  </label>
                  <input
                    type="text"
                    value={merchant}
                    onChange={(e) => setMerchant(e.target.value)}
                    required
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Total ({currency})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Tax / VAT
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={taxAmount}
                      onChange={(e) => setTaxAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as SpendeeCategory)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {SPENDEE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {CATEGORY_META[c].emoji} {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Type & Currency
                  </label>
                  <div className="flex gap-1.5">
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value as 'expense' | 'income')}
                      className="flex-1 px-2.5 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                    >
                      <option value="expense">Expense</option>
                      <option value="income">Income</option>
                    </select>
                    <input
                      type="text"
                      maxLength={3}
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                      className="w-16 px-2.5 py-2 rounded-xl border border-slate-200 text-sm text-center font-semibold uppercase"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Summary Note
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Short summary of purchase..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Itemized Line Items Table */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Itemized Line Items ({lineItems.length})
                  </span>
                  <div className="flex items-center gap-2">
                    {lineItems.length > 0 && (
                      <button
                        type="button"
                        onClick={recalculateTotalFromItems}
                        className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium cursor-pointer"
                      >
                        <Calculator className="w-3.5 h-3.5" />
                        <span>Sum to Total</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleAddLineItem}
                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Item</span>
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 overflow-hidden bg-slate-50/50">
                  {lineItems.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500">
                      No individual line items recorded. Click "Add Item" to itemize this receipt.
                    </div>
                  ) : (
                    <div className="max-h-56 overflow-y-auto divide-y divide-slate-200/70">
                      {lineItems.map((item, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 grid grid-cols-12 gap-2 items-center bg-white hover:bg-slate-50/80"
                        >
                          <div className="col-span-5 sm:col-span-6">
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) => handleLineItemChange(idx, 'name', e.target.value)}
                              placeholder="Item name"
                              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200"
                            />
                          </div>
                          <div className="col-span-2">
                            <input
                              type="number"
                              step="any"
                              value={item.quantity}
                              onChange={(e) => handleLineItemChange(idx, 'quantity', e.target.value)}
                              title="Quantity"
                              className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 text-center"
                            />
                          </div>
                          <div className="col-span-4 sm:col-span-3">
                            <input
                              type="number"
                              step="0.01"
                              value={item.totalPrice}
                              onChange={(e) =>
                                handleLineItemChange(idx, 'totalPrice', e.target.value)
                              }
                              title="Line Total"
                              className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-right"
                            />
                          </div>
                          <div className="col-span-1 flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleRemoveLineItem(idx)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleDelete}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs sm:text-sm transition cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Transaction</span>
            </button>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium text-xs sm:text-sm transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm shadow-sm transition cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Saving...' : `Save (${formatCurrency(parseFloat(amount) || 0, currency)})`}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
