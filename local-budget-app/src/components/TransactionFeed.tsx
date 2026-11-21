import React, { useMemo, useState } from 'react';
import {
  Search,
  Receipt,
  Clock,
  RefreshCw,
  Plus,
  Camera,
  Upload,
  ClipboardPaste,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
} from 'lucide-react';
import {
  CATEGORY_META,
  SPENDEE_CATEGORIES,
  formatCurrency,
  type Transaction,
  type PendingReceipt,
  type SpendeeCategory,
} from '../db/db';
import { CategoryIcon } from './CategoryIcon';

interface TransactionFeedProps {
  transactions: Transaction[];
  pendingReceipts: PendingReceipt[];
  currency: string;
  monthlyBudget: number;
  isOffline: boolean;
  isSyncingQueue: boolean;
  onSelectTransaction: (tx: Transaction) => void;
  onOpenManualEntry: () => void;
  onOpenCamera: () => void;
  onTriggerFileUpload: () => void;
  onPasteClipboard: () => void;
  onLoadDemoData: () => void;
  onSyncQueueNow: () => void;
  onOpenQueueTab: () => void;
  onExportSummaryCSV: () => void;
}

export const TransactionFeed: React.FC<TransactionFeedProps> = ({
  transactions,
  pendingReceipts,
  currency,
  monthlyBudget,
  isOffline,
  isSyncingQueue,
  onSelectTransaction,
  onOpenManualEntry,
  onOpenCamera,
  onTriggerFileUpload,
  onPasteClipboard,
  onLoadDemoData,
  onSyncQueueNow,
  onOpenQueueTab,
  onExportSummaryCSV,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<SpendeeCategory | 'ALL'>('ALL');
  const [typeFilter, setTypeFilter] = useState<'all' | 'expense' | 'income'>('all');

  const currentMonthPrefix = useMemo(() => new Date().toISOString().slice(0, 7), []);

  const stats = useMemo(() => {
    let monthExpenses = 0;
    let monthIncome = 0;

    for (const tx of transactions) {
      if (!tx.date.startsWith(currentMonthPrefix)) continue;
      if (tx.type === 'expense') monthExpenses += tx.amount;
      else monthIncome += tx.amount;
    }

    const monthSavings = monthIncome - monthExpenses;
    const budgetRemaining = monthlyBudget - monthExpenses;
    const budgetPct = monthlyBudget > 0 ? Math.min(100, (monthExpenses / monthlyBudget) * 100) : 0;

    return {
      monthExpenses,
      monthIncome,
      monthSavings,
      budgetRemaining,
      budgetPct,
    };
  }, [transactions, currentMonthPrefix, monthlyBudget]);

  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return transactions
      .filter((tx) => {
        if (selectedCategory !== 'ALL' && tx.category !== selectedCategory) return false;
        if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
        if (!q) return true;
        const matchMerchant = tx.merchant.toLowerCase().includes(q);
        const matchNote = tx.note?.toLowerCase().includes(q);
        const matchCat = tx.category.toLowerCase().includes(q);
        const matchItems = tx.lineItems?.some((li) => li.name.toLowerCase().includes(q));
        return matchMerchant || matchNote || matchCat || matchItems;
      })
      .sort((a, b) => {
        const cmp = b.date.localeCompare(a.date);
        return cmp !== 0 ? cmp : b.createdAt - a.createdAt;
      });
  }, [transactions, searchQuery, selectedCategory, typeFilter]);

  const groupedByDate = useMemo(() => {
    const groups: Array<{ date: string; dayTotal: number; items: Transaction[] }> = [];
    const map = new Map<string, { date: string; dayTotal: number; items: Transaction[] }>();

    for (const tx of filteredTransactions) {
      let group = map.get(tx.date);
      if (!group) {
        group = { date: tx.date, dayTotal: 0, items: [] };
        map.set(tx.date, group);
        groups.push(group);
      }
      group.items.push(tx);
      group.dayTotal += tx.type === 'expense' ? -tx.amount : tx.amount;
    }

    return groups;
  }, [filteredTransactions]);

  function formatHumanDate(isoDate: string): string {
    const today = new Date().toISOString().split('T')[0];
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = yesterdayDate.toISOString().split('T')[0];

    if (isoDate === today) return 'Today';
    if (isoDate === yesterday) return 'Yesterday';

    const parsed = new Date(`${isoDate}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return isoDate;
    return parsed.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: parsed.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    });
  }

  return (
    <div className="space-y-5 pb-24">
      {/* Clean Overview KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80">
          <div className="text-xs font-medium text-slate-500">Spent This Month</div>
          <div className="text-xl sm:text-2xl font-bold tabular-nums text-slate-900 mt-1">
            {formatCurrency(stats.monthExpenses, currency)}
          </div>
          <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden mt-2.5">
            <div
              className={`h-full rounded-full transition-all ${
                stats.budgetPct >= 100
                  ? 'bg-rose-500'
                  : stats.budgetPct >= 75
                  ? 'bg-amber-500'
                  : 'bg-emerald-600'
              }`}
              style={{ width: `${Math.min(100, stats.budgetPct)}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80">
          <div className="text-xs font-medium text-slate-500">Income This Month</div>
          <div className="text-xl sm:text-2xl font-bold tabular-nums text-emerald-600 mt-1">
            {formatCurrency(stats.monthIncome, currency)}
          </div>
          <div className="text-[11px] text-slate-400 mt-2">Monthly inflows</div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80">
          <div className="text-xs font-medium text-slate-500">Net Saved</div>
          <div
            className={`text-xl sm:text-2xl font-bold tabular-nums mt-1 ${
              stats.monthSavings >= 0 ? 'text-slate-900' : 'text-rose-600'
            }`}
          >
            {stats.monthSavings >= 0 ? '+' : ''}
            {formatCurrency(stats.monthSavings, currency)}
          </div>
          <div className="text-[11px] text-slate-400 mt-2">Income minus spend</div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80">
          <div className="text-xs font-medium text-slate-500">Budget Remaining</div>
          <div
            className={`text-xl sm:text-2xl font-bold tabular-nums mt-1 ${
              stats.budgetRemaining < 0 ? 'text-rose-600' : 'text-slate-900'
            }`}
          >
            {formatCurrency(stats.budgetRemaining, currency)}
          </div>
          <div className="text-[11px] text-slate-400 mt-2 tabular-nums">
            Target {formatCurrency(monthlyBudget, currency)}
          </div>
        </div>
      </div>

      {/* Compact Quick Capture Bar (Camera, Upload, Paste, Manual) */}
      <div className="bg-white rounded-2xl p-3 border border-slate-200/80 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenCamera}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs transition cursor-pointer"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Take Photo</span>
          </button>

          <button
            type="button"
            onClick={onTriggerFileUpload}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium text-xs transition cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Receipt</span>
          </button>

          <button
            type="button"
            onClick={onPasteClipboard}
            title="Paste screenshot (Ctrl+V)"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition cursor-pointer"
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Paste</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onOpenManualEntry}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Entry</span>
        </button>
      </div>

      {/* Offline / Pending Queue Banner */}
      {pendingReceipts.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-100 text-amber-700 shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-semibold text-amber-950 text-sm">
                  {pendingReceipts.length} receipt{pendingReceipts.length > 1 ? 's' : ''} in queue
                </h3>
                <p className="text-xs text-amber-800">
                  {isOffline
                    ? 'Offline mode active. Receipts will extract automatically when online.'
                    : 'Ready to sync pending receipts into transactions.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {!isOffline && (
                <button
                  type="button"
                  disabled={isSyncingQueue}
                  onClick={onSyncQueueNow}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-semibold transition cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingQueue ? 'animate-spin' : ''}`} />
                  <span>{isSyncingQueue ? 'Syncing...' : 'Sync Now'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={onOpenQueueTab}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white hover:bg-amber-100/70 text-amber-900 border border-amber-200 text-xs font-medium transition cursor-pointer"
              >
                <span>Open Queue</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-amber-200/60 flex items-center gap-2.5 overflow-x-auto">
            {pendingReceipts.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={onOpenQueueTab}
                className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-xl border border-amber-200/80 hover:border-amber-400 transition shrink-0 text-left cursor-pointer"
              >
                <img
                  src={item.imageDataUrl}
                  alt="Queued receipt"
                  className="w-8 h-8 rounded-md object-cover bg-slate-100"
                />
                <div>
                  <div className="text-xs font-medium text-slate-800 truncate max-w-[110px]">
                    {item.fileName || 'Receipt'}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-slate-500">
                    {item.status === 'processing' ? (
                      <>
                        <RefreshCw className="w-2.5 h-2.5 animate-spin text-slate-600" />
                        <span>Processing</span>
                      </>
                    ) : item.status === 'failed' ? (
                      <>
                        <AlertCircle className="w-2.5 h-2.5 text-rose-600" />
                        <span className="text-rose-600">Failed</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                        <span>Queued</span>
                      </>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {transactions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-10 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto mb-3">
            <Receipt className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">No transactions yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            Take a photo of a receipt, add an expense manually, or load realistic demo data to explore analytics.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={onOpenManualEntry}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add First Expense</span>
            </button>
            <button
              type="button"
              onClick={onLoadDemoData}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium text-xs transition cursor-pointer"
            >
              <span>Load Realistic Demo Data</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Search & Filters */}
          <div className="bg-white rounded-2xl p-3 border border-slate-200/80 space-y-2.5">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search merchant, notes, or receipt items..."
                  className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl bg-slate-50 border border-slate-200/80 focus:outline-none focus:bg-white focus:border-emerald-600 transition"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <div className="inline-flex rounded-xl bg-slate-100 p-0.5 text-xs font-medium">
                  {(['all', 'expense', 'income'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTypeFilter(t)}
                      className={`px-3 py-1.5 rounded-lg capitalize transition cursor-pointer ${
                        typeFilter === t
                          ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={onExportSummaryCSV}
                  title="Export CSV"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 transition cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
                  <span className="hidden md:inline">CSV</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              <button
                type="button"
                onClick={() => setSelectedCategory('ALL')}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium shrink-0 transition cursor-pointer ${
                  selectedCategory === 'ALL'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All ({transactions.length})
              </button>
              {SPENDEE_CATEGORIES.map((cat) => {
                const isActive = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(isActive ? 'ALL' : cat)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium shrink-0 transition cursor-pointer ${
                      isActive
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <CategoryIcon category={cat} className="w-3 h-3" />
                    <span>{cat}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date-Grouped Transaction List */}
          {groupedByDate.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-slate-200/80">
              <p className="text-sm text-slate-600">No transactions match your search.</p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('ALL');
                  setTypeFilter('all');
                }}
                className="mt-2 text-xs font-medium text-emerald-600 hover:underline cursor-pointer"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {groupedByDate.map((group) => (
                <div
                  key={group.date}
                  className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden"
                >
                  <div className="px-4 py-2 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500">
                      {formatHumanDate(group.date)}
                    </span>
                    <span
                      className={`text-xs font-semibold tabular-nums ${
                        group.dayTotal < 0 ? 'text-slate-600' : 'text-emerald-600'
                      }`}
                    >
                      {group.dayTotal > 0 ? '+' : ''}
                      {formatCurrency(group.dayTotal, currency)}
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {group.items.map((tx) => {
                      const meta = CATEGORY_META[tx.category] || CATEGORY_META.Other;
                      return (
                        <button
                          key={tx.id}
                          type="button"
                          onClick={() => onSelectTransaction(tx)}
                          className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition text-left cursor-pointer group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`relative w-10 h-10 rounded-xl ${meta.bgLight} ${meta.textColor} flex items-center justify-center shrink-0`}
                            >
                              <CategoryIcon category={tx.category} className="w-4 h-4" />
                              {tx.receiptImageDataUrl && (
                                <span
                                  title="Receipt attached"
                                  className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-white border border-slate-200 text-slate-600 flex items-center justify-center"
                                >
                                  <Receipt className="w-2.5 h-2.5" />
                                </span>
                              )}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-900 text-sm truncate">
                                  {tx.merchant}
                                </span>
                                <span className="text-[11px] text-slate-400 shrink-0">
                                  {tx.category}
                                </span>
                              </div>

                              <div className="text-xs text-slate-500 truncate mt-0.5">
                                {tx.note || tx.category}
                                {tx.lineItems && tx.lineItems.length > 0 && (
                                  <span className="text-slate-400">
                                    {' '}
                                    • {tx.lineItems.length} item{tx.lineItems.length > 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <div className="text-right tabular-nums">
                              <div
                                className={`text-sm font-semibold ${
                                  tx.type === 'income' ? 'text-emerald-600' : 'text-slate-900'
                                }`}
                              >
                                {tx.type === 'income' ? '+' : '-'}
                                {formatCurrency(tx.amount, tx.currency || currency)}
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
