import React, { useState } from 'react';
import {
  X,
  Trash2,
  Plus,
  Minus,
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
import { CategoryIcon } from './CategoryIcon';

interface TransactionDetailModalProps {
  transaction: Transaction;
  onClose: () => void;
  onUpdated?: () => void;
  onDeleted?: (deletedTx: Transaction) => void;
}

interface EditableLineItem {
  name: string;
  qtyStr: string;
  unitStr: string;
  totalStr: string;
}

export const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  transaction,
  onClose,
  onUpdated,
  onDeleted,
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
  const [items, setItems] = useState<EditableLineItem[]>(() =>
    (transaction.lineItems || []).map((li) => ({
      name: li.name,
      qtyStr: String(li.quantity ?? 1),
      unitStr: String(li.unitPrice ?? li.totalPrice ?? 0),
      totalStr: String(li.totalPrice ?? 0),
    }))
  );
  const [receiptImageDataUrl, setReceiptImageDataUrl] = useState<string | undefined>(
    transaction.receiptImageDataUrl
  );
  const [zoomReceipt, setZoomReceipt] = useState(false);
  const [saving, setSaving] = useState(false);

  const parseNum = (str: string) => {
    const n = parseFloat(str.replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  };

  const handleItemFieldChange = (
    idx: number,
    field: keyof EditableLineItem,
    rawVal: string
  ) => {
    setItems((prev) => {
      const next = [...prev];
      const current = { ...next[idx], [field]: rawVal };

      if (field === 'qtyStr') {
        const q = parseNum(rawVal);
        const u = parseNum(current.unitStr);
        if (q > 0 && u >= 0) {
          current.totalStr = (q * u).toFixed(2);
        }
      } else if (field === 'unitStr') {
        const q = parseNum(current.qtyStr) || 1;
        const u = parseNum(rawVal);
        if (u >= 0) {
          current.totalStr = (q * u).toFixed(2);
        }
      } else if (field === 'totalStr') {
        const q = parseNum(current.qtyStr) || 1;
        const t = parseNum(rawVal);
        if (t >= 0 && q > 0) {
          current.unitStr = (t / q).toFixed(2);
        }
      }

      next[idx] = current;
      return next;
    });
  };

  const stepQuantity = (idx: number, delta: number) => {
    setItems((prev) => {
      const next = [...prev];
      const current = { ...next[idx] };
      const oldQty = Math.max(1, parseNum(current.qtyStr) || 1);
      const newQty = Math.max(1, oldQty + delta);
      const unit = parseNum(current.unitStr);
      current.qtyStr = String(newQty);
      current.totalStr = (newQty * unit).toFixed(2);
      next[idx] = current;
      return next;
    });
  };

  const handleAddLineItem = () => {
    setItems((prev) => [
      ...prev,
      { name: '', qtyStr: '1', unitStr: '0.00', totalStr: '0.00' },
    ]);
  };

  const handleRemoveLineItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const recalculateTotalFromItems = () => {
    const sum = items.reduce((acc, item) => acc + parseNum(item.totalStr), 0);
    setAmount(sum.toFixed(2));
  };

  const handleReplaceReceiptImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImageToDataUrl(file, 1200, 0.78);
    setReceiptImageDataUrl(compressed);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const normalizedLineItems: LineItem[] = items
        .filter((it) => it.name.trim() !== '' || parseNum(it.totalStr) > 0)
        .map((it) => {
          const quantity = Math.max(0.01, parseNum(it.qtyStr) || 1);
          const totalPrice = Math.max(0, parseNum(it.totalStr));
          const unitPrice =
            parseNum(it.unitStr) > 0
              ? parseNum(it.unitStr)
              : Number((totalPrice / quantity).toFixed(2));
          return {
            name: it.name.trim() || 'Item',
            quantity,
            unitPrice,
            totalPrice,
          };
        });

      const updated: Transaction = {
        ...transaction,
        merchant: merchant.trim() || 'Unnamed Merchant',
        type,
        amount: Math.max(0, parseNum(amount)),
        taxAmount: taxAmount ? parseNum(taxAmount) : undefined,
        currency,
        category,
        date,
        note: note.trim(),
        lineItems: normalizedLineItems,
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
    if (onDeleted) {
      onDeleted(transaction);
    } else {
      onUpdated?.();
    }
    onClose();
  };

  const meta = CATEGORY_META[category] || CATEGORY_META.Other;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className={`w-9 h-9 rounded-xl ${meta.bgLight} ${meta.textColor} flex items-center justify-center`}
            >
              <CategoryIcon category={category} className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-semibold text-slate-900 text-sm sm:text-base">
                {merchant || 'Transaction Details'}
              </h3>
              <p className="text-xs text-slate-500">
                Inspect receipt image and edit itemized quantities or prices
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Receipt Image */}
            <div className="lg:col-span-5 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-slate-400" />
                  <span>Receipt Image</span>
                </span>
                <div className="flex items-center gap-1.5">
                  {receiptImageDataUrl && (
                    <button
                      type="button"
                      onClick={() => setZoomReceipt((z) => !z)}
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                    >
                      {zoomReceipt ? (
                        <ZoomOut className="w-3.5 h-3.5" />
                      ) : (
                        <ZoomIn className="w-3.5 h-3.5" />
                      )}
                      <span>{zoomReceipt ? 'Fit' : 'Zoom'}</span>
                    </button>
                  )}
                  <label className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{receiptImageDataUrl ? 'Replace' : 'Attach'}</span>
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
                <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-auto max-h-[440px] flex items-center justify-center p-2">
                  <img
                    src={receiptImageDataUrl}
                    alt={`Receipt from ${merchant}`}
                    className={`rounded-lg transition-all ${
                      zoomReceipt
                        ? 'w-[165%] max-w-none'
                        : 'max-h-[410px] w-auto object-contain'
                    }`}
                  />
                </div>
              ) : (
                <label className="flex-1 min-h-[220px] rounded-xl border border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100/70 transition flex flex-col items-center justify-center p-6 text-center cursor-pointer">
                  <Receipt className="w-8 h-8 text-slate-300 mb-2" />
                  <span className="text-xs font-medium text-slate-600">
                    No receipt image attached
                  </span>
                  <span className="text-[11px] text-slate-400 mt-1">
                    Click to attach a photo
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

            {/* Right Column: Editable Fields & Line Items */}
            <div className="lg:col-span-7 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Merchant
                  </label>
                  <input
                    type="text"
                    value={merchant}
                    onChange={(e) => setMerchant(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:border-emerald-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Total ({currency})
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold tabular-nums text-slate-900 focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Tax / VAT
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={taxAmount}
                      onChange={(e) => setTaxAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm tabular-nums focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as SpendeeCategory)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-emerald-600"
                  >
                    {SPENDEE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Date
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
                  <label className="block text-xs font-medium text-slate-600 mb-1">
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
                      className="w-14 px-2 py-2 rounded-xl border border-slate-200 text-sm text-center font-medium uppercase"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Note
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Summary note..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-600"
                />
              </div>

              {/* Editable Itemized Line Items Table */}
              <div className="pt-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-700">
                    Line Items ({items.length})
                  </span>
                  <div className="flex items-center gap-2">
                    {items.length > 0 && (
                      <button
                        type="button"
                        onClick={recalculateTotalFromItems}
                        className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium cursor-pointer"
                      >
                        <Calculator className="w-3.5 h-3.5" />
                        <span>Sum to total</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleAddLineItem}
                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-medium cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add item</span>
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  {items.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500 bg-slate-50">
                      No line items recorded. Click "Add item" to itemize.
                    </div>
                  ) : (
                    <>
                      <div className="px-2.5 py-1.5 bg-slate-50 border-b border-slate-200 grid grid-cols-12 gap-2 text-[11px] font-medium text-slate-500">
                        <div className="col-span-5">Item</div>
                        <div className="col-span-3 text-center">Qty</div>
                        <div className="col-span-3 text-right">Total</div>
                        <div className="col-span-1" />
                      </div>
                      <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
                        {items.map((item, idx) => (
                          <div
                            key={idx}
                            className="p-2 grid grid-cols-12 gap-1.5 items-center bg-white"
                          >
                            <div className="col-span-5">
                              <input
                                type="text"
                                value={item.name}
                                onChange={(e) =>
                                  handleItemFieldChange(idx, 'name', e.target.value)
                                }
                                placeholder="Item name"
                                className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-600"
                              />
                            </div>
                            <div className="col-span-3 flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => stepQuantity(idx, -1)}
                                className="p-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer shrink-0"
                                title="Decrease quantity"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={item.qtyStr}
                                onChange={(e) =>
                                  handleItemFieldChange(idx, 'qtyStr', e.target.value)
                                }
                                title="Quantity"
                                className="w-full px-1 py-1 text-xs text-center tabular-nums rounded-lg border border-slate-200 focus:outline-none focus:border-emerald-600"
                              />
                              <button
                                type="button"
                                onClick={() => stepQuantity(idx, 1)}
                                className="p-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer shrink-0"
                                title="Increase quantity"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                            <div className="col-span-3">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={item.totalStr}
                                onChange={(e) =>
                                  handleItemFieldChange(idx, 'totalStr', e.target.value)
                                }
                                title="Line Total"
                                className="w-full px-2 py-1.5 text-xs font-semibold tabular-nums rounded-lg border border-slate-200 text-right focus:outline-none focus:border-emerald-600"
                              />
                            </div>
                            <div className="col-span-1 flex justify-end">
                              <button
                                type="button"
                                onClick={() => handleRemoveLineItem(idx)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded-md cursor-pointer"
                                title="Remove item"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleDelete}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-rose-600 hover:bg-rose-50 font-medium text-xs sm:text-sm transition cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-xs sm:text-sm transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm shadow-xs transition cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>
                  {saving ? 'Saving...' : `Save (${formatCurrency(parseNum(amount), currency)})`}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
