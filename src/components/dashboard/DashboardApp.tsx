import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import type { ExpenseDataset, MonthlySummary, Transaction } from "@/data/types";
import { formatCurrency, formatCurrencyPrecise, formatDateLabel, formatPercent } from "@/lib/format";
import { buildInsightReport } from "@/lib/learning-engine";
import {
  buildRollingNet,
  calculateExpenseVolatility,
  getLargestTransactions,
  getRecentTransactions
} from "@/lib/insights";
import { DashboardProvider, useDashboard } from "@/state/dashboard-context";

import { FilterBar } from "./FilterBar";
import { InsightCard } from "./InsightCard";
import { MetricCard } from "./MetricCard";
import { Panel } from "./Panel";
import { TransactionTable } from "./TransactionTable";

type DashboardPage = "overview" | "cashflow" | "categories" | "transactions" | "recurring" | "insights";

const pageMeta: Record<DashboardPage, { label: string; eyebrow: string; title: string; description: string }> = {
  overview: {
    label: "Overview",
    eyebrow: "Personal finance dashboard",
    title: "See the shape of your money at a glance",
    description:
      "Track spending, income, category concentration, and the transactions that are quietly defining your monthly habits."
  },
  cashflow: {
    label: "Cashflow",
    eyebrow: "Monthly rhythm",
    title: "Understand the months that build or drain momentum",
    description:
      "Follow income, expenses, net swings, and rolling trends so the calmer months and the chaotic ones become obvious."
  },
  categories: {
    label: "Categories",
    eyebrow: "Where money goes",
    title: "Spot the categories shaping your lifestyle",
    description:
      "Compare total spend, share of wallet, monthly arcs, and unusual spikes across the categories that actually matter."
  },
  transactions: {
    label: "Transactions",
    eyebrow: "Ground truth",
    title: "Drill into the individual entries behind the charts",
    description:
      "Search, sort, and inspect the raw transactions so every chart is traceable back to real purchases and income events."
  },
  recurring: {
    label: "Recurring",
    eyebrow: "Repeat patterns",
    title: "Find subscriptions and routines that keep coming back",
    description:
      "Surface repeating charges, estimate monthly recurring spend, and check which recurring patterns feel healthy versus neglected."
  },
  insights: {
    label: "Insights",
    eyebrow: "Learnings and optimization",
    title: "Turn the analytics into clear money decisions",
    description:
      "Read the patterns behind your spending, understand what is driving the month, and surface the few changes that would matter most."
  }
};

const navItems: { page: DashboardPage; href: string; label: string }[] = [
  { page: "overview", href: "/", label: "Overview" },
  { page: "cashflow", href: "/cashflow", label: "Cashflow" },
  { page: "categories", href: "/categories", label: "Categories" },
  { page: "insights", href: "/insights", label: "Insights" },
  { page: "transactions", href: "/transactions", label: "Transactions" },
  { page: "recurring", href: "/recurring", label: "Recurring" }
];

function withBase(pathname: string) {
  const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

  if (!base) {
    return pathname;
  }

  return pathname === "/" ? `${base}/` : `${base}${pathname}`;
}

const chartColors = ["#1b4332", "#2d6a4f", "#40916c", "#52b788", "#74c69d", "#95d5b2", "#e76f51"];
const tooltipStyle = {
  borderRadius: "18px",
  borderColor: "rgba(8, 28, 21, 0.08)",
  boxShadow: "0 16px 40px rgba(8, 28, 21, 0.12)"
};

function buildCategoryTrendData(
  transactions: Transaction[],
  monthKeys: string[],
  categories: string[]
) {
  return monthKeys.map((monthKey) => {
    const row: Record<string, string | number> = {
      monthKey,
      monthLabel: formatMonth(monthKey)
    };

    for (const category of categories) {
      row[category] = transactions
        .filter(
          (transaction) =>
            transaction.type === "Expense" &&
            transaction.category === category &&
            transaction.monthKey === monthKey
        )
        .reduce((sum, transaction) => sum + transaction.amount, 0);
    }

    return row;
  });
}

function buildYearComparison(monthly: MonthlySummary[], metric: "expense" | "net") {
  const years = Array.from(new Set(monthly.map((item) => item.monthKey.slice(0, 4)))).sort();
  return {
    years,
    rows: Array.from({ length: 12 }, (_, index) => {
      const month = index + 1;
      const monthLabel = new Date(Date.UTC(2025, index, 1)).toLocaleString("en-US", {
        month: "short",
        timeZone: "UTC"
      });
      const row: Record<string, string | number> = {
        monthLabel
      };
      for (const year of years) {
        const summary = monthly.find(
          (item) => item.monthKey === `${year}-${String(month).padStart(2, "0")}`
        );
        row[year] = summary ? summary[metric] : 0;
      }
      return row;
    })
  };
}

function buildRecurringMonthlySeries(
  transactions: Transaction[],
  recurringIds: string[],
  monthKeys: string[]
) {
  const recurringSet = new Set(recurringIds);

  return monthKeys.map((monthKey) => ({
    monthKey,
    monthLabel: formatMonth(monthKey),
    recurringExpense: transactions
      .filter((transaction) => {
        const key = `${transaction.note.toLowerCase()}::${transaction.category.toLowerCase()}`;
        return (
          transaction.type === "Expense" &&
          transaction.monthKey === monthKey &&
          recurringSet.has(key)
        );
      })
      .reduce((sum, transaction) => sum + transaction.amount, 0)
  }));
}

function formatMonth(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  });
}

function Toggle({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-sm transition ${
        active ? "bg-pine text-white" : "border border-ink/10 bg-white text-ink/60 hover:border-moss"
      }`}
    >
      {children}
    </button>
  );
}

function DashboardShell({ page }: { page: DashboardPage }) {
  const { dataset, filteredTransactions } = useDashboard();
  const meta = pageMeta[page];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(149,213,178,0.35),_transparent_36%),linear-gradient(135deg,_#f7f3e9,_#eef7f0_60%,_#e8f5ef)] px-4 py-6 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 rounded-[36px] border border-white/40 bg-gradient-to-br from-ink via-pine to-moss px-6 py-8 text-white shadow-panel">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-3xl">
              <p className="text-xs uppercase tracking-[0.38em] text-white/55">{meta.eyebrow}</p>
              <h1 className="mt-4 font-display text-4xl sm:text-5xl">{meta.title}</h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-white/75">{meta.description}</p>
            </div>
            <div className="grid gap-3 rounded-[28px] bg-white/10 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.28em] text-white/55">Dataset</p>
              <p className="font-display text-3xl">{dataset.transactions.length}</p>
              <p className="text-sm text-white/70">
                rows across {dataset.availableMonths.length} months and {dataset.availableCategories.length} categories
              </p>
              <p className="text-sm text-white/60">
                {formatDateLabel(dataset.meta.firstDate)} to {formatDateLabel(dataset.meta.lastDate)}
              </p>
            </div>
          </div>

          <nav className="mt-8 flex flex-wrap gap-3">
            {navItems.map((item) => (
              <a
                key={item.page}
                href={withBase(item.href)}
                className={`rounded-full px-4 py-2 text-sm transition ${
                  item.page === page
                    ? "bg-white text-pine"
                    : "bg-white/10 text-white/75 hover:bg-white/20 hover:text-white"
                }`}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </header>

        <div className="space-y-6">
          <FilterBar />
          <PageRouter page={page} />
          <footer className="rounded-[28px] border border-white/40 bg-white/75 px-5 py-4 text-sm text-ink/55 shadow-soft">
            {filteredTransactions.length} rows currently drive the visible dashboards. Every chart and table on this page is synced to the global filters above.
          </footer>
        </div>
      </div>
    </div>
  );
}

function OverviewPage() {
  const { filteredCategories, filteredMonthly, filteredNotes, filteredTransactions } = useDashboard();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showNet, setShowNet] = useState(true);

  const totals = useMemo(() => {
    const income = filteredMonthly.reduce((sum, month) => sum + month.income, 0);
    const expense = filteredMonthly.reduce((sum, month) => sum + month.expense, 0);
    const net = income - expense;
    return {
      income,
      expense,
      net,
      averageExpense: filteredMonthly.length > 0 ? expense / filteredMonthly.length : 0
    };
  }, [filteredMonthly]);

  const pieData = filteredCategories.slice(0, 6).map((category) => ({
    name: category.category,
    value: category.totalExpense
  }));
  const focusedTransactions =
    selectedCategory === null
      ? getLargestTransactions(filteredTransactions, 8)
      : filteredTransactions.filter((item) => item.category === selectedCategory);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total spent" value={formatCurrency(totals.expense)} hint="Expense transactions in the current view" />
        <MetricCard label="Income" value={formatCurrency(totals.income)} hint="Incoming cash across the active period" />
        <MetricCard label="Net" value={formatCurrency(totals.net)} hint="Income minus expenses" />
        <MetricCard
          label="Avg monthly spend"
          value={formatCurrency(totals.averageExpense)}
          hint={`${filteredCategories.length} categories active`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Panel
          title="Income vs expense by month"
          description="A fast read on when spending outran income and when the trend snapped back."
          actions={
            <div className="flex gap-2">
              <Toggle active={showNet} onClick={() => setShowNet(true)}>
                Show net
              </Toggle>
              <Toggle active={!showNet} onClick={() => setShowNet(false)}>
                Hide net
              </Toggle>
            </div>
          }
        >
          <div className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={filteredMonthly}>
                <CartesianGrid stroke="rgba(8, 28, 21, 0.08)" vertical={false} />
                <XAxis dataKey="monthLabel" tick={{ fill: "#3b4d47", fontSize: 12 }} />
                <YAxis tickFormatter={(value) => formatCurrency(Number(value))} tick={{ fill: "#3b4d47", fontSize: 12 }} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number) => formatCurrencyPrecise(value)}
                />
                <Legend />
                <Bar dataKey="income" fill="#74c69d" radius={[8, 8, 0, 0]} />
                <Bar dataKey="expense" fill="#e76f51" radius={[8, 8, 0, 0]} />
                {showNet ? <Line type="monotone" dataKey="net" stroke="#1b4332" strokeWidth={3} dot={false} /> : null}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Top spending categories" description="Click a slice to focus the transaction table below.">
          <div className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={70}
                  outerRadius={115}
                  paddingAngle={3}
                  onClick={(slice) => setSelectedCategory(slice.name)}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => formatCurrencyPrecise(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedCategory(null)}
              className={`rounded-full px-3 py-1.5 text-sm ${selectedCategory === null ? "bg-pine text-white" : "bg-mist text-ink/70"}`}
            >
              Top expenses
            </button>
            {pieData.map((entry) => (
              <button
                key={entry.name}
                type="button"
                onClick={() => setSelectedCategory(entry.name)}
                className={`rounded-full px-3 py-1.5 text-sm ${
                  selectedCategory === entry.name ? "bg-pine text-white" : "bg-mist text-ink/70"
                }`}
              >
                {entry.name}
              </button>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.15fr]">
        <Panel title="Merchants and notes driving spend" description="Sorted by total expense within the current filter window.">
          <div className="space-y-3">
            {filteredNotes.slice(0, 8).map((note, index) => (
              <div key={note.note} className="flex items-center justify-between rounded-[20px] bg-cream/80 px-4 py-3">
                <div>
                  <p className="font-medium text-ink">{index + 1}. {note.note}</p>
                  <p className="text-sm text-ink/55">{note.transactionCount} expense transactions</p>
                </div>
                <p className="font-display text-xl text-ink">{formatCurrency(note.totalExpense)}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title={selectedCategory ? `${selectedCategory} drill-down` : "Largest expense transactions"}
          description={
            selectedCategory
              ? "Focused by the category selection above. Clear it to go back to the biggest expenses overall."
              : "A quick way to validate which purchases dominate the visible period."
          }
        >
          <TransactionTable
            title="Transaction detail"
            transactions={focusedTransactions}
            defaultSort={selectedCategory ? "latest" : "largest"}
            limit={8}
          />
        </Panel>
      </div>

      <Panel title="Recent activity" description="The most recent entries in the filtered dataset.">
        <TransactionTable title="Recent transactions" transactions={getRecentTransactions(filteredTransactions, 10)} limit={10} />
      </Panel>
    </div>
  );
}

function CashflowPage() {
  const { filteredMonthly, filteredTransactions } = useDashboard();
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [showNet, setShowNet] = useState(true);
  const rolling = useMemo(() => buildRollingNet(filteredMonthly), [filteredMonthly]);
  const expenseVolatility = useMemo(() => calculateExpenseVolatility(filteredMonthly), [filteredMonthly]);
  const comparison = useMemo(() => buildYearComparison(filteredMonthly, "expense"), [filteredMonthly]);
  const bestMonth = useMemo(() => [...filteredMonthly].sort((a, b) => b.net - a.net)[0], [filteredMonthly]);
  const worstMonth = useMemo(() => [...filteredMonthly].sort((a, b) => a.net - b.net)[0], [filteredMonthly]);

  const scopedTransactions =
    selectedMonth === null
      ? getLargestTransactions(filteredTransactions, 10)
      : filteredTransactions.filter((transaction) => transaction.monthKey === selectedMonth);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Best month" value={bestMonth ? formatCurrency(bestMonth.net) : "n/a"} hint={bestMonth?.monthLabel ?? "No data"} />
        <MetricCard label="Worst month" value={worstMonth ? formatCurrency(worstMonth.net) : "n/a"} hint={worstMonth?.monthLabel ?? "No data"} />
        <MetricCard
          label="Avg monthly net"
          value={formatCurrency(filteredMonthly.reduce((sum, month) => sum + month.net, 0) / Math.max(filteredMonthly.length, 1))}
          hint="Smoothed across the active date range"
        />
        <MetricCard label="Spend volatility" value={formatPercent(expenseVolatility)} hint="Coefficient of variation on monthly spend" />
      </div>

      <Panel
        title="Monthly cashflow"
        description="Click a month to drill into the transactions that shaped it."
        actions={
          <div className="flex gap-2">
            <Toggle active={showNet} onClick={() => setShowNet(true)}>
              Show net
            </Toggle>
            <Toggle active={!showNet} onClick={() => setShowNet(false)}>
              Expenses + income
            </Toggle>
          </div>
        }
      >
        <div className="h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={filteredMonthly} onClick={(state) => setSelectedMonth(state?.activeLabel ? filteredMonthly.find((item) => item.monthLabel === state.activeLabel)?.monthKey ?? null : null)}>
              <CartesianGrid stroke="rgba(8, 28, 21, 0.08)" vertical={false} />
              <XAxis dataKey="monthLabel" tick={{ fill: "#3b4d47", fontSize: 12 }} />
              <YAxis tickFormatter={(value) => formatCurrency(Number(value))} tick={{ fill: "#3b4d47", fontSize: 12 }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => formatCurrencyPrecise(value)} />
              <Legend />
              <Bar dataKey="income" fill="#74c69d" radius={[8, 8, 0, 0]} />
              <Bar dataKey="expense" fill="#e76f51" radius={[8, 8, 0, 0]} />
              {showNet ? <Line dataKey="net" stroke="#081c15" strokeWidth={3} dot={false} /> : null}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Panel title="Rolling trend" description="Three-month rolling averages help the trend read cleaner than raw month-to-month noise.">
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rolling}>
                <CartesianGrid stroke="rgba(8, 28, 21, 0.08)" vertical={false} />
                <XAxis dataKey="monthLabel" tick={{ fill: "#3b4d47", fontSize: 12 }} />
                <YAxis tickFormatter={(value) => formatCurrency(Number(value))} tick={{ fill: "#3b4d47", fontSize: 12 }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => formatCurrencyPrecise(value)} />
                <Legend />
                <Line dataKey="rollingNet" stroke="#1b4332" strokeWidth={3} dot={false} name="Rolling net" />
                <Line dataKey="rollingExpense" stroke="#e76f51" strokeWidth={2} dot={false} name="Rolling expense" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Savings rate by month" description="How much income remained after expenses in each visible month.">
          <div className="space-y-3">
            {filteredMonthly
              .filter((month) => month.income > 0 || month.expense > 0)
              .slice()
              .reverse()
              .slice(0, 8)
              .map((month) => (
                <div key={month.monthKey} className="rounded-[20px] bg-cream/80 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-ink">{month.monthLabel}</p>
                    <p className="text-sm text-ink/55">{formatPercent(month.savingsRate)}</p>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                    <div
                      className={`h-full rounded-full ${month.net >= 0 ? "bg-sage" : "bg-ember"}`}
                      style={{ width: `${Math.min(Math.abs((month.savingsRate ?? 0) * 100), 100)}%` }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </Panel>
      </div>

      <Panel title="Year-over-year expense comparison" description="Each line compares the same calendar month across years in the current filtered period.">
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={comparison.rows}>
              <CartesianGrid stroke="rgba(8, 28, 21, 0.08)" vertical={false} />
              <XAxis dataKey="monthLabel" tick={{ fill: "#3b4d47", fontSize: 12 }} />
              <YAxis tickFormatter={(value) => formatCurrency(Number(value))} tick={{ fill: "#3b4d47", fontSize: 12 }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => formatCurrencyPrecise(value)} />
              <Legend />
              {comparison.years.map((year, index) => (
                <Line
                  key={year}
                  dataKey={year}
                  stroke={chartColors[index % chartColors.length]}
                  strokeWidth={2.5}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel
        title={selectedMonth ? `${formatMonth(selectedMonth)} drill-down` : "Largest visible transactions"}
        description={selectedMonth ? "Click elsewhere on the chart to pick a different month." : "Select a month in the chart above to inspect it in detail."}
      >
        <TransactionTable title="Cashflow drill-down" transactions={scopedTransactions} defaultSort={selectedMonth ? "latest" : "largest"} limit={10} />
      </Panel>
    </div>
  );
}

function CategoriesPage() {
  const { filteredCategories, filteredMonthly, filteredSpikes, filteredTransactions } = useDashboard();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(filteredCategories[0]?.category ?? null);

  const topCategories = filteredCategories.slice(0, 8);
  const trendCategories = filteredCategories.slice(0, 5).map((item) => item.category);
  const trendData = useMemo(
    () => buildCategoryTrendData(filteredTransactions, filteredMonthly.map((item) => item.monthKey), trendCategories),
    [filteredMonthly, filteredTransactions, trendCategories]
  );

  const focusedTransactions =
    selectedCategory === null
      ? getLargestTransactions(filteredTransactions, 12)
      : filteredTransactions.filter((item) => item.category === selectedCategory);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Top category" value={topCategories[0]?.category ?? "n/a"} hint={topCategories[0] ? formatCurrency(topCategories[0].totalExpense) : "No expenses"} />
        <MetricCard label="Category count" value={String(filteredCategories.length)} hint="Expense categories in the current window" />
        <MetricCard
          label="Largest share"
          value={topCategories[0] ? formatPercent(topCategories[0].shareOfExpense) : "n/a"}
          hint={topCategories[0]?.category ?? "No category selected"}
        />
        <MetricCard
          label="Average expense ticket"
          value={formatCurrency(
            filteredCategories.reduce((sum, category) => sum + category.averageExpense, 0) /
              Math.max(filteredCategories.length, 1)
          )}
          hint="Average transaction size across visible categories"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
        <Panel title="Category totals" description="Click a bar to focus the transaction table.">
          <div className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topCategories}
                layout="vertical"
                margin={{ left: 24 }}
                onClick={(state) => setSelectedCategory(state?.activePayload?.[0]?.payload?.category ?? null)}
              >
                <CartesianGrid stroke="rgba(8, 28, 21, 0.08)" horizontal={false} />
                <XAxis type="number" tickFormatter={(value) => formatCurrency(Number(value))} tick={{ fill: "#3b4d47", fontSize: 12 }} />
                <YAxis type="category" dataKey="category" width={100} tick={{ fill: "#3b4d47", fontSize: 12 }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => formatCurrencyPrecise(value)} />
                <Bar dataKey="totalExpense" radius={[0, 10, 10, 0]}>
                  {topCategories.map((entry, index) => (
                    <Cell key={entry.category} fill={chartColors[index % chartColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Share of wallet" description="Top categories as a proportion of total visible expenses.">
          <div className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={topCategories.map((item) => ({ name: item.category, value: item.totalExpense }))}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={70}
                  outerRadius={115}
                  onClick={(slice) => setSelectedCategory(slice.name)}
                >
                  {topCategories.map((entry, index) => (
                    <Cell key={entry.category} fill={chartColors[index % chartColors.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => formatCurrencyPrecise(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <Panel title="Monthly category trends" description="The five largest categories in the current view, tracked month by month.">
        <div className="h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData}>
              <CartesianGrid stroke="rgba(8, 28, 21, 0.08)" vertical={false} />
              <XAxis dataKey="monthLabel" tick={{ fill: "#3b4d47", fontSize: 12 }} />
              <YAxis tickFormatter={(value) => formatCurrency(Number(value))} tick={{ fill: "#3b4d47", fontSize: 12 }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => formatCurrencyPrecise(value)} />
              <Legend />
              {trendCategories.map((category, index) => (
                <Area
                  key={category}
                  type="monotone"
                  dataKey={category}
                  stackId="categories"
                  stroke={chartColors[index % chartColors.length]}
                  fill={chartColors[index % chartColors.length]}
                  fillOpacity={0.22}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.15fr]">
        <Panel title="Unexpected spikes" description="Months where category spend materially exceeded that category's own baseline.">
          <div className="space-y-3">
            {filteredSpikes.slice(0, 8).map((spike) => (
              <button
                key={`${spike.category}-${spike.monthKey}`}
                type="button"
                onClick={() => setSelectedCategory(spike.category)}
                className="flex w-full items-center justify-between rounded-[20px] bg-cream/80 px-4 py-3 text-left transition hover:bg-white"
              >
                <div>
                  <p className="font-medium text-ink">{spike.category}</p>
                  <p className="text-sm text-ink/55">
                    {spike.monthLabel} vs baseline {formatCurrency(spike.baseline)}
                  </p>
                </div>
                <p className="font-display text-xl text-ink">{formatPercent(spike.increaseRatio - 1)}</p>
              </button>
            ))}
          </div>
        </Panel>

        <Panel
          title={selectedCategory ? `${selectedCategory} transactions` : "Category drill-down"}
          description="Driven by bar, pie, and spike interactions above."
        >
          <TransactionTable title="Category transactions" transactions={focusedTransactions} defaultSort="largest" limit={12} />
        </Panel>
      </div>
    </div>
  );
}

function TransactionsPage() {
  const { filteredNotes, filteredTransactions } = useDashboard();
  const incomeCount = filteredTransactions.filter((item) => item.type === "Income").length;
  const expenseCount = filteredTransactions.filter((item) => item.type === "Expense").length;
  const net = filteredTransactions.reduce((sum, item) => sum + item.signedAmount, 0);
  const recent = getRecentTransactions(filteredTransactions, 12);
  const topNotes = filteredNotes.slice(0, 10).map((item) => ({
    note: item.note,
    totalExpense: item.totalExpense
  }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Transactions" value={String(filteredTransactions.length)} hint="Rows after global filters" />
        <MetricCard label="Expenses" value={String(expenseCount)} hint="Expense rows in view" />
        <MetricCard label="Income" value={String(incomeCount)} hint="Income rows in view" />
        <MetricCard label="Net movement" value={formatCurrency(net)} hint="Signed sum of the filtered transactions" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <Panel title="Recent transaction flow" description="Recent records are helpful for validating whether the latest export looks healthy.">
          <TransactionTable title="Most recent entries" transactions={recent} limit={12} />
        </Panel>

        <Panel title="Top notes by expense" description="These notes and merchants are absorbing the most money in the current view.">
          <div className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topNotes} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid stroke="rgba(8, 28, 21, 0.08)" horizontal={false} />
                <XAxis type="number" tickFormatter={(value) => formatCurrency(Number(value))} tick={{ fill: "#3b4d47", fontSize: 12 }} />
                <YAxis type="category" dataKey="note" width={140} tick={{ fill: "#3b4d47", fontSize: 12 }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => formatCurrencyPrecise(value)} />
                <Bar dataKey="totalExpense" fill="#2d6a4f" radius={[0, 10, 10, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <Panel title="Full transaction explorer" description="This is the raw ledger behind every other page. Sort it to audit trends or find outliers.">
        <TransactionTable title="All filtered transactions" transactions={filteredTransactions} />
      </Panel>
    </div>
  );
}

function InsightsPage() {
  const { filteredCategories, filteredMonthly, filteredRecurring, filteredSpikes, filteredTransactions } =
    useDashboard();
  const report = useMemo(
    () =>
      buildInsightReport({
        monthly: filteredMonthly,
        categories: filteredCategories,
        recurring: filteredRecurring,
        spikes: filteredSpikes,
        transactions: filteredTransactions
      }),
    [filteredCategories, filteredMonthly, filteredRecurring, filteredSpikes, filteredTransactions]
  );
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    report.priorityCategories[0]?.category ?? null
  );

  useEffect(() => {
    if (!selectedCategory || report.priorityCategories.some((item) => item.category === selectedCategory)) {
      return;
    }

    setSelectedCategory(report.priorityCategories[0]?.category ?? null);
  }, [report.priorityCategories, selectedCategory]);

  const focusedTransactions =
    selectedCategory === null
      ? getLargestTransactions(filteredTransactions, 12)
      : filteredTransactions.filter((transaction) => transaction.category === selectedCategory);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Positive months"
          value={`${report.snapshot.positiveMonths}/${report.snapshot.trackedMonths || 0}`}
          hint={`${report.snapshot.negativeMonths} negative months in current view`}
        />
        <MetricCard
          label="Recurring drag"
          value={formatPercent(report.snapshot.recurringShare)}
          hint={`${formatCurrency(report.snapshot.recurringMonthlySpend)} per month in likely recurring spend`}
        />
        <MetricCard
          label="Flexible spend share"
          value={formatPercent(report.snapshot.flexibleShare)}
          hint={`${formatPercent(report.snapshot.essentialShare)} currently sits in essential categories`}
        />
        <MetricCard
          label="Potential savings"
          value={formatCurrency(report.snapshot.optimizationPotentialMonthly)}
          hint="Combined monthly potential across the top opportunities below"
        />
      </div>

      <Panel
        title="What your data suggests"
        description="These are the main behavioral patterns emerging from the current filtered view."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          {report.learnings.map((insight) => (
            <InsightCard
              key={insight.id}
              insight={insight}
              onFocusCategory={(category) => setSelectedCategory(category)}
            />
          ))}
        </div>
      </Panel>

      <Panel
        title="Where to optimize first"
        description="Not everything deserves attention. These are the changes most likely to move the needle."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          {report.opportunities.map((insight) => (
            <InsightCard
              key={insight.id}
              insight={insight}
              onFocusCategory={(category) => setSelectedCategory(category)}
            />
          ))}
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Panel
          title="Spending mix by bucket"
          description="A simple read of how much of your money is essential versus more flexible or lifestyle-driven."
        >
          <div className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={report.buckets}>
                <CartesianGrid stroke="rgba(8, 28, 21, 0.08)" vertical={false} />
                <XAxis dataKey="bucket" tick={{ fill: "#3b4d47", fontSize: 12 }} />
                <YAxis
                  tickFormatter={(value) => formatCurrency(Number(value))}
                  tick={{ fill: "#3b4d47", fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number) => formatCurrencyPrecise(value)}
                />
                <Bar dataKey="monthlyAverage" radius={[10, 10, 0, 0]}>
                  {report.buckets.map((bucket, index) => (
                    <Cell key={bucket.bucket} fill={chartColors[index % chartColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel
          title="Recent direction"
          description="The last three active months compared with the earlier baseline in the same filtered window."
        >
          <div className="space-y-4">
            {report.trendComparisons.map((trend) => (
              <div key={trend.label} className="rounded-[20px] bg-cream/80 px-4 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-ink">{trend.label}</p>
                    <p className="mt-1 text-sm text-ink/55">
                      Recent {formatCurrency(trend.recent)} vs baseline {formatCurrency(trend.baseline)}
                    </p>
                  </div>
                  <div
                    className={`rounded-full px-3 py-1.5 text-sm ${
                      trend.change === null
                        ? "bg-mist text-ink/70"
                        : trend.change <= 0
                          ? "bg-sage/35 text-pine"
                          : "bg-gold/25 text-ink"
                    }`}
                  >
                    {trend.change === null ? "Not enough history" : formatPercent(trend.change)}
                  </div>
                </div>
              </div>
            ))}

            <div className="rounded-[20px] border border-dashed border-ink/12 bg-white/70 px-4 py-4 text-sm leading-6 text-ink/66">
              The page is filter-aware, so you can narrow it to a year, category, or type and see the learnings adapt.
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.2fr]">
        <Panel
          title="Priority categories"
          description="These categories have the most weight in the current filtered view. Click one to inspect the raw transactions."
        >
          <div className="space-y-3">
            {report.priorityCategories.map((category) => (
              <button
                key={category.category}
                type="button"
                onClick={() => setSelectedCategory(category.category)}
                className={`flex w-full items-center justify-between rounded-[20px] px-4 py-3 text-left transition ${
                  selectedCategory === category.category
                    ? "bg-pine text-white"
                    : "bg-cream/80 text-ink hover:bg-white"
                }`}
              >
                <div>
                  <p className="font-medium">{category.category}</p>
                  <p
                    className={
                      selectedCategory === category.category ? "text-white/70" : "text-ink/55"
                    }
                  >
                    {category.bucket} · {Math.round(category.shareOfExpense * 100)}% of expenses
                  </p>
                </div>
                <p className="font-display text-2xl">{formatCurrency(category.monthlyAverage)}</p>
              </button>
            ))}
          </div>
        </Panel>

        <Panel
          title={selectedCategory ? `${selectedCategory} transactions` : "Supporting transactions"}
          description="Use this table to validate the insight against the actual rows behind it."
        >
          <TransactionTable
            title="Insight drill-down"
            transactions={focusedTransactions}
            defaultSort={selectedCategory ? "latest" : "largest"}
            limit={12}
          />
        </Panel>
      </div>
    </div>
  );
}

function RecurringPage() {
  const { filteredMonthly, filteredRecurring, filteredTransactions } = useDashboard();
  const likelySubscriptions = filteredRecurring.filter((candidate) => candidate.isLikelySubscription);
  const [selectedRecurring, setSelectedRecurring] = useState<string | null>(likelySubscriptions[0]?.id ?? filteredRecurring[0]?.id ?? null);

  const recurringSeries = useMemo(
    () =>
      buildRecurringMonthlySeries(
        filteredTransactions,
        filteredRecurring.map((candidate) => candidate.id),
        filteredMonthly.map((month) => month.monthKey)
      ),
    [filteredMonthly, filteredRecurring, filteredTransactions]
  );

  const focusedTransactions =
    selectedRecurring === null
      ? filteredTransactions
      : filteredTransactions.filter(
          (transaction) =>
            `${transaction.note.toLowerCase()}::${transaction.category.toLowerCase()}` === selectedRecurring
        );

  const recurringMonthlySpend = filteredRecurring.reduce((sum, item) => sum + item.monthlyAverage, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Recurring candidates" value={String(filteredRecurring.length)} hint="Groups with at least three matching expense rows" />
        <MetricCard label="Likely subscriptions" value={String(likelySubscriptions.length)} hint="Monthly-ish recurring patterns" />
        <MetricCard label="Estimated monthly recurring spend" value={formatCurrency(recurringMonthlySpend)} hint="Sum of candidate monthly averages" />
        <MetricCard label="Top recurring item" value={filteredRecurring[0]?.note ?? "n/a"} hint={filteredRecurring[0] ? formatCurrency(filteredRecurring[0].monthlyAverage) : "No recurring spend"} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
        <Panel title="Recurring spend by month" description="Sum of transactions belonging to recurring candidates.">
          <div className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={recurringSeries}>
                <CartesianGrid stroke="rgba(8, 28, 21, 0.08)" vertical={false} />
                <XAxis dataKey="monthLabel" tick={{ fill: "#3b4d47", fontSize: 12 }} />
                <YAxis tickFormatter={(value) => formatCurrency(Number(value))} tick={{ fill: "#3b4d47", fontSize: 12 }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => formatCurrencyPrecise(value)} />
                <Area type="monotone" dataKey="recurringExpense" stroke="#1b4332" fill="#95d5b2" fillOpacity={0.38} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Cadence vs amount" description="Click a point to inspect that recurring pattern in the table below.">
          <div className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart>
                <CartesianGrid stroke="rgba(8, 28, 21, 0.08)" />
                <XAxis type="number" dataKey="cadenceDays" name="Cadence" unit="d" tick={{ fill: "#3b4d47", fontSize: 12 }} />
                <YAxis type="number" dataKey="averageAmount" name="Average amount" tickFormatter={(value) => formatCurrency(Number(value))} tick={{ fill: "#3b4d47", fontSize: 12 }} />
                <Tooltip
                  cursor={{ strokeDasharray: "4 4" }}
                  contentStyle={tooltipStyle}
                  formatter={(value: number, name: string) =>
                    name === "averageAmount" ? formatCurrencyPrecise(value) : value.toFixed(1)
                  }
                />
                <Scatter
                  data={filteredRecurring}
                  fill="#2d6a4f"
                  onClick={(point) => setSelectedRecurring(point.id)}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <Panel title="Recurring candidates" description="Likely subscriptions float to the top, but you can inspect every repeat pattern.">
        <div className="grid gap-3 lg:grid-cols-2">
          {filteredRecurring.slice(0, 10).map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              onClick={() => setSelectedRecurring(candidate.id)}
              className={`rounded-[22px] border px-4 py-4 text-left transition ${
                selectedRecurring === candidate.id
                  ? "border-pine bg-pine text-white"
                  : "border-white/60 bg-white/80 text-ink hover:border-moss"
              }`}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">{candidate.note}</p>
                  <p className={selectedRecurring === candidate.id ? "text-white/70" : "text-ink/55"}>
                    {candidate.category} · {candidate.count} hits · every {candidate.cadenceDays.toFixed(0)} days
                  </p>
                </div>
                <p className="font-display text-2xl">{formatCurrency(candidate.monthlyAverage)}</p>
              </div>
            </button>
          ))}
        </div>
      </Panel>

      <Panel title="Recurring transaction drill-down" description="The raw rows behind the recurring candidate selection.">
        <TransactionTable title="Recurring transactions" transactions={focusedTransactions} defaultSort="latest" limit={12} />
      </Panel>
    </div>
  );
}

function PageRouter({ page }: { page: DashboardPage }) {
  if (page === "cashflow") {
    return <CashflowPage />;
  }

  if (page === "categories") {
    return <CategoriesPage />;
  }

  if (page === "transactions") {
    return <TransactionsPage />;
  }

  if (page === "insights") {
    return <InsightsPage />;
  }

  if (page === "recurring") {
    return <RecurringPage />;
  }

  return <OverviewPage />;
}

export function DashboardApp({
  page,
  dataset
}: {
  page: DashboardPage;
  dataset: ExpenseDataset;
}) {
  return (
    <DashboardProvider dataset={dataset}>
      <DashboardShell page={page} />
    </DashboardProvider>
  );
}
