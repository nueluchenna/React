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
  AlertTriangle,
  CheckCircle2,
  BarChart3,
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

  const netSavings = totalIncome - totalSpent;
  const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;

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
        color: CATEGORY_META[item.category]?.color || '#526077',
      }));
  }, [expenses, totalSpent]);

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
          title: 'Top category',
          badge: topCat ? `${topCat.percentage.toFixed(0)}%` : '—',
          text: topCat
            ? `${topCat.category} leads at ${formatCurrency(topCat.amount, currency)} across ${
                topCat.count
              } receipt${topCat.count > 1 ? 's' : ''}.`
            : 'No category data yet.',
        },
        {
          title: 'Weekend pace',
          badge: `${weekendMultiplier.toFixed(1)}×`,
          text:
            weekendMultiplier >= 1.15
              ? `Weekend daily spend (${formatCurrency(
                  avgWeekendDay,
                  currency
                )}) is ${weekendMultiplier.toFixed(1)}× higher than weekdays.`
              : `Weekday spend (${formatCurrency(avgWeekdayDay, currency)}/day) is steady vs. weekends.`,
        },
        {
          title: 'Average receipt',
          badge: `${expenses.length} entries`,
          text: `Average spend is ${formatCurrency(avgTx, currency)} with ${expenses.reduce(
            (sum, t) => sum + (t.lineItems?.length || 0),
            0
          )} itemized items tracked.`,
        },
        {
          title: 'Savings rate',
          badge: totalIncome > 0 ? `${savingsRate.toFixed(0)}%` : 'Add income',
          text:
            totalIncome > 0
              ? `Saved ${formatCurrency(netSavings, currency)} of your ${formatCurrency(
                  totalIncome,
                  currency
                )} income in this period.`
              : `Add monthly income to track your savings rate automatically.`,
        },
      ],
    };
  }, [expenses, categoryBreakdown, totalSpent, totalIncome, netSavings, savingsRate, currency]);

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
      <div className="rounded-3xl bg-[#F4F6F9] p-12 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-white border border-[#E2E8F0] text-[#0B1221] flex items-center justify-center mx-auto">
          <BarChart3 className="w-6 h-6" strokeWidth={1.7} />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-display font-bold text-[#0B1221]">
            No analytics data yet
          </h3>
          <p className="text-sm text-[#526077] max-w-sm mx-auto">
            Add your first expense or load demo data to view spending breakdowns, savings rate, and trends.
          </p>
        </div>
        <button
          type="button"
          onClick={onLoadDemoData}
          className="px-5 py-2.5 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-sm transition cursor-pointer"
        >
          Load demo data
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-28">
      {/* Page Header & Period Selector */}
      <section className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl sm:text-4xl font-display font-extrabold text-[#0B1221]">
              Analytics
            </h1>
            <p className="text-sm text-[#526077] tabular-nums">
              Spent <strong className="text-[#0B1221]">{formatCurrency(totalSpent, currency)}</strong>
              {totalIncome > 0 && (
                <>
                  {' '}
                  · Income <strong className="text-[#0D9488]">{formatCurrency(totalIncome, currency)}</strong>
                </>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'this_month', label: 'This month' },
                { id: 'last_month', label: 'Last month' },
                { id: 'last_3_months', label: '3 months' },
                { id: 'all_time', label: 'All time' },
                { id: 'custom_month', label: 'Custom' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPeriod(tab.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ${
                  period === tab.id
                    ? 'bg-[#0B1221] text-white'
                    : 'bg-[#EBF0F5] text-[#526077] hover:text-[#0B1221]'
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
                className="px-3 py-1.5 rounded-full bg-[#F4F6F9] text-xs font-semibold text-[#0B1221]"
              />
            )}
          </div>
        </div>
      </section>

      {/* Savings & Monthly Cashflow Section */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 space-y-5">
          {/* Savings Card */}
          <div className="bg-[#F4F6F9] rounded-3xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-[#0B1221] text-base">
                Savings
              </h2>
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-white text-[#0B1221] tabular-nums">
                {totalIncome > 0 ? `${savingsRate.toFixed(1)}% rate` : 'No income yet'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-[#526077]">Period net saved</div>
                <div
                  className={`text-2xl font-display font-bold tabular-nums mt-1 ${
                    netSavings >= 0 ? 'text-[#0D9488]' : 'text-[#BE123C]'
                  }`}
                >
                  {netSavings >= 0 ? '+' : ''}
                  {formatCurrency(netSavings, currency)}
                </div>
              </div>
              <div>
                <div className="text-xs text-[#526077]">This month</div>
                <div
                  className={`text-2xl font-display font-bold tabular-nums mt-1 ${
                    currentMonthMetrics.saved >= 0 ? 'text-[#0B1221]' : 'text-[#BE123C]'
                  }`}
                >
                  {formatCurrency(currentMonthMetrics.saved, currency)}
                </div>
              </div>
            </div>

            {/* Monthly Savings Goal Bar */}
            <div className="pt-2 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-[#526077]">Monthly goal</span>
                <span className="font-semibold tabular-nums text-[#0B1221]">
                  {formatCurrency(Math.max(0, currentMonthMetrics.saved), currency)} /{' '}
                  {formatCurrency(monthlySavingsGoal, currency)}
                </span>
              </div>
              <div className="h-2 bg-[#DCE3EC] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#2563EB] transition-all duration-500"
                  style={{ width: `${Math.min(100, currentMonthMetrics.savingsGoalPct)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Monthly Budget Card */}
          <div className="bg-[#F4F6F9] rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-[#0B1221] text-base">
                Monthly budget
              </h2>
              <span className="text-xs font-semibold tabular-nums text-[#526077]">
                {currentMonthMetrics.budgetPct.toFixed(0)}% used
              </span>
            </div>

            <div className="relative h-2 bg-[#DCE3EC] rounded-full overflow-hidden">
              <div
                className="absolute top-0 bottom-0 left-[75%] w-0.5 bg-[#0B1221]/25 z-10"
                title="75% warning"
              />
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  currentMonthMetrics.budgetPct >= 100
                    ? 'bg-[#BE123C]'
                    : currentMonthMetrics.budgetPct >= 75
                    ? 'bg-amber-600'
                    : 'bg-[#2563EB]'
                }`}
                style={{ width: `${Math.min(100, currentMonthMetrics.budgetPct)}%` }}
              />
            </div>

            <div className="text-xs font-medium">
              {currentMonthMetrics.budgetPct >= 100 ? (
                <span className="inline-flex items-center gap-1.5 text-[#BE123C]">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Over budget by {formatCurrency(currentMonthMetrics.spent - monthlyBudget, currency)}
                </span>
              ) : currentMonthMetrics.budgetPct >= 75 ? (
                <span className="inline-flex items-center gap-1.5 text-amber-700">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {formatCurrency(monthlyBudget - currentMonthMetrics.spent, currency)} left before limit
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[#0D9488]">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {formatCurrency(monthlyBudget - currentMonthMetrics.spent, currency)} remaining this month
                </span>
              )}
            </div>

            {budgets.filter((b) => b.category !== 'ALL').length > 0 && (
              <div className="pt-2 grid grid-cols-2 gap-2.5">
                {budgets
                  .filter((b) => b.category !== 'ALL')
                  .map((b) => {
                    const cat = b.category as SpendeeCategory;
                    const spentInCat =
                      categoryBreakdown.find((c) => c.category === cat)?.amount || 0;
                    const pct = b.monthlyLimit > 0 ? (spentInCat / b.monthlyLimit) * 100 : 0;
                    return (
                      <div key={b.id} className="p-3 rounded-2xl bg-white">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-[#0B1221] mb-1.5">
                          <span className="truncate">{cat}</span>
                          <span className="tabular-nums text-[#526077]">{pct.toFixed(0)}%</span>
                        </div>
                        <div className="h-1 bg-[#EBF0F5] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              pct >= 100 ? 'bg-[#BE123C]' : pct >= 75 ? 'bg-amber-600' : 'bg-[#2563EB]'
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

        {/* Monthly Cashflow & Net Savings Chart */}
        <div className="lg:col-span-7 bg-[#F4F6F9] rounded-3xl p-6 flex flex-col justify-between">
          <div className="mb-5">
            <h2 className="font-display font-bold text-[#0B1221] text-base">
              Income, expenses & savings
            </h2>
            <p className="text-xs text-[#526077] mt-0.5">
              Monthly cashflow retention overview
            </p>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={monthlySavingsSeries}
                margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#526077' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#526077' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value) => formatCurrency(Number(value), currency)} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="income" name="Income" fill="#0D9488" radius={[6, 6, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#94A3B8" radius={[6, 6, 0, 0]} />
                <Bar dataKey="savings" name="Net savings" fill="#2563EB" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Plain-English Insights & AI Coach */}
      <section className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-xl font-display font-bold text-[#0B1221]">
            Insights
          </h2>

          <button
            type="button"
            disabled={loadingCoach}
            onClick={handleRunAICoach}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs transition cursor-pointer self-start sm:self-auto"
          >
            {loadingCoach ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>
              {loadingCoach
                ? 'Analyzing...'
                : coachAdvice
                ? 'Refresh AI coach'
                : 'Ask AI financial coach'}
            </span>
          </button>
        </div>

        {smartInsights && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {smartInsights.cards.map((card, i) => (
              <div
                key={i}
                className="p-5 rounded-3xl bg-[#F4F6F9] flex flex-col justify-between gap-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[#526077]">
                    {card.title}
                  </span>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-white text-[#2563EB] tabular-nums">
                    {card.badge}
                  </span>
                </div>
                <p className="text-xs text-[#0B1221] leading-relaxed">{card.text}</p>
              </div>
            ))}
          </div>
        )}

        {coachAdvice && (
          <div className="rounded-3xl bg-[#0B1221] text-white p-6 sm:p-7 space-y-5">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-[#60A5FA] uppercase tracking-wider">
                {coachAdvice.source === 'openrouter'
                  ? 'OpenRouter Financial Coach'
                  : coachAdvice.source === 'groq'
                  ? 'Groq Financial Coach'
                  : coachAdvice.source === 'gemini'
                  ? 'Gemini Financial Coach'
                  : 'Manni Smart Coach'}
              </span>
              <h3 className="text-base sm:text-lg font-display font-bold text-white">
                {coachAdvice.headline}
              </h3>
            </div>

            <ul className="space-y-1.5 text-xs sm:text-sm text-white/80">
              {coachAdvice.habitBreakdown.map((bullet, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-[#60A5FA]">·</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
              {coachAdvice.savingTips.map((tip, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-white/8 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium text-white/60">
                      Step {idx + 1}
                    </span>
                    <span className="text-[11px] font-bold text-[#60A5FA] tabular-nums">
                      ~{tip.estimatedMonthlySavings}
                    </span>
                  </div>
                  <div className="font-semibold text-sm text-white">{tip.title}</div>
                  <p className="text-xs text-white/75 leading-relaxed">{tip.action}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Categories & Spending Trend */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Donut & Category List */}
        <div className="lg:col-span-5 bg-[#F4F6F9] rounded-3xl p-6 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-display font-bold text-[#0B1221] text-base">
              By category
            </h2>
            <span className="text-xs text-[#526077]">{categoryBreakdown.length} active</span>
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
                  innerRadius={60}
                  outerRadius={88}
                  paddingAngle={2}
                >
                  {categoryBreakdown.map((entry) => (
                    <Cell key={entry.category} fill={entry.color} stroke="#F4F6F9" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(Number(value), currency)} />
              </PieChart>
            </ResponsiveContainer>

            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[11px] font-medium text-[#526077]">Total</span>
              <span className="text-base font-display font-bold tabular-nums text-[#0B1221]">
                {formatCurrency(totalSpent, currency)}
              </span>
            </div>
          </div>

          <div className="mt-3 space-y-1 max-h-56 overflow-y-auto pr-1">
            {categoryBreakdown.map((item) => (
              <div
                key={item.category}
                className="flex items-center justify-between text-xs py-2 px-2.5 rounded-xl hover:bg-white/70 transition"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="font-semibold text-[#0B1221] truncate">{item.category}</span>
                  <span className="text-[#7C8BA1]">({item.count})</span>
                </div>
                <div className="flex items-center gap-3 shrink-0 tabular-nums">
                  <span className="text-[#526077]">{item.percentage.toFixed(0)}%</span>
                  <span className="font-bold text-[#0B1221] w-20 text-right">
                    {formatCurrency(item.amount, currency)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Trend & Top Merchants */}
        <div className="lg:col-span-7 bg-[#F4F6F9] rounded-3xl p-6 flex flex-col justify-between gap-6">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-bold text-[#0B1221] text-base">
                Daily spending
              </h2>

              <div className="inline-flex rounded-full bg-white p-1 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setTrendChartType('area')}
                  className={`px-3 py-1 rounded-full transition cursor-pointer ${
                    trendChartType === 'area'
                      ? 'bg-[#0B1221] text-white'
                      : 'text-[#526077]'
                  }`}
                >
                  Area
                </button>
                <button
                  type="button"
                  onClick={() => setTrendChartType('bar')}
                  className={`px-3 py-1 rounded-full transition cursor-pointer ${
                    trendChartType === 'bar'
                      ? 'bg-[#0B1221] text-white'
                      : 'text-[#526077]'
                  }`}
                >
                  Bars
                </button>
              </div>
            </div>

            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                {trendChartType === 'area' ? (
                  <AreaChart data={trendData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <defs>
                      <linearGradient id="manniSpendGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563EB" stopOpacity={0.24} />
                        <stop offset="95%" stopColor="#2563EB" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#526077' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#526077' }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(val) => [formatCurrency(Number(val), currency), 'Spent']} />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      stroke="#2563EB"
                      strokeWidth={2.2}
                      fillOpacity={1}
                      fill="url(#manniSpendGrad)"
                    />
                  </AreaChart>
                ) : (
                  <BarChart data={trendData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#526077' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#526077' }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(val) => [formatCurrency(Number(val), currency), 'Spent']} />
                    <Bar dataKey="amount" fill="#2563EB" radius={[6, 6, 0, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Merchants */}
          <div className="pt-5 border-t border-[#E2E8F0] space-y-3.5">
            <h3 className="font-display font-bold text-[#0B1221] text-sm">
              Top merchants
            </h3>

            <div className="space-y-3">
              {topMerchants.map((m) => (
                <div key={m.merchant} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5 font-semibold text-[#0B1221]">
                      <span className="w-7 h-7 rounded-full bg-white text-[#0B1221] flex items-center justify-center">
                        <CategoryIcon category={m.category} className="w-3.5 h-3.5" />
                      </span>
                      <span>{m.merchant}</span>
                      <span className="text-[#7C8BA1] font-normal">{m.count}×</span>
                    </div>
                    <div className="font-bold tabular-nums text-[#0B1221]">
                      {formatCurrency(m.amount, currency)}
                    </div>
                  </div>
                  <div className="h-1.5 bg-[#DCE3EC] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#2563EB]"
                      style={{ width: `${Math.min(100, m.percentage)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
