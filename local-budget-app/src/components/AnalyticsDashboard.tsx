import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import {
  Sparkles,
  Flame,
  TrendingUp,
  Store,
  Calendar,
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  PieChart as PieChartIcon,
  RefreshCw,
} from 'lucide-react';
import {
  CATEGORY_META,
  formatCurrency,
  type Transaction,
  type Budget,
  type SpendeeCategory,
} from '../db/db';
import {
  generateAIFinancialCoachAdvice,
  type AICoachAdvice,
} from '../services/aiReceiptParser';

interface AnalyticsDashboardProps {
  transactions: Transaction[];
  budgets: Budget[];
  currency: string;
  monthlyBudget: number;
  onLoadDemoData: () => void;
}

type PeriodFilter = 'this_month' | 'last_month' | 'last_3_months' | 'all_time' | 'custom_month';

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  transactions,
  budgets,
  currency,
  monthlyBudget,
  onLoadDemoData,
}) => {
  const [period, setPeriod] = useState<PeriodFilter>('last_3_months');
  const [customMonth, setCustomMonth] = useState<string>(() =>
    new Date().toISOString().slice(0, 7)
  );
  const [trendChartType, setTrendChartType] = useState<'area' | 'bar'>('area');
  const [coachAdvice, setCoachAdvice] = useState<AICoachAdvice | null>(null);
  const [loadingCoach, setLoadingCoach] = useState(false);

  // Filter transactions by selected period
  const filteredTransactions = useMemo(() => {
    const now = new Date();
    const thisMonthPrefix = now.toISOString().slice(0, 7);

    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthPrefix = `${lastMonthDate.getFullYear()}-${String(
      lastMonthDate.getMonth() + 1
    ).padStart(2, '0')}`;

    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1)
      .toISOString()
      .split('T')[0];

    return transactions.filter((tx) => {
      if (period === 'this_month') return tx.date.startsWith(thisMonthPrefix);
      if (period === 'last_month') return tx.date.startsWith(lastMonthPrefix);
      if (period === 'last_3_months') return tx.date >= threeMonthsAgo;
      if (period === 'custom_month') return tx.date.startsWith(customMonth);
      return true;
    });
  }, [transactions, period, customMonth]);

  const expenses = useMemo(
    () => filteredTransactions.filter((t) => t.type === 'expense'),
    [filteredTransactions]
  );

  const totalSpent = useMemo(
    () => expenses.reduce((acc, t) => acc + t.amount, 0),
    [expenses]
  );

  const totalIncome = useMemo(
    () =>
      filteredTransactions
        .filter((t) => t.type === 'income')
        .reduce((acc, t) => acc + t.amount, 0),
    [filteredTransactions]
  );

  // 1. Spending by Category Breakdown
  const categoryBreakdown = useMemo(() => {
    const map = new Map<SpendeeCategory, { category: SpendeeCategory; amount: number; count: number }>();
    for (const tx of expenses) {
      const prev = map.get(tx.category) || {
        category: tx.category,
        amount: 0,
        count: 0,
      };
      prev.amount += tx.amount;
      prev.count += 1;
      map.set(tx.category, prev);
    }

    return Array.from(map.values())
      .sort((a, b) => b.amount - a.amount)
      .map((item) => ({
        ...item,
        amount: Number(item.amount.toFixed(2)),
        percentage: totalSpent > 0 ? (item.amount / totalSpent) * 100 : 0,
        color: CATEGORY_META[item.category]?.color || '#64748b',
        emoji: CATEGORY_META[item.category]?.emoji || '📦',
      }));
  }, [expenses, totalSpent]);

  // 2. Daily Spending Trend Data
  const trendData = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of expenses) {
      map.set(tx.date, (map.get(tx.date) || 0) + tx.amount);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, amount]) => ({
        date,
        label: date.slice(5), // MM-DD
        amount: Number(amount.toFixed(2)),
      }));
  }, [expenses]);

  // 3. Top Merchants Leaderboard
  const topMerchants = useMemo(() => {
    const map = new Map<string, { merchant: string; amount: number; count: number; category: SpendeeCategory }>();
    for (const tx of expenses) {
      const key = tx.merchant.trim() || 'Other';
      const existing = map.get(key) || {
        merchant: key,
        amount: 0,
        count: 0,
        category: tx.category,
      };
      existing.amount += tx.amount;
      existing.count += 1;
      map.set(key, existing);
    }
    return Array.from(map.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6)
      .map((m) => ({
        ...m,
        amount: Number(m.amount.toFixed(2)),
        percentage: totalSpent > 0 ? (m.amount / totalSpent) * 100 : 0,
      }));
  }, [expenses, totalSpent]);

  // 4. Plain-English "Explain My Spending" Smart Insights Engine
  const smartInsights = useMemo(() => {
    if (expenses.length === 0) return [];

    // Weekend vs Weekday calculation
    let weekendSum = 0;
    let weekendDays = new Set<string>();
    let weekdaySum = 0;
    let weekdayDays = new Set<string>();

    for (const tx of expenses) {
      const d = new Date(`${tx.date}T12:00:00`);
      const day = d.getDay();
      if (day === 0 || day === 6) {
        weekendSum += tx.amount;
        weekendDays.add(tx.date);
      } else {
        weekdaySum += tx.amount;
        weekdayDays.add(tx.date);
      }
    }

    const avgWeekendDay = weekendDays.size > 0 ? weekendSum / weekendDays.size : 0;
    const avgWeekdayDay = weekdayDays.size > 0 ? weekdaySum / weekdayDays.size : 0;
    const weekendMultiplier =
      avgWeekdayDay > 0 ? avgWeekendDay / avgWeekdayDay : avgWeekendDay > 0 ? 1.8 : 1.0;

    const topCat = categoryBreakdown[0];
    const topMerch = topMerchants[0];
    const avgTx = expenses.length > 0 ? totalSpent / expenses.length : 0;

    return {
      weekendMultiplier,
      cards: [
        {
          title: 'Top Category Driver',
          badge: topCat ? `${topCat.percentage.toFixed(0)}% of spend` : 'N/A',
          text: topCat
            ? `Your top category is ${topCat.emoji} ${topCat.category} at ${topCat.percentage.toFixed(
                1
              )}% of total spend (${formatCurrency(topCat.amount, currency)} across ${
                topCat.count
              } receipt${topCat.count > 1 ? 's' : ''}).`
            : 'No category data yet.',
          accent: 'border-emerald-200 bg-emerald-50/60 text-emerald-950',
        },
        {
          title: 'Weekend vs. Weekday Pattern',
          badge: `${weekendMultiplier.toFixed(1)}x multiplier`,
          text:
            weekendMultiplier >= 1.15
              ? `Weekend daily spending (${formatCurrency(
                  avgWeekendDay,
                  currency
                )}) is ${weekendMultiplier.toFixed(1)}x higher than active weekdays (${formatCurrency(
                  avgWeekdayDay,
                  currency
                )}).`
              : `Your weekday spending (${formatCurrency(
                  avgWeekdayDay,
                  currency
                )}/day) is higher than or equal to weekends (${formatCurrency(
                  avgWeekendDay,
                  currency
                )}/day).`,
          accent: 'border-indigo-200 bg-indigo-50/60 text-indigo-950',
        },
        {
          title: 'Average Receipt & Itemization',
          badge: `${expenses.length} transactions`,
          text: `Average receipt total is ${formatCurrency(avgTx, currency)} across ${
            expenses.length
          } transactions (${expenses.reduce(
            (sum, t) => sum + (t.lineItems?.length || 0),
            0
          )} individual line items tracked).`,
          accent: 'border-amber-200 bg-amber-50/60 text-amber-950',
        },
        {
          title: 'Top Merchant Concentration',
          badge: topMerch ? `${topMerch.count} visit${topMerch.count > 1 ? 's' : ''}` : 'N/A',
          text: topMerch
            ? `${topMerch.merchant} is your #1 merchant, taking ${formatCurrency(
                topMerch.amount,
                currency
              )} (${topMerch.percentage.toFixed(1)}% of all expenses).`
            : 'No merchant data yet.',
          accent: 'border-rose-200 bg-rose-50/60 text-rose-950',
        },
      ],
    };
  }, [expenses, categoryBreakdown, topMerchants, totalSpent, currency]);

  // Monthly Budget Thermometer computation (always checks current month spend vs target)
  const currentMonthSpend = useMemo(() => {
    const prefix = new Date().toISOString().slice(0, 7);
    return transactions
      .filter((t) => t.type === 'expense' && t.date.startsWith(prefix))
      .reduce((acc, t) => acc + t.amount, 0);
  }, [transactions]);

  const budgetPercentage =
    monthlyBudget > 0 ? (currentMonthSpend / monthlyBudget) * 100 : 0;

  const handleRunAICoach = async () => {
    setLoadingCoach(true);
    try {
      const advice = await generateAIFinancialCoachAdvice({
        periodLabel: period.replace(/_/g, ' ').toUpperCase(),
        currency,
        totalSpent,
        monthlyBudget,
        categoryTotals: categoryBreakdown.map((c) => ({
          category: c.category,
          amount: c.amount,
          percentage: c.percentage,
        })),
        topMerchants: topMerchants.map((m) => ({
          merchant: m.merchant,
          amount: m.amount,
          count: m.count,
        })),
        weekendVsWeekdayRatio:
          !Array.isArray(smartInsights) && smartInsights.weekendMultiplier
            ? smartInsights.weekendMultiplier
            : 1.2,
      });
      setCoachAdvice(advice);
    } finally {
      setLoadingCoach(false);
    }
  };

  if (transactions.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-10 text-center shadow-2xs">
        <BarChart3 className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
        <h3 className="text-xl font-bold text-slate-900">
          No Analytics Data Yet
        </h3>
        <p className="text-sm text-slate-600 max-w-md mx-auto mt-1">
          Load our realistic demo receipts or scan your first receipt to unlock Spendee donut charts, spending trends, and the AI Financial Coach.
        </p>
        <button
          type="button"
          onClick={onLoadDemoData}
          className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-sm transition cursor-pointer"
        >
          <Sparkles className="w-4 h-4" />
          <span>Load Demo Data to Preview Analytics</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Period Selector Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-emerald-600" />
          <div>
            <h2 className="font-bold text-slate-900 text-base">
              Financial Analytics & Spending Insights
            </h2>
            <p className="text-xs text-slate-500">
              Showing {expenses.length} expenses totaling{' '}
              <strong className="text-slate-800">{formatCurrency(totalSpent, currency)}</strong>
              {totalIncome > 0 && (
                <span>
                  {' '}
                  • Income: <strong className="text-emerald-600">{formatCurrency(totalIncome, currency)}</strong>
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'this_month', label: 'This Month' },
              { id: 'last_month', label: 'Last Month' },
              { id: 'last_3_months', label: 'Last 3 Months' },
              { id: 'all_time', label: 'All Time' },
              { id: 'custom_month', label: 'Custom Month' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setPeriod(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                period === tab.id
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}

          {period === 'custom_month' && (
            <input
              type="month"
              value={customMonth}
              onChange={(e) => setCustomMonth(e.target.value)}
              className="px-2.5 py-1 rounded-xl border border-slate-200 text-xs font-semibold"
            />
          )}
        </div>
      </div>

      {/* Monthly Budget Thermometer */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Flame
              className={`w-5 h-5 ${
                budgetPercentage >= 100
                  ? 'text-rose-600'
                  : budgetPercentage >= 75
                  ? 'text-amber-500'
                  : 'text-emerald-600'
              }`}
            />
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">
              Monthly Budget Thermometer
            </h3>
          </div>
          <div className="text-xs sm:text-sm font-semibold text-slate-700">
            <span className="text-slate-900 font-bold">
              {formatCurrency(currentMonthSpend, currency)}
            </span>{' '}
            of {formatCurrency(monthlyBudget, currency)} ({budgetPercentage.toFixed(1)}%)
          </div>
        </div>

        {/* Thermometer Bar with 75% and 100% markers */}
        <div className="relative h-4 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
          <div
            className="absolute top-0 bottom-0 left-[75%] w-0.5 bg-amber-400 z-10"
            title="75% Warning Threshold"
          />
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              budgetPercentage >= 100
                ? 'bg-gradient-to-r from-amber-500 to-rose-600'
                : budgetPercentage >= 75
                ? 'bg-gradient-to-r from-emerald-500 to-amber-500'
                : 'bg-gradient-to-r from-emerald-400 to-emerald-600'
            }`}
            style={{ width: `${Math.min(100, budgetPercentage)}%` }}
          />
        </div>

        <div className="mt-2.5 flex items-center justify-between text-xs">
          {budgetPercentage >= 100 ? (
            <span className="inline-flex items-center gap-1.5 text-rose-600 font-semibold">
              <AlertTriangle className="w-4 h-4" />
              Budget exceeded by {formatCurrency(currentMonthSpend - monthlyBudget, currency)}!
            </span>
          ) : budgetPercentage >= 75 ? (
            <span className="inline-flex items-center gap-1.5 text-amber-700 font-semibold">
              <AlertTriangle className="w-4 h-4" />
              Heads up: You have crossed 75% of your monthly target ({formatCurrency(monthlyBudget - currentMonthSpend, currency)} left).
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
              <CheckCircle2 className="w-4 h-4" />
              On track! {formatCurrency(monthlyBudget - currentMonthSpend, currency)} remaining this month.
            </span>
          )}
          <span className="text-slate-400 hidden sm:inline">75% Warning • 100% Limit</span>
        </div>

        {/* Optional Category Sub-Budgets */}
        {budgets.filter((b) => b.category !== 'ALL').length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {budgets
              .filter((b) => b.category !== 'ALL')
              .map((b) => {
                const cat = b.category as SpendeeCategory;
                const spentInCat =
                  categoryBreakdown.find((c) => c.category === cat)?.amount || 0;
                const pct = b.monthlyLimit > 0 ? (spentInCat / b.monthlyLimit) * 100 : 0;
                return (
                  <div key={b.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1">
                      <span>
                        {CATEGORY_META[cat]?.emoji} {cat}
                      </span>
                      <span>{pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          pct >= 100 ? 'bg-rose-500' : pct >= 75 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      {formatCurrency(spentInCat, currency)} / {formatCurrency(b.monthlyLimit, currency)}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* "Explain My Spending" Smart Insights Engine + AI Deep Financial Coach */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Lightbulb className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                “Explain My Spending” Smart Insights
              </h3>
              <p className="text-xs text-slate-500">
                Plain-English breakdown of your financial habits & AI coaching
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={loadingCoach}
            onClick={handleRunAICoach}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-semibold text-xs sm:text-sm shadow-sm transition cursor-pointer"
          >
            {loadingCoach ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 text-amber-300" />
            )}
            <span>
              {loadingCoach
                ? 'Analyzing Spending Habits...'
                : coachAdvice
                ? 'Refresh AI Deep Financial Coach'
                : 'Ask AI Deep Financial Coach'}
            </span>
          </button>
        </div>

        {/* 4 Auto-Computed Plain-English Insight Cards */}
        {!Array.isArray(smartInsights) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {smartInsights.cards.map((card, i) => (
              <div
                key={i}
                className={`p-4 rounded-2xl border ${card.accent} flex flex-col justify-between`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider opacity-75">
                    {card.title}
                  </span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/80 shadow-2xs">
                    {card.badge}
                  </span>
                </div>
                <p className="text-xs sm:text-sm font-medium leading-relaxed">{card.text}</p>
              </div>
            ))}
          </div>
        )}

        {/* AI Deep Financial Coach Output Panel */}
        {coachAdvice && (
          <div className="mt-4 rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-5 shadow-lg space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 mb-2">
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  {coachAdvice.source === 'gemini'
                    ? 'Gemini Flash Deep Financial Coach'
                    : 'SpendeeAI Smart Local Financial Coach'}
                </span>
                <h4 className="text-base sm:text-lg font-bold text-white">
                  {coachAdvice.headline}
                </h4>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
                Spending Habit Breakdown
              </div>
              <ul className="space-y-1 text-xs sm:text-sm text-slate-200">
                {coachAdvice.habitBreakdown.map((bullet, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">•</span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-emerald-300 mb-2.5">
                3 Concrete Ways to Save Money Next Month
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {coachAdvice.savingTips.map((tip, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-white/10 border border-white/10 backdrop-blur-xs flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-xs font-bold text-emerald-300">
                          Tip #{idx + 1}
                        </span>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/25 text-emerald-200">
                          Save ~{tip.estimatedMonthlySavings}
                        </span>
                      </div>
                      <div className="font-semibold text-sm text-white mb-1">
                        {tip.title}
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{tip.action}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Visual Charts Row: 1. Category Donut Chart & 2. Daily/Weekly Spending Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 1. Spending by Category Donut Chart */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <PieChartIcon className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-slate-900 text-base">
                Spending by Category
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-medium">
              {categoryBreakdown.length} categories
            </span>
          </div>

          <div className="relative h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryBreakdown}
                  dataKey="amount"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  innerRadius={62}
                  outerRadius={92}
                  paddingAngle={3}
                >
                  {categoryBreakdown.map((entry) => (
                    <Cell key={entry.category} fill={entry.color} stroke="#ffffff" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value), currency)}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Center Donut Total Label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                Total Spend
              </span>
              <span className="text-lg font-extrabold text-slate-900">
                {formatCurrency(totalSpent, currency)}
              </span>
            </div>
          </div>

          {/* Percentage Breakdown List Below */}
          <div className="mt-3 space-y-2 max-h-56 overflow-y-auto pr-1">
            {categoryBreakdown.map((item) => (
              <div
                key={item.category}
                className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-xl hover:bg-slate-50"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="font-semibold text-slate-800 truncate">
                    {item.emoji} {item.category}
                  </span>
                  <span className="text-slate-400">({item.count})</span>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="text-slate-500 font-medium">
                    {item.percentage.toFixed(1)}%
                  </span>
                  <span className="font-bold text-slate-900 w-20 text-right">
                    {formatCurrency(item.amount, currency)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 2. Daily / Weekly Spending Trend Chart */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Spending Trend Over Time
                  </h3>
                  <p className="text-xs text-slate-500">
                    Daily outflow spikes across the selected period
                  </p>
                </div>
              </div>

              <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setTrendChartType('area')}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                    trendChartType === 'area'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600'
                  }`}
                >
                  Area
                </button>
                <button
                  type="button"
                  onClick={() => setTrendChartType('bar')}
                  className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                    trendChartType === 'bar'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600'
                  }`}
                >
                  Bars
                </button>
              </div>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                {trendChartType === 'area' ? (
                  <AreaChart data={trendData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip
                      formatter={(val) => [formatCurrency(Number(val), currency), 'Spent']}
                    />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#spendGradient)"
                    />
                  </AreaChart>
                ) : (
                  <BarChart data={trendData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip
                      formatter={(val) => [formatCurrency(Number(val), currency), 'Spent']}
                    />
                    <Bar dataKey="amount" fill="#6366f1" radius={[6, 6, 0, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* 3. Top Merchants Leaderboard inside right column footer */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-amber-600" />
                <h4 className="font-bold text-slate-900 text-sm">
                  Top Merchants Leaderboard
                </h4>
              </div>
              <span className="text-xs text-slate-400">Most money spent</span>
            </div>

            <div className="space-y-2.5">
              {topMerchants.map((m, idx) => {
                const meta = CATEGORY_META[m.category] || CATEGORY_META.Other;
                return (
                  <div key={m.merchant} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 font-semibold text-slate-800">
                        <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[11px] font-bold">
                          {idx + 1}
                        </span>
                        <span>{meta.emoji}</span>
                        <span>{m.merchant}</span>
                        <span className="text-slate-400 font-normal">
                          ({m.count} visit{m.count > 1 ? 's' : ''})
                        </span>
                      </div>
                      <div className="font-bold text-slate-900">
                        {formatCurrency(m.amount, currency)}{' '}
                        <span className="text-slate-400 font-normal">
                          ({m.percentage.toFixed(0)}%)
                        </span>
                      </div>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, m.percentage)}%`,
                          backgroundColor: meta.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
