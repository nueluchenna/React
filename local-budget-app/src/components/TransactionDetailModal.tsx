import React, { useState } from 'react';
import {
  X,
  Trash2,
  Plus,
  Minus,
  Receipt,
  Calculator,
  ZoomIn,
  ZoomOut,
  Upload,
} from 'lucide-react';
import {
  db,
  SPENDEE_CATEGORIES,
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
  const [activeMobileTab, setActiveMobileTab] = useState<'details' | 'receipt'>('details');

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
    const compressed = await compressImageToDataUrl(file, 1400, 0.82);
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

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0B1221]/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-5 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl max-w-4xl w-full max-h-[94vh] flex flex-col shadow-2xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Centered Cool-Alabaster Summary Header */}
        <div className="relative bg-[#F4F6F9] px-6 pt-6 pb-7 text-center">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-[#E2E8F0] hover:bg-[#CBD5E1] text-[#0B1221] flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="w-12 h-12 rounded-full border border-[#DCE3EC] bg-white text-[#2563EB] flex items-center justify-center mx-auto mb-3">
            <CategoryIcon category={category} className="w-5 h-5" />
          </div>

          <div className="text-xs font-medium text-[#526077]">
            {type === 'income' ? 'Received from' : 'Paid to'} {merchant || 'Merchant'}
          </div>
          <div className="text-3xl font-display font-extrabold tabular-nums text-[#0B1221] mt-1">
            {type === 'income' ? '+' : '-'}
            {formatCurrency(parseNum(amount), currency)}
          </div>

          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#E2E8F0] text-xs font-medium text-[#526077]">
            <span>{category}</span>
            <span>·</span>
            <span>{date}</span>
          </div>
        </div>

        {/* Mobile Segmented Switch */}
        <div className="lg:hidden px-5 pt-4">
          <div className="grid grid-cols-2 rounded-full bg-[#EBF0F5] p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveMobileTab('details')}
              className={`py-2 rounded-full transition cursor-pointer ${
                activeMobileTab === 'details'
                  ? 'bg-white text-[#0B1221] shadow-2xs'
                  : 'text-[#526077]'
              }`}
            >
              Details & items
            </button>
            <button
              type="button"
              onClick={() => setActiveMobileTab('receipt')}
              className={`py-2 rounded-full transition cursor-pointer ${
                activeMobileTab === 'receipt'
                  ? 'bg-white text-[#0B1221] shadow-2xs'
                  : 'text-[#526077]'
              }`}
            >
              Receipt photo
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 sm:p-7">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
            {/* Receipt Column */}
            <div
              className={`lg:col-span-5 flex flex-col ${
                activeMobileTab === 'receipt' ? 'flex' : 'hidden lg:flex'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-[#526077] flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5" />
                  <span>Receipt photo</span>
                </span>
                <div className="flex items-center gap-1.5">
                  {receiptImageDataUrl && (
                    <button
                      type="button"
                      onClick={() => setZoomReceipt((z) => !z)}
                      className="inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full bg-[#EBF0F5] hover:bg-[#E1E8F0] text-[#0B1221] font-medium cursor-pointer"
                    >
                      {zoomReceipt ? (
                        <ZoomOut className="w-3.5 h-3.5" />
                      ) : (
                        <ZoomIn className="w-3.5 h-3.5" />
                      )}
                      <span>{zoomReceipt ? 'Fit' : 'Zoom'}</span>
                    </button>
                  )}
                  <label className="inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full bg-[#EBF0F5] hover:bg-[#E1E8F0] text-[#0B1221] font-medium cursor-pointer">
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
                <div className="rounded-2xl bg-[#F4F6F9] overflow-auto max-h-[420px] flex items-center justify-center p-3">
                  <img
                    src={receiptImageDataUrl}
                    alt={`Receipt from ${merchant}`}
                    className={`rounded-xl transition-all ${
                      zoomReceipt
                        ? 'w-[165%] max-w-none'
                        : 'max-h-[390px] w-auto object-contain'
                    }`}
                  />
                </div>
              ) : (
                <label className="flex-1 min-h-[220px] rounded-2xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] hover:bg-[#F4F6F9] transition flex flex-col items-center justify-center p-6 text-center cursor-pointer">
                  <Receipt className="w-7 h-7 text-[#7C8BA1] mb-2" strokeWidth={1.6} />
                  <span className="text-xs font-semibold text-[#0B1221]">
                    No receipt attached
                  </span>
                  <span className="text-xs text-[#7C8BA1] mt-1">
                    Tap to attach a photo
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

            {/* Details & Line Items Column */}
            <div
              className={`lg:col-span-7 space-y-5 ${
                activeMobileTab === 'details' ? 'block' : 'hidden lg:block'
              }`}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#526077] mb-1.5">
                    Merchant
                  </label>
                  <input
                    type="text"
                    value={merchant}
                    onChange={(e) => setMerchant(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F4F6F9] text-sm font-medium text-[#0B1221] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-medium text-[#526077] mb-1.5">
                      Total ({currency})
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#F4F6F9] text-sm font-bold tabular-nums text-[#0B1221] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#526077] mb-1.5">
                      Tax / VAT
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={taxAmount}
                      onChange={(e) => setTaxAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#F4F6F9] text-sm tabular-nums text-[#0B1221] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-[#526077] mb-1.5">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as SpendeeCategory)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F4F6F9] text-sm text-[#0B1221] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                  >
                    {SPENDEE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#526077] mb-1.5">
                    Date
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
                  <label className="block text-xs font-medium text-[#526077] mb-1.5">
                    Type & Currency
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value as 'expense' | 'income')}
                      className="flex-1 px-3 py-2.5 rounded-xl bg-[#F4F6F9] text-sm text-[#0B1221]"
                    >
                      <option value="expense">Expense</option>
                      <option value="income">Income</option>
                    </select>
                    <input
                      type="text"
                      maxLength={3}
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                      className="w-14 px-2 py-2.5 rounded-xl bg-[#F4F6F9] text-sm text-center font-semibold uppercase"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#526077] mb-1.5">
                  Note
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Summary note..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F4F6F9] text-sm text-[#0B1221] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20"
                />
              </div>

              {/* Itemized Line Items */}
              <div className="pt-2 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#0B1221]">
                    Line items ({items.length})
                  </span>
                  <div className="flex items-center gap-2">
                    {items.length > 0 && (
                      <button
                        type="button"
                        onClick={recalculateTotalFromItems}
                        className="inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full bg-[#EBF0F5] hover:bg-[#E1E8F0] text-[#0B1221] font-medium cursor-pointer"
                      >
                        <Calculator className="w-3.5 h-3.5" />
                        <span>Sum to total</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleAddLineItem}
                      className="inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full bg-[#EBF0F5] hover:bg-[#E1E8F0] text-[#2563EB] font-semibold cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add item</span>
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl bg-[#F8FAFC] border border-[#E6EAF0] overflow-hidden">
                  {items.length === 0 ? (
                    <div className="p-5 text-center text-xs text-[#7C8BA1]">
                      No line items yet. Click &quot;Add item&quot; to itemize this receipt.
                    </div>
                  ) : (
                    <>
                      <div className="px-3 py-2 bg-[#F4F6F9] grid grid-cols-12 gap-2 text-[11px] font-semibold text-[#526077]">
                        <div className="col-span-5">Item</div>
                        <div className="col-span-3 text-center">Qty</div>
                        <div className="col-span-3 text-right">Total</div>
                        <div className="col-span-1" />
                      </div>
                      <div className="max-h-56 overflow-y-auto divide-y divide-[#E6EAF0]">
                        {items.map((item, idx) => (
                          <div
                            key={idx}
                            className="p-2.5 grid grid-cols-12 gap-1.5 items-center bg-white"
                          >
                            <div className="col-span-5">
                              <input
                                type="text"
                                value={item.name}
                                onChange={(e) =>
                                  handleItemFieldChange(idx, 'name', e.target.value)
                                }
                                placeholder="Item name"
                                className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-[#F4F6F9] text-[#0B1221] focus:outline-none focus:ring-1 focus:ring-[#2563EB]/25"
                              />
                            </div>
                            <div className="col-span-3 flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => stepQuantity(idx, -1)}
                                className="p-1 rounded-full bg-[#EBF0F5] hover:bg-[#E1E8F0] text-[#0B1221] cursor-pointer shrink-0"
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
                                className="w-full px-1 py-1 text-xs text-center tabular-nums rounded-lg bg-[#F4F6F9] text-[#0B1221] focus:outline-none focus:ring-1 focus:ring-[#2563EB]/25"
                              />
                              <button
                                type="button"
                                onClick={() => stepQuantity(idx, 1)}
                                className="p-1 rounded-full bg-[#EBF0F5] hover:bg-[#E1E8F0] text-[#0B1221] cursor-pointer shrink-0"
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
                                className="w-full px-2.5 py-1.5 text-xs font-semibold tabular-nums rounded-lg bg-[#F4F6F9] text-[#0B1221] text-right focus:outline-none focus:ring-1 focus:ring-[#2563EB]/25"
                              />
                            </div>
                            <div className="col-span-1 flex justify-end">
                              <button
                                type="button"
                                onClick={() => handleRemoveLineItem(idx)}
                                className="p-1 text-[#7C8BA1] hover:text-[#BE123C] rounded-full cursor-pointer"
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

          {/* Pill Footer Actions */}
          <div className="mt-8 pt-5 border-t border-[#E6EAF0] flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleDelete}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[#FEE2E2] hover:bg-[#FECDD3] text-[#BE123C] font-semibold text-sm transition cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete transaction</span>
            </button>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-initial px-5 py-2.5 rounded-full bg-[#EBF0F5] hover:bg-[#E1E8F0] text-[#0B1221] font-semibold text-sm transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 sm:flex-initial px-6 py-2.5 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-sm transition cursor-pointer"
              >
                {saving ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
