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
} from 'lucide-react';
import {
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
    <div className="space-y-10 pb-28">
      {/* Wise/Revolut Editorial Hero & Pill Actions */}
      <section className="space-y-6">
        <div className="space-y-1.5">
          <div className="text-sm font-medium text-[#5D615C]">
            Spent this month
          </div>
          <div className="flex items-baseline gap-3 flex-wrap">
            <h1 className="text-4xl sm:text-5xl font-display font-extrabold tabular-nums text-[#0E0F0C] tracking-tight">
              {formatCurrency(stats.monthExpenses, currency)}
            </h1>
            <span className="text-sm font-medium text-[#5D615C] tabular-nums">
              of {formatCurrency(monthlyBudget, currency)} budget
            </span>
          </div>
        </div>

        {/* Iconic Wise Pill Action Rail */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={onOpenCamera}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#9FE870] hover:bg-[#8EDE5C] text-[#163300] font-semibold text-sm transition cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            <span>Scan receipt</span>
          </button>

          <button
            type="button"
            onClick={onOpenManualEntry}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-[#EDF0EC] hover:bg-[#E2E7E0] text-[#163300] font-semibold text-sm transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add entry</span>
          </button>

          <button
            type="button"
            onClick={onTriggerFileUpload}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-[#EDF0EC] hover:bg-[#E2E7E0] text-[#163300] font-semibold text-sm transition cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Upload</span>
          </button>

          <button
            type="button"
            onClick={onPasteClipboard}
            title="Paste screenshot (Ctrl+V)"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-[#EDF0EC] hover:bg-[#E2E7E0] text-[#163300] font-semibold text-sm transition cursor-pointer"
          >
            <ClipboardPaste className="w-4 h-4" />
            <span>Paste</span>
          </button>
        </div>
      </section>

      {/* Wise-Style Borderless Warm-Stone Balance Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#F2F5F2] rounded-3xl p-6 flex flex-col justify-between min-h-[144px]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#5D615C]">
              Budget left
            </span>
            <span className="text-xs font-semibold tabular-nums text-[#5D615C]">
              {Math.round(stats.budgetPct)}% used
            </span>
          </div>
          <div className="space-y-3 mt-4">
            <div
              className={`text-2xl font-display font-bold tabular-nums ${
                stats.budgetRemaining < 0 ? 'text-[#A8200D]' : 'text-[#0E0F0C]'
              }`}
            >
              {formatCurrency(stats.budgetRemaining, currency)}
            </div>
            <div className="w-full h-1.5 bg-[#E0E5DF] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  stats.budgetPct >= 100
                    ? 'bg-[#A8200D]'
                    : stats.budgetPct >= 75
                    ? 'bg-amber-600'
                    : 'bg-[#163300]'
                }`}
                style={{ width: `${Math.min(100, stats.budgetPct)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="bg-[#F2F5F2] rounded-3xl p-6 flex flex-col justify-between min-h-[144px]">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#5D615C]">
            Income
          </span>
          <div className="mt-4">
            <div className="text-2xl font-display font-bold tabular-nums text-[#2F5711]">
              {stats.monthIncome > 0 ? '+' : ''}
              {formatCurrency(stats.monthIncome, currency)}
            </div>
            <div className="text-xs text-[#6A6C6A] mt-1">This month inflows</div>
          </div>
        </div>

        <div className="bg-[#F2F5F2] rounded-3xl p-6 flex flex-col justify-between min-h-[144px]">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#5D615C]">
            Net saved
          </span>
          <div className="mt-4">
            <div
              className={`text-2xl font-display font-bold tabular-nums ${
                stats.monthSavings >= 0 ? 'text-[#0E0F0C]' : 'text-[#A8200D]'
              }`}
            >
              {stats.monthSavings >= 0 ? '+' : ''}
              {formatCurrency(stats.monthSavings, currency)}
            </div>
            <div className="text-xs text-[#6A6C6A] mt-1">Income minus spend</div>
          </div>
        </div>
      </section>

      {/* Pending / Offline Queue Strip (Only shown when active) */}
      {pendingReceipts.length > 0 && (
        <section className="rounded-3xl bg-[#F2F5F2] p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-full bg-white border border-[#E2E5E0] text-[#163300] flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-semibold text-[#0E0F0C] text-sm">
                  {pendingReceipts.length} receipt{pendingReceipts.length > 1 ? 's' : ''} waiting in queue
                </h3>
                <p className="text-xs text-[#5D615C] mt-0.5">
                  {isOffline
                    ? 'Offline mode active. Saved locally until you reconnect.'
                    : 'Ready to extract into transactions.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {!isOffline && (
                <button
                  type="button"
                  disabled={isSyncingQueue}
                  onClick={onSyncQueueNow}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#9FE870] hover:bg-[#8EDE5C] disabled:opacity-50 text-[#163300] text-xs font-semibold transition cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingQueue ? 'animate-spin' : ''}`} />
                  <span>{isSyncingQueue ? 'Syncing...' : 'Sync now'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={onOpenQueueTab}
                className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-white hover:bg-[#E8EDE7] text-[#163300] text-xs font-semibold transition cursor-pointer"
              >
                <span>Open queue</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar">
            {pendingReceipts.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={onOpenQueueTab}
                className="flex items-center gap-2.5 bg-white px-3 py-2 rounded-2xl hover:bg-[#FAFBF9] transition shrink-0 text-left cursor-pointer"
              >
                <img
                  src={item.imageDataUrl}
                  alt="Queued receipt"
                  className="w-9 h-9 rounded-xl object-cover bg-[#F2F5F2]"
                />
                <div>
                  <div className="text-xs font-semibold text-[#0E0F0C] truncate max-w-[120px]">
                    {item.fileName || 'Receipt'}
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-[#5D615C]">
                    {item.status === 'processing' ? (
                      <>
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>Processing</span>
                      </>
                    ) : item.status === 'failed' ? (
                      <>
                        <AlertCircle className="w-3 h-3 text-[#A8200D]" />
                        <span className="text-[#A8200D]">Failed</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-[#2F5711]" />
                        <span>Queued</span>
                      </>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Transactions Section */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-display font-bold text-[#0E0F0C]">
            Transactions
          </h2>
          {transactions.length > 0 && (
            <button
              type="button"
              onClick={onExportSummaryCSV}
              className="text-sm font-semibold text-[#163300] underline underline-offset-4 hover:opacity-75 transition cursor-pointer"
            >
              Export CSV
            </button>
          )}
        </div>

        {transactions.length === 0 ? (
          <div className="rounded-3xl bg-[#F2F5F2] p-12 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-white border border-[#E2E5E0] text-[#163300] flex items-center justify-center mx-auto">
              <Receipt className="w-6 h-6" strokeWidth={1.7} />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-display font-bold text-[#0E0F0C]">
                No transactions yet
              </h3>
              <p className="text-sm text-[#5D615C] max-w-sm mx-auto">
                Scan a receipt, add an expense manually, or load realistic demo data to explore Manni.
              </p>
            </div>
            <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={onOpenManualEntry}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-[#9FE870] hover:bg-[#8EDE5C] text-[#163300] font-semibold text-sm transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add first expense</span>
              </button>
              <button
                type="button"
                onClick={onLoadDemoData}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-white hover:bg-[#E8EDE7] text-[#163300] font-semibold text-sm transition cursor-pointer"
              >
                <span>Load demo data</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Minimalist Pill Search & Filters */}
            <div className="space-y-3.5">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-[#6A6C6A] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search merchants, notes, or items"
                    className="w-full pl-11 pr-4 py-2.5 text-sm rounded-full bg-[#F2F5F2] text-[#0E0F0C] placeholder:text-[#6A6C6A] focus:outline-none focus:ring-2 focus:ring-[#163300]/20 transition"
                  />
                </div>

                {/* Wise-style Segmented Pill Switch */}
                <div className="inline-flex rounded-full bg-[#EDF0EC] p-1 text-xs font-semibold self-start sm:self-auto">
                  {(['all', 'expense', 'income'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTypeFilter(t)}
                      className={`px-4 py-1.5 rounded-full capitalize transition cursor-pointer ${
                        typeFilter === t
                          ? 'bg-white text-[#163300] shadow-2xs'
                          : 'text-[#5D615C] hover:text-[#0E0F0C]'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Clean Horizontal Category Pills */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('ALL')}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold shrink-0 transition cursor-pointer ${
                    selectedCategory === 'ALL'
                      ? 'bg-[#163300] text-white'
                      : 'bg-[#EDF0EC] text-[#5D615C] hover:text-[#0E0F0C]'
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
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold shrink-0 transition cursor-pointer ${
                        isActive
                          ? 'bg-[#163300] text-white'
                          : 'bg-[#EDF0EC] text-[#5D615C] hover:text-[#0E0F0C]'
                      }`}
                    >
                      <CategoryIcon category={cat} className="w-3.5 h-3.5" />
                      <span>{cat}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Airy, Borderless Wise-Style Transaction List */}
            {groupedByDate.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-[#5D615C]">No transactions match your filter.</p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('ALL');
                    setTypeFilter('all');
                  }}
                  className="mt-2 text-sm font-semibold text-[#163300] underline underline-offset-4 cursor-pointer"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="space-y-7 pt-1">
                {groupedByDate.map((group) => (
                  <div key={group.date}>
                    <div className="flex items-center justify-between pb-2.5 border-b border-[#ECEFEA]">
                      <span className="text-xs font-semibold text-[#6A6C6A]">
                        {formatHumanDate(group.date)}
                      </span>
                      <span
                        className={`text-xs font-semibold tabular-nums ${
                          group.dayTotal < 0 ? 'text-[#6A6C6A]' : 'text-[#2F5711]'
                        }`}
                      >
                        {group.dayTotal > 0 ? '+' : ''}
                        {formatCurrency(group.dayTotal, currency)}
                      </span>
                    </div>

                    <div className="divide-y divide-[#F2F4F1]">
                      {group.items.map((tx) => (
                        <button
                          key={tx.id}
                          type="button"
                          onClick={() => onSelectTransaction(tx)}
                          className="w-full py-4 -mx-3 px-3 rounded-2xl flex items-center justify-between gap-4 hover:bg-[#F7F9F7] transition text-left cursor-pointer group"
                        >
                          <div className="flex items-center gap-4 min-w-0">
                            {/* Crisp Wise-Style 44px Circular Outlined Icon */}
                            <div className="relative w-11 h-11 rounded-full border border-[#E2E5E0] bg-white text-[#163300] flex items-center justify-center shrink-0">
                              <CategoryIcon category={tx.category} className="w-[18px] h-[18px]" />
                              {tx.receiptImageDataUrl && (
                                <span
                                  title="Receipt photo attached"
                                  className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#9FE870] text-[#163300] flex items-center justify-center"
                                >
                                  <Receipt className="w-2.5 h-2.5" />
                                </span>
                              )}
                            </div>

                            <div className="min-w-0 space-y-0.5">
                              <div className="font-semibold text-[#0E0F0C] text-[15px] truncate">
                                {tx.merchant}
                              </div>
                              <div className="text-[13px] text-[#6A6C6A] truncate">
                                {tx.category}
                                {tx.lineItems && tx.lineItems.length > 0
                                  ? ` · ${tx.lineItems.length} item${tx.lineItems.length > 1 ? 's' : ''}`
                                  : tx.note
                                  ? ` · ${tx.note}`
                                  : ''}
                              </div>
                            </div>
                          </div>

                          <div className="text-right tabular-nums shrink-0">
                            <div
                              className={`text-[15px] font-bold ${
                                tx.type === 'income' ? 'text-[#2F5711]' : 'text-[#0E0F0C]'
                              }`}
                            >
                              {tx.type === 'income' ? '+' : '-'}
                              {formatCurrency(tx.amount, tx.currency || currency)}
                            </div>
                            {tx.note && tx.lineItems && tx.lineItems.length > 0 && (
                              <div className="text-[12px] text-[#868A84] truncate max-w-[140px]">
                                {tx.note}
                              </div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
};
