import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import { format } from "date-fns";
import { z } from "zod";

import type {
  CategorySummary,
  ExpenseDataset,
  KpiSummary,
  MonthlySummary,
  NoteSummary,
  RecurringCandidate,
  SpikeInsight,
  Transaction,
  TransactionType,
  YearOverYearMonth
} from "@/data/types";

const csvRowSchema = z.object({
  Date: z.string().min(1),
  Note: z.string().min(1),
  Amount: z.coerce.number(),
  Category: z.string().min(1),
  Type: z.enum(["Expense", "Income"])
});

const INPUT_DIR = path.resolve(process.cwd(), "input");
const PRIVATE_EXPORT_PATH = path.join(INPUT_DIR, "export.csv");
const PRIVATE_LOCAL_EXPORT_PATH = path.join(INPUT_DIR, "export.local.csv");
const DEMO_EXPORT_PATH = path.join(INPUT_DIR, "demo-export.csv");

let cachedDataset: ExpenseDataset | null = null;

function createIsoDate(rawDate: string) {
  const match = rawDate.match(
    /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{2})(\d{2})$/
  );

  if (!match) {
    throw new Error(`Unsupported date format: ${rawDate}`);
  }

  return `${match[1]}T${match[2]}${match[3]}:${match[4]}`;
}

function formatMonthLabel(year: number, month: number) {
  const monthDate = new Date(Date.UTC(year, month - 1, 1));
  return format(monthDate, "MMM yyyy");
}

function buildMonthRange(monthKeys: string[]) {
  const sorted = [...monthKeys].sort();
  if (sorted.length === 0) {
    return [];
  }

  const [startYear, startMonth] = sorted[0].split("-").map(Number);
  const [endYear, endMonth] = sorted[sorted.length - 1].split("-").map(Number);
  const months: string[] = [];

  let year = startYear;
  let month = startMonth;

  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push(`${year}-${String(month).padStart(2, "0")}`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return months;
}

function ensureCanonicalExportPath() {
  const preferredPaths = [PRIVATE_EXPORT_PATH, PRIVATE_LOCAL_EXPORT_PATH, DEMO_EXPORT_PATH];

  for (const candidate of preferredPaths) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    "No supported CSV found. Use input/export.csv for private data or commit input/demo-export.csv for the public demo."
  );
}

function parseTransactions(csvText: string) {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true
  });

  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors.map((error) => error.message).join("; "));
  }

  return parsed.data.map((row, index) => {
    const result = csvRowSchema.safeParse(row);
    if (!result.success) {
      throw new Error(
        `Invalid CSV row ${index + 2}: ${result.error.issues
          .map((issue) => issue.message)
          .join(", ")}`
      );
    }

    const { Date: rawDate, Note: note, Amount: amount, Category: category, Type: type } =
      result.data;
    const datePart = rawDate.slice(0, 10);
    const [year, month, day] = datePart.split("-").map(Number);
    const monthKey = `${year}-${String(month).padStart(2, "0")}`;

    return {
      id: `${datePart}-${index}`,
      rawDate,
      isoDate: createIsoDate(rawDate),
      date: datePart,
      year,
      month,
      day,
      monthKey,
      monthLabel: formatMonthLabel(year, month),
      note,
      amount,
      category,
      type,
      signedAmount: type === "Expense" ? amount * -1 : amount
    } satisfies Transaction;
  });
}

function buildMonthlySummaries(transactions: Transaction[]) {
  const monthKeys = buildMonthRange(transactions.map((transaction) => transaction.monthKey));
  const grouped = new Map<string, MonthlySummary>();

  for (const monthKey of monthKeys) {
    const [year, month] = monthKey.split("-").map(Number);
    grouped.set(monthKey, {
      monthKey,
      monthLabel: formatMonthLabel(year, month),
      income: 0,
      expense: 0,
      net: 0,
      transactionCount: 0,
      expenseCount: 0,
      incomeCount: 0,
      averageExpense: 0,
      savingsRate: null
    });
  }

  for (const transaction of transactions) {
    const month = grouped.get(transaction.monthKey);
    if (!month) {
      continue;
    }

    month.transactionCount += 1;

    if (transaction.type === "Expense") {
      month.expense += transaction.amount;
      month.expenseCount += 1;
    } else {
      month.income += transaction.amount;
      month.incomeCount += 1;
    }

    month.net = month.income - month.expense;
  }

  return Array.from(grouped.values()).map((summary) => ({
    ...summary,
    averageExpense: summary.expenseCount > 0 ? summary.expense / summary.expenseCount : 0,
    savingsRate: summary.income > 0 ? summary.net / summary.income : null
  }));
}

function buildCategorySummaries(transactions: Transaction[], monthCount: number) {
  const grouped = new Map<string, { totalExpense: number; transactionCount: number }>();
  const totalExpense = transactions
    .filter((transaction) => transaction.type === "Expense")
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  for (const transaction of transactions) {
    if (transaction.type !== "Expense") {
      continue;
    }

    const current = grouped.get(transaction.category) ?? {
      totalExpense: 0,
      transactionCount: 0
    };
    current.totalExpense += transaction.amount;
    current.transactionCount += 1;
    grouped.set(transaction.category, current);
  }

  return Array.from(grouped.entries())
    .map(([category, value]) => ({
      category,
      totalExpense: value.totalExpense,
      transactionCount: value.transactionCount,
      averageExpense: value.transactionCount > 0 ? value.totalExpense / value.transactionCount : 0,
      monthlyAverage: monthCount > 0 ? value.totalExpense / monthCount : 0,
      shareOfExpense: totalExpense > 0 ? value.totalExpense / totalExpense : 0
    }) satisfies CategorySummary)
    .sort((left, right) => right.totalExpense - left.totalExpense);
}

function buildNoteSummaries(transactions: Transaction[]) {
  const grouped = new Map<string, { totalExpense: number; transactionCount: number }>();

  for (const transaction of transactions) {
    if (transaction.type !== "Expense") {
      continue;
    }

    const current = grouped.get(transaction.note) ?? {
      totalExpense: 0,
      transactionCount: 0
    };
    current.totalExpense += transaction.amount;
    current.transactionCount += 1;
    grouped.set(transaction.note, current);
  }

  return Array.from(grouped.entries())
    .map(([note, value]) => ({
      note,
      totalExpense: value.totalExpense,
      transactionCount: value.transactionCount
    }) satisfies NoteSummary)
    .sort((left, right) => right.totalExpense - left.totalExpense);
}

function average(numbers: number[]) {
  if (numbers.length === 0) {
    return 0;
  }
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

function buildRecurringCandidates(transactions: Transaction[]) {
  const grouped = new Map<string, Transaction[]>();

  for (const transaction of transactions) {
    if (transaction.type !== "Expense") {
      continue;
    }

    const key = `${transaction.note.toLowerCase()}::${transaction.category.toLowerCase()}`;
    const current = grouped.get(key) ?? [];
    current.push(transaction);
    grouped.set(key, current);
  }

  return Array.from(grouped.entries())
    .map(([key, entries]) => {
      const sorted = [...entries].sort((left, right) => left.date.localeCompare(right.date));
      const gaps = sorted.slice(1).map((transaction, index) => {
        const previous = new Date(sorted[index].date);
        const current = new Date(transaction.date);
        return (current.getTime() - previous.getTime()) / (1000 * 60 * 60 * 24);
      });
      const amounts = sorted.map((transaction) => transaction.amount);
      const cadenceDays = average(gaps);
      const averageAmount = average(amounts);
      const amountVariation =
        averageAmount > 0
          ? Math.max(...amounts.map((amount) => Math.abs(amount - averageAmount))) / averageAmount
          : 0;
      const monthsActive = new Set(sorted.map((entry) => entry.monthKey)).size;
      const totalExpense = amounts.reduce((sum, amount) => sum + amount, 0);
      const isLikelySubscription =
        sorted.length >= 3 &&
        monthsActive >= 3 &&
        cadenceDays >= 20 &&
        cadenceDays <= 40 &&
        amountVariation <= 0.55;

      return {
        id: key,
        note: sorted[0].note,
        category: sorted[0].category,
        count: sorted.length,
        totalExpense,
        averageAmount,
        lastDate: sorted[sorted.length - 1].date,
        monthsActive,
        cadenceDays,
        amountVariation,
        monthlyAverage: monthsActive > 0 ? totalExpense / monthsActive : totalExpense,
        isLikelySubscription
      } satisfies RecurringCandidate;
    })
    .filter((candidate) => candidate.count >= 3)
    .sort((left, right) => {
      if (left.isLikelySubscription !== right.isLikelySubscription) {
        return Number(right.isLikelySubscription) - Number(left.isLikelySubscription);
      }
      return right.monthlyAverage - left.monthlyAverage;
    });
}

function buildYearOverYear(monthly: MonthlySummary[], metric: keyof MonthlySummary) {
  const years = Array.from(new Set(monthly.map((summary) => String(summary.monthKey.slice(0, 4)))))
    .sort();
  const rows: YearOverYearMonth[] = [];

  for (let month = 1; month <= 12; month += 1) {
    const row: YearOverYearMonth = {
      month,
      label: formatMonthLabel(2025, month).split(" ")[0]
    };

    for (const year of years) {
      const summary = monthly.find((entry) => entry.monthKey === `${year}-${String(month).padStart(2, "0")}`);
      row[year] = summary ? Number(summary[metric]) : 0;
    }

    rows.push(row);
  }

  return rows;
}

function buildSpikeInsights(transactions: Transaction[]) {
  const grouped = new Map<string, { category: string; monthKey: string; monthLabel: string; amount: number }>();

  for (const transaction of transactions) {
    if (transaction.type !== "Expense") {
      continue;
    }

    const key = `${transaction.category}::${transaction.monthKey}`;
    const current = grouped.get(key) ?? {
      category: transaction.category,
      monthKey: transaction.monthKey,
      monthLabel: transaction.monthLabel,
      amount: 0
    };
    current.amount += transaction.amount;
    grouped.set(key, current);
  }

  const byCategory = new Map<string, { amount: number; monthKey: string; monthLabel: string }[]>();
  for (const item of grouped.values()) {
    const current = byCategory.get(item.category) ?? [];
    current.push(item);
    byCategory.set(item.category, current);
  }

  const spikes: SpikeInsight[] = [];

  for (const [category, entries] of byCategory.entries()) {
    const baseline = average(entries.map((entry) => entry.amount));
    if (baseline === 0) {
      continue;
    }

    for (const entry of entries) {
      const increaseRatio = entry.amount / baseline;
      if (entries.length >= 3 && increaseRatio >= 1.6 && entry.amount - baseline >= 150) {
        spikes.push({
          monthKey: entry.monthKey,
          monthLabel: entry.monthLabel,
          category,
          amount: entry.amount,
          baseline,
          increaseRatio
        });
      }
    }
  }

  return spikes.sort((left, right) => right.increaseRatio - left.increaseRatio).slice(0, 12);
}

function buildKpis(monthly: MonthlySummary[], transactions: Transaction[]) {
  const totalIncome = monthly.reduce((sum, item) => sum + item.income, 0);
  const totalExpense = monthly.reduce((sum, item) => sum + item.expense, 0);
  const net = totalIncome - totalExpense;
  const expenseTransactions = transactions.filter((transaction) => transaction.type === "Expense");
  const incomeTransactions = transactions.filter((transaction) => transaction.type === "Income");

  return {
    totalIncome,
    totalExpense,
    net,
    monthsTracked: monthly.length,
    averageMonthlyIncome: monthly.length > 0 ? totalIncome / monthly.length : 0,
    averageMonthlyExpense: monthly.length > 0 ? totalExpense / monthly.length : 0,
    averageMonthlyNet: monthly.length > 0 ? net / monthly.length : 0,
    savingsRate: totalIncome > 0 ? net / totalIncome : null,
    largestExpense: expenseTransactions.length > 0 ? Math.max(...expenseTransactions.map((item) => item.amount)) : 0,
    largestIncome: incomeTransactions.length > 0 ? Math.max(...incomeTransactions.map((item) => item.amount)) : 0
  } satisfies KpiSummary;
}

function buildDatasetMeta(transactions: Transaction[], sourceName: string) {
  const expenseRows = transactions.filter((transaction) => transaction.type === "Expense").length;
  const incomeRows = transactions.filter((transaction) => transaction.type === "Income").length;

  return {
    sourceName,
    firstDate: transactions[0]?.date ?? "",
    lastDate: transactions[transactions.length - 1]?.date ?? "",
    expenseRows,
    incomeRows
  };
}

export function createExpenseDataset(csvText: string, sourceName = "Manual import"): ExpenseDataset {
  const transactions = parseTransactions(csvText).sort((left, right) => left.date.localeCompare(right.date));
  const monthly = buildMonthlySummaries(transactions);
  const categories = buildCategorySummaries(transactions, monthly.length);
  const notes = buildNoteSummaries(transactions);
  const recurring = buildRecurringCandidates(transactions);
  const yoyExpense = buildYearOverYear(monthly, "expense");
  const yoyNet = buildYearOverYear(monthly, "net");
  const spikes = buildSpikeInsights(transactions);
  const kpis = buildKpis(monthly, transactions);
  const meta = buildDatasetMeta(transactions, sourceName);

  return {
    transactions,
    monthly,
    categories,
    notes,
    recurring,
    yoyExpense,
    yoyNet,
    spikes,
    kpis,
    availableMonths: monthly.map((entry) => entry.monthKey),
    availableCategories: categories.map((entry) => entry.category),
    meta
  };
}

export function getExpenseDataset() {
  if (cachedDataset) {
    return cachedDataset;
  }

  const csvPath = ensureCanonicalExportPath();
  const csvText = fs.readFileSync(csvPath, "utf8");
  cachedDataset = createExpenseDataset(csvText, path.basename(csvPath));
  return cachedDataset;
}
