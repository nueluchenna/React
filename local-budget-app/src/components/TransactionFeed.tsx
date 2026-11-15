import React, { useMemo, useState } from 'react';
import {
  Search,
  Sparkles,
  Receipt,
  Clock,
  RefreshCw,
  Plus,
  Camera,
  ClipboardPaste,
  ChevronRight,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  Wallet,
  Target,
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

interface TransactionFeedProps {
  transactions: Transaction[];
  pendingReceipts: PendingReceipt[];
  currency: string;
  monthlyBudget: number;
  isOffline: boolean;
  isSyncingQueue: boolean;
  onSelectTransaction: (tx: Transaction) => void;
  onOpenManualEntry: () => void;
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

  // Current month totals
  const currentMonthPrefix = useMemo(() => new Date().toISOString().slice(0, 7), []);

  const stats = useMemo(() => {
    let monthExpenses = 0;
    let monthIncome = 0;
    let totalExpenses = 0;
    let totalIncome = 0;

    for (const tx of transactions) {
      const isThisMonth = tx.date.startsWith(currentMonthPrefix);
      if (tx.type === 'expense') {
        totalExpenses += tx.amount;
        if (isThisMonth) monthExpenses += tx.amount;
      } else {
        totalIncome += tx.amount;
        if (isThisMonth) monthIncome += tx.amount;
      }
    }

    const netBalance = totalIncome - totalExpenses;
    const budgetRemaining = monthlyBudget - monthExpenses;
    const budgetPct = monthlyBudget > 0 ? Math.min(100, (monthExpenses / monthlyBudget) * 100) : 0;

    return {
      monthExpenses,
      monthIncome,
      totalExpenses,
      totalIncome,
      netBalance,
      budgetRemaining,
      budgetPct,
    };
  }, [transactions, currentMonthPrefix, monthlyBudget]);

  // Filtered and date-grouped transactions
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
    <div className="space-y-6 pb-24">
      {/* Top Quick-Scan Action Bar */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 rounded-2xl p-4 sm:p-5 text-white shadow-lg shadow-emerald-900/10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/15 text-xs font-medium mb-1.5 backdrop-blur-xs">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Instant AI Receipt & Screenshot Scanner</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold tracking-tight">
              Snap, Upload, or Paste Any Receipt
            </h2>
            <p className="text-xs sm:text-sm text-emerald-50/90 mt-0.5">
              Works online (Gemini Flash Structured JSON) & offline (Auto-Sync Queue + Local OCR).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onTriggerFileUpload}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white text-emerald-900 font-semibold text-sm shadow-sm hover:bg-emerald-50 active:scale-[0.99] transition cursor-pointer"
            >
              <Camera className="w-4 h-4 text-emerald-600" />
              <span>Snap / Upload</span>
            </button>

            <button
              type="button"
              onClick={onPasteClipboard}
              title="Paste screenshot from clipboard (or press Ctrl+V anywhere)"
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-medium text-sm backdrop-blur-xs transition cursor-pointer"
            >
              <ClipboardPaste className="w-4 h-4" />
              <span>Paste (Ctrl+V)</span>
            </button>

            <button
              type="button"
              onClick={onOpenManualEntry}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-900/30 hover:bg-slate-900/45 text-white font-medium text-sm transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Manual</span>
            </button>
          </div>
        </div>
      </div>

      {/* Prominent Offline Queue Banner when receipts are waiting */}
      {pendingReceipts.length > 0 && (
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/95 p-4 shadow-sm transition-all">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500 text-white shrink-0 mt-0.5">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-amber-950 text-sm sm:text-base">
                    Offline Queue ({pendingReceipts.length} waiting)
                  </h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900 font-medium">
                    {isOffline ? 'Waiting for Connection' : 'Ready to Sync'}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-amber-800 mt-0.5">
                  {isOffline
                    ? 'Receipts are compressed and safely stored in IndexedDB. Toggle back to "Online" to auto-extract with AI!'
                    : 'Internet connection is active — queued receipts can be extracted into transactions right now.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {!isOffline && (
                <button
                  type="button"
                  disabled={isSyncingQueue}
                  onClick={onSyncQueueNow}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold shadow-xs transition cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${isSyncingQueue ? 'animate-spin' : ''}`} />
                  <span>{isSyncingQueue ? 'Extracting...' : 'Sync Now'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={onOpenQueueTab}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs sm:text-sm font-medium transition cursor-pointer"
              >
                <span>Inspect</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Thumbnail preview strip of queued receipt screenshots */}
          <div className="mt-3 pt-3 border-t border-amber-200/80 flex items-center gap-3 overflow-x-auto pb-1">
            {pendingReceipts.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={onOpenQueueTab}
                className="group relative flex items-center gap-2.5 bg-white p-2 rounded-xl border border-amber-200 shadow-2xs hover:border-amber-400 transition shrink-0 text-left cursor-pointer"
              >
                <img
                  src={item.imageDataUrl}
                  alt="Queued receipt preview"
                  className="w-11 h-11 rounded-lg object-cover border border-slate-200 bg-slate-100"
                />
                <div className="pr-2">
                  <div className="text-xs font-semibold text-slate-800 truncate max-w-[120px]">
                    {item.fileName || 'Receipt Scan'}
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-amber-700 font-medium">
                    {item.status === 'processing' ? (
                      <>
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>Extracting...</span>
                      </>
                    ) : item.status === 'failed' ? (
                      <>
                        <AlertCircle className="w-3 h-3 text-rose-600" />
                        <span className="text-rose-600">Retry needed</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Saved locally</span>
                      </>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 4 Spendee-Style Financial Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
            <span>This Month Spend</span>
            <span className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
              <TrendingDown className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900">
            {formatCurrency(stats.monthExpenses, currency)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Across {transactions.filter((t) => t.type === 'expense' && t.date.startsWith(currentMonthPrefix)).length} expenses
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
            <span>This Month Income</span>
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-emerald-600">
            +{formatCurrency(stats.monthIncome, currency)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            All-time net: {formatCurrency(stats.netBalance, currency)}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
            <span>Monthly Budget Left</span>
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
              <Target className="w-4 h-4" />
            </span>
          </div>
          <div
            className={`text-xl sm:text-2xl font-bold ${
              stats.budgetRemaining < 0 ? 'text-rose-600' : 'text-slate-900'
            }`}
          >
            {formatCurrency(stats.budgetRemaining, currency)}
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-2">
            <div
              className={`h-full rounded-full transition-all ${
                stats.budgetPct >= 100
                  ? 'bg-rose-500'
                  : stats.budgetPct >= 75
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, stats.budgetPct)}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
            <span>Total Receipts & Items</span>
            <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <Wallet className="w-4 h-4" />
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900">
            {transactions.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {transactions.reduce((acc, t) => acc + (t.lineItems?.length || 0), 0)} itemized line items
          </div>
        </div>
      </div>

      {/* Empty State with 1-Click Demo Data Loader */}
      {transactions.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-8 sm:p-12 text-center shadow-2xs">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
            <Receipt className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">
            Your SpendeeAI Feed is Empty
          </h3>
          <p className="text-sm text-slate-600 max-w-md mx-auto mt-1.5">
            Snap or upload a receipt screenshot above, add a manual expense, or load realistic demo receipts to test charts, AI insights, and CSV exports right away.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={onLoadDemoData}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-sm transition cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Load Realistic Demo Data (15 Receipts)</span>
            </button>
            <button
              type="button"
              onClick={onOpenManualEntry}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium text-sm transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add First Expense</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Search & Category Filter Bar */}
          <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search merchant, notes, or individual receipt line items (e.g. 'avocado', 'ramen')..."
                  className="w-full pl-9 pr-4 py-2 text-sm rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-medium">
                  {(['all', 'expense', 'income'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTypeFilter(t)}
                      className={`px-3 py-1.5 rounded-lg capitalize transition cursor-pointer ${
                        typeFilter === t
                          ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={onExportSummaryCSV}
                  title="Quick Export Summary CSV"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-medium text-slate-700 transition cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span className="hidden md:inline">Export CSV</span>
                </button>
              </div>
            </div>

            {/* Horizontal Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <span className="inline-flex items-center gap-1 text-xs text-slate-400 pr-1 shrink-0">
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </span>
              <button
                type="button"
                onClick={() => setSelectedCategory('ALL')}
                className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 transition cursor-pointer ${
                  selectedCategory === 'ALL'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Categories ({transactions.length})
              </button>
              {SPENDEE_CATEGORIES.map((cat) => {
                const meta = CATEGORY_META[cat];
                const isActive = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(isActive ? 'ALL' : cat)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium shrink-0 border transition cursor-pointer ${
                      isActive
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                        : `${meta.bgLight} ${meta.textColor} ${meta.borderColor} hover:opacity-90`
                    }`}
                  >
                    <span>{meta.emoji}</span>
                    <span>{cat}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date-Grouped Spendee Transaction List */}
          {groupedByDate.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-slate-200/80">
              <p className="text-slate-600 font-medium">No transactions match your filter.</p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('ALL');
                  setTypeFilter('all');
                }}
                className="mt-3 text-xs font-semibold text-emerald-600 hover:underline cursor-pointer"
              >
                Reset filters
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedByDate.map((group) => (
                <div
                  key={group.date}
                  className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden"
                >
                  {/* Group Date Header */}
                  <div className="px-4 py-2.5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      {formatHumanDate(group.date)}
                    </span>
                    <span
                      className={`text-xs font-semibold ${
                        group.dayTotal < 0 ? 'text-slate-700' : 'text-emerald-600'
                      }`}
                    >
                      {group.dayTotal > 0 ? '+' : ''}
                      {formatCurrency(group.dayTotal, currency)}
                    </span>
                  </div>

                  {/* Transactions in Date Group */}
                  <div className="divide-y divide-slate-100">
                    {group.items.map((tx) => {
                      const meta = CATEGORY_META[tx.category] || CATEGORY_META.Other;
                      return (
                        <button
                          key={tx.id}
                          type="button"
                          onClick={() => onSelectTransaction(tx)}
                          className="w-full px-4 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/90 transition text-left cursor-pointer group"
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            {/* Category Icon Badge or Receipt Thumbnail */}
                            <div
                              className={`relative w-11 h-11 rounded-2xl ${meta.bgLight} ${meta.borderColor} border flex items-center justify-center text-xl shrink-0`}
                            >
                              <span>{meta.emoji}</span>
                              {tx.receiptImageDataUrl && (
                                <span
                                  title="Has original receipt image"
                                  className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-2xs"
                                >
                                  <Receipt className="w-2.5 h-2.5" />
                                </span>
                              )}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-slate-900 text-sm sm:text-base truncate">
                                  {tx.merchant}
                                </span>
                                <span
                                  className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${meta.bgLight} ${meta.textColor}`}
                                >
                                  {tx.category}
                                </span>
                                {tx.source === 'ai_receipt' && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    <Sparkles className="w-2.5 h-2.5" />
                                    AI Receipt
                                  </span>
                                )}
                              </div>

                              <div className="text-xs text-slate-500 truncate mt-0.5 flex items-center gap-2">
                                <span>{tx.note || tx.category}</span>
                                {tx.lineItems && tx.lineItems.length > 0 && (
                                  <span className="text-[11px] text-slate-400 font-medium">
                                    • {tx.lineItems.length} item{tx.lineItems.length > 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5 shrink-0">
                            <div className="text-right">
                              <div
                                className={`text-sm sm:text-base font-bold ${
                                  tx.type === 'income' ? 'text-emerald-600' : 'text-slate-900'
                                }`}
                              >
                                {tx.type === 'income' ? '+' : '-'}
                                {formatCurrency(tx.amount, tx.currency || currency)}
                              </div>
                              {tx.taxAmount ? (
                                <div className="text-[10px] text-slate-400">
                                  incl. {formatCurrency(tx.taxAmount, tx.currency || currency)} tax
                                </div>
                              ) : null}
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
