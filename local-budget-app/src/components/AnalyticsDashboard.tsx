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
  Legend,
} from 'recharts';
import {
  Sparkles,
  TrendingUp,
  Store,
  Calendar,
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  PieChart as PieChartIcon,
  RefreshCw,
  PiggyBank,
  Target,
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
import { CategoryIcon } from './CategoryIcon';

interface AnalyticsDashboardProps {
  transactions: Transaction[];
  budgets: Budget[];
  currency: string;
  monthlyBudget: number;
  monthlySavingsGoal: number;
  onLoadDemoData: () => void;
}

type PeriodFilter = 'this_month' | 'last_month' | 'last_3_months' | 'all_time' | 'custom_month';

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  transactions,
  budgets,
  currency,
  monthlyBudget,
  monthlySavingsGoal,
  onLoadDemoData,
}) => {
  const [period, setPeriod] = useState<PeriodFilter>('last_3_months');
  const [customMonth, setCustomMonth] = useState<string>(() =>
    new Date().toISOString().slice(0, 7)
  );
  const [trendChartType, setTrendChartType] = useState<'area' | 'bar'>('area');
  const [coachAdvice, setCoachAdvice] = useState<AICoachAdvice | null>(null);
  const [loadingCoach, setLoadingCoach] = useState(false);

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

  // Savings metrics for selected period
  const netSavings = totalIncome - totalSpent;
  const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;

  // Monthly Cashflow & Savings Breakdown (across all available months, up to last 6)
  const monthlySavingsSeries = useMemo(() => {
    const map = new Map<string, { month: string; income: number; expenses: number; savings: number }>();
    for (const tx of transactions) {
      const m = tx.date.slice(0, 7);
      const entry = map.get(m) || { month: m, income: 0, expenses: 0, savings: 0 };
      if (tx.type === 'income') entry.income += tx.amount;
      else entry.expenses += tx.amount;
      entry.savings = Number((entry.income - entry.expenses).toFixed(2));
      map.set(m, entry);
    }

    return Array.from(map.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6)
      .map((item) => ({
        ...item,
        income: Number(item.income.toFixed(2)),
        expenses: Number(item.expenses.toFixed(2)),
        savings: Number((item.income - item.expenses).toFixed(2)),
      }));
  }, [transactions]);

  // Current month spend & savings for goal trackers
  const currentMonthMetrics = useMemo(() => {
    const prefix = new Date().toISOString().slice(0, 7);
    let spent = 0;
    let income = 0;
    for (const t of transactions) {
      if (!t.date.startsWith(prefix)) continue;
      if (t.type === 'expense') spent += t.amount;
      else income += t.amount;
    }
    const saved = income - spent;
    return {
      spent,
      income,
      saved,
      budgetPct: monthlyBudget > 0 ? (spent / monthlyBudget) * 100 : 0,
      savingsGoalPct:
        monthlySavingsGoal > 0 ? Math.max(0, (saved / monthlySavingsGoal) * 100) : 0,
    };
  }, [transactions, monthlyBudget, monthlySavingsGoal]);

  // Category Breakdown
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
      }));
  }, [expenses, totalSpent]);

  // Daily Spending Trend Data
  const trendData = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of expenses) {
      map.set(tx.date, (map.get(tx.date) || 0) + tx.amount);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, amount]) => ({
        date,
        label: date.slice(5),
        amount: Number(amount.toFixed(2)),
      }));
  }, [expenses]);

  // Top Merchants Leaderboard
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

  // Plain-English Insights
  const smartInsights = useMemo(() => {
    if (expenses.length === 0) return null;

    let weekendSum = 0;
    const weekendDays = new Set<string>();
    let weekdaySum = 0;
    const weekdayDays = new Set<string>();

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
    const avgTx = expenses.length > 0 ? totalSpent / expenses.length : 0;

    return {
      weekendMultiplier,
      cards: [
        {
          title: 'Top Category',
          badge: topCat ? `${topCat.percentage.toFixed(0)}% of spend` : '—',
          text: topCat
            ? `${topCat.category} leads at ${topCat.percentage.toFixed(1)}% (${formatCurrency(
                topCat.amount,
                currency
              )} across ${topCat.count} receipt${topCat.count > 1 ? 's' : ''}).`
            : 'No category data yet.',
        },
        {
          title: 'Weekend vs. Weekday',
          badge: `${weekendMultiplier.toFixed(1)}×`,
          text:
            weekendMultiplier >= 1.15
              ? `Weekend daily spend (${formatCurrency(
                  avgWeekendDay,
                  currency
                )}) is ${weekendMultiplier.toFixed(1)}× higher than weekdays (${formatCurrency(
                  avgWeekdayDay,
                  currency
                )}).`
              : `Weekday spending (${formatCurrency(
                  avgWeekdayDay,
                  currency
                )}/day) is steady compared to weekends (${formatCurrency(
                  avgWeekendDay,
                  currency
                )}/day).`,
        },
        {
          title: 'Average Receipt',
          badge: `${expenses.length} entries`,
          text: `Average receipt total is ${formatCurrency(avgTx, currency)} with ${expenses.reduce(
            (sum, t) => sum + (t.lineItems?.length || 0),
            0
          )} itemized items tracked.`,
        },
        {
          title: 'Savings Rate',
          badge: totalIncome > 0 ? `${savingsRate.toFixed(1)}%` : 'Add income',
          text:
            totalIncome > 0
              ? `You saved ${formatCurrency(netSavings, currency)} (${savingsRate.toFixed(
                  1
                )}% of your ${formatCurrency(totalIncome, currency)} income) in this period.`
              : `Log your monthly income to automatically track your net savings and savings rate.`,
        },
      ],
    };
  }, [expenses, categoryBreakdown, topMerchants, totalSpent, totalIncome, netSavings, savingsRate, currency]);

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
        weekendVsWeekdayRatio: smartInsights?.weekendMultiplier ?? 1.2,
      });
      setCoachAdvice(advice);
    } finally {
      setLoadingCoach(false);
    }
  };

  if (transactions.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-10 text-center">
        <BarChart3 className="w-10 h-10 text-slate-400 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-slate-900">No analytics data yet</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
          Add your first expense or load demo data to view spending breakdowns, savings rate, and trends.
        </p>
        <button
          type="button"
          onClick={onLoadDemoData}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs transition cursor-pointer"
        >
          <span>Load Demo Data</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-24">
      {/* Period Selector */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Calendar className="w-4 h-4 text-slate-400" />
          <div>
            <h2 className="font-semibold text-slate-900 text-sm sm:text-base">
              Analytics & Savings
            </h2>
            <p className="text-xs text-slate-500 tabular-nums">
              Spent <strong className="text-slate-800">{formatCurrency(totalSpent, currency)}</strong>
              {totalIncome > 0 && (
                <>
                  {' '}
                  • Income <strong className="text-emerald-600">{formatCurrency(totalIncome, currency)}</strong>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {(
            [
              { id: 'this_month', label: 'This Month' },
              { id: 'last_month', label: 'Last Month' },
              { id: 'last_3_months', label: '3 Months' },
              { id: 'all_time', label: 'All Time' },
              { id: 'custom_month', label: 'Custom' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setPeriod(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                period === tab.id
                  ? 'bg-slate-900 text-white'
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
              className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-medium"
            />
          )}
        </div>
      </div>

      {/* Savings & Cashflow Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Savings KPIs + Monthly Savings Goal + Budget Thermometer */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PiggyBank className="w-4 h-4 text-emerald-600" />
                <h3 className="font-semibold text-slate-900 text-sm">Savings Overview</h3>
              </div>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-md tabular-nums ${
                  savingsRate >= 20
                    ? 'bg-emerald-50 text-emerald-700'
                    : savingsRate > 0
                    ? 'bg-amber-50 text-amber-700'
                    : 'bg-rose-50 text-rose-700'
                }`}
              >
                {totalIncome > 0 ? `${savingsRate.toFixed(1)}% rate` : 'No income logged'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-[11px] font-medium text-slate-500">Period Net Savings</div>
                <div
                  className={`text-lg font-bold tabular-nums mt-0.5 ${
                    netSavings >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {netSavings >= 0 ? '+' : ''}
                  {formatCurrency(netSavings, currency)}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="text-[11px] font-medium text-slate-500">This Month Saved</div>
                <div
                  className={`text-lg font-bold tabular-nums mt-0.5 ${
                    currentMonthMetrics.saved >= 0 ? 'text-slate-900' : 'text-rose-600'
                  }`}
                >
                  {formatCurrency(currentMonthMetrics.saved, currency)}
                </div>
              </div>
            </div>

            {/* Monthly Savings Goal Progress Bar */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-medium text-slate-600">Monthly Savings Goal</span>
                <span className="font-semibold tabular-nums text-slate-800">
                  {formatCurrency(Math.max(0, currentMonthMetrics.saved), currency)} /{' '}
                  {formatCurrency(monthlySavingsGoal, currency)}
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-600 transition-all duration-500"
                  style={{ width: `${Math.min(100, currentMonthMetrics.savingsGoalPct)}%` }}
                />
              </div>
              <div className="text-[11px] text-slate-500 mt-1.5">
                {currentMonthMetrics.saved >= monthlySavingsGoal
                  ? 'Monthly savings target reached.'
                  : `${formatCurrency(
                      monthlySavingsGoal - Math.max(0, currentMonthMetrics.saved),
                      currency
                    )} more to hit your monthly savings target.`}
              </div>
            </div>
          </div>

          {/* Monthly Budget Thermometer */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-slate-500" />
                <h3 className="font-semibold text-slate-900 text-sm">Monthly Budget</h3>
              </div>
              <span className="text-xs font-semibold tabular-nums text-slate-700">
                {formatCurrency(currentMonthMetrics.spent, currency)} /{' '}
                {formatCurrency(monthlyBudget, currency)} ({currentMonthMetrics.budgetPct.toFixed(0)}%)
              </span>
            </div>

            <div className="relative h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="absolute top-0 bottom-0 left-[75%] w-0.5 bg-amber-400 z-10"
                title="75% Warning Threshold"
              />
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  currentMonthMetrics.budgetPct >= 100
                    ? 'bg-rose-600'
                    : currentMonthMetrics.budgetPct >= 75
                    ? 'bg-amber-500'
                    : 'bg-emerald-600'
                }`}
                style={{ width: `${Math.min(100, currentMonthMetrics.budgetPct)}%` }}
              />
            </div>

            <div className="text-xs">
              {currentMonthMetrics.budgetPct >= 100 ? (
                <span className="inline-flex items-center gap-1.5 text-rose-600 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Over budget by {formatCurrency(currentMonthMetrics.spent - monthlyBudget, currency)}
                </span>
              ) : currentMonthMetrics.budgetPct >= 75 ? (
                <span className="inline-flex items-center gap-1.5 text-amber-700 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Crossed 75% warning ({formatCurrency(monthlyBudget - currentMonthMetrics.spent, currency)} left)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {formatCurrency(monthlyBudget - currentMonthMetrics.spent, currency)} remaining this month
                </span>
              )}
            </div>

            {budgets.filter((b) => b.category !== 'ALL').length > 0 && (
              <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2.5">
                {budgets
                  .filter((b) => b.category !== 'ALL')
                  .map((b) => {
                    const cat = b.category as SpendeeCategory;
                    const spentInCat =
                      categoryBreakdown.find((c) => c.category === cat)?.amount || 0;
                    const pct = b.monthlyLimit > 0 ? (spentInCat / b.monthlyLimit) * 100 : 0;
                    return (
                      <div key={b.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <div className="flex items-center justify-between text-[11px] font-medium text-slate-700 mb-1">
                          <span className="truncate">{cat}</span>
                          <span className="tabular-nums">{pct.toFixed(0)}%</span>
                        </div>
                        <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              pct >= 100 ? 'bg-rose-500' : pct >= 75 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Monthly Income vs Expenses & Net Savings Chart */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-5 border border-slate-200/80 flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="font-semibold text-slate-900 text-sm">
              Monthly Income, Expenses & Net Savings
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Track how much you retain each month across income and spending
            </p>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={monthlySavingsSeries}
                margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value), currency)}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="savings" name="Net Savings" fill="#0f172a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Spending Insights & AI Coach */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-slate-500" />
            <h3 className="font-semibold text-slate-900 text-sm">
              Spending Insights
            </h3>
          </div>

          <button
            type="button"
            disabled={loadingCoach}
            onClick={handleRunAICoach}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs transition cursor-pointer"
          >
            {loadingCoach ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span>
              {loadingCoach
                ? 'Analyzing...'
                : coachAdvice
                ? 'Refresh AI Coach'
                : 'AI Financial Coach'}
            </span>
          </button>
        </div>

        {smartInsights && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {smartInsights.cards.map((card, i) => (
              <div
                key={i}
                className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                    {card.title}
                  </span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 tabular-nums">
                    {card.badge}
                  </span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">{card.text}</p>
              </div>
            ))}
          </div>
        )}

        {coachAdvice && (
          <div className="rounded-xl bg-slate-900 text-white p-5 space-y-4">
            <div>
              <span className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider">
                {coachAdvice.source === 'gemini' ? 'Gemini Financial Coach' : 'Smart Coach'}
              </span>
              <h4 className="text-sm sm:text-base font-semibold text-white mt-1">
                {coachAdvice.headline}
              </h4>
            </div>

            <ul className="space-y-1 text-xs text-slate-300">
              {coachAdvice.habitBreakdown.map((bullet, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-emerald-400">•</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {coachAdvice.savingTips.map((tip, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium text-slate-400">Action {idx + 1}</span>
                    <span className="text-[11px] font-semibold text-emerald-400 tabular-nums">
                      ~{tip.estimatedMonthlySavings}
                    </span>
                  </div>
                  <div className="font-semibold text-xs text-white">{tip.title}</div>
                  <p className="text-xs text-slate-300 leading-relaxed">{tip.action}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Category Donut & Spending Trend + Top Merchants */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 bg-white rounded-2xl p-5 border border-slate-200/80 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-slate-500" />
              <h3 className="font-semibold text-slate-900 text-sm">Spending by Category</h3>
            </div>
            <span className="text-xs text-slate-400">{categoryBreakdown.length} categories</span>
          </div>

          <div className="relative h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryBreakdown}
                  dataKey="amount"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={86}
                  paddingAngle={2}
                >
                  {categoryBreakdown.map((entry) => (
                    <Cell key={entry.category} fill={entry.color} stroke="#ffffff" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(Number(value), currency)} />
              </PieChart>
            </ResponsiveContainer>

            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] uppercase tracking-wider font-medium text-slate-400">
                Spent
              </span>
              <span className="text-base font-bold tabular-nums text-slate-900">
                {formatCurrency(totalSpent, currency)}
              </span>
            </div>
          </div>

          <div className="mt-3 space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {categoryBreakdown.map((item) => (
              <div
                key={item.category}
                className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg hover:bg-slate-50"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="font-medium text-slate-800 truncate">{item.category}</span>
                  <span className="text-slate-400">({item.count})</span>
                </div>
                <div className="flex items-center gap-2.5 shrink-0 tabular-nums">
                  <span className="text-slate-500">{item.percentage.toFixed(1)}%</span>
                  <span className="font-semibold text-slate-900 w-20 text-right">
                    {formatCurrency(item.amount, currency)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-7 bg-white rounded-2xl p-5 border border-slate-200/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-slate-500" />
                <h3 className="font-semibold text-slate-900 text-sm">Daily Spending Trend</h3>
              </div>

              <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setTrendChartType('area')}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                    trendChartType === 'area'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500'
                  }`}
                >
                  Area
                </button>
                <button
                  type="button"
                  onClick={() => setTrendChartType('bar')}
                  className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                    trendChartType === 'bar'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500'
                  }`}
                >
                  Bars
                </button>
              </div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                {trendChartType === 'area' ? (
                  <AreaChart data={trendData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#059669" stopOpacity={0.22} />
                        <stop offset="95%" stopColor="#059669" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip formatter={(val) => [formatCurrency(Number(val), currency), 'Spent']} />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      stroke="#059669"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#spendGradient)"
                    />
                  </AreaChart>
                ) : (
                  <BarChart data={trendData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip formatter={(val) => [formatCurrency(Number(val), currency), 'Spent']} />
                    <Bar dataKey="amount" fill="#0f172a" radius={[4, 4, 0, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Merchants Leaderboard */}
          <div className="mt-5 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2 mb-3">
              <Store className="w-4 h-4 text-slate-500" />
              <h4 className="font-semibold text-slate-900 text-sm">Top Merchants</h4>
            </div>

            <div className="space-y-2.5">
              {topMerchants.map((m) => {
                const meta = CATEGORY_META[m.category] || CATEGORY_META.Other;
                return (
                  <div key={m.merchant} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 font-medium text-slate-800">
                        <span
                          className={`w-6 h-6 rounded-md ${meta.bgLight} ${meta.textColor} flex items-center justify-center`}
                        >
                          <CategoryIcon category={m.category} className="w-3.5 h-3.5" />
                        </span>
                        <span>{m.merchant}</span>
                        <span className="text-slate-400">({m.count}×)</span>
                      </div>
                      <div className="font-semibold tabular-nums text-slate-900">
                        {formatCurrency(m.amount, currency)}
                      </div>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
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
