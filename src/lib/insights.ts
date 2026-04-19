import type {
  CategorySummary,
  MonthlySummary,
  NoteSummary,
  RecurringCandidate,
  SpikeInsight,
  Transaction
} from "@/data/types";

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  });
}

export function buildMonthlyForTransactions(transactions: Transaction[], monthKeys: string[]) {
  const grouped = new Map<string, MonthlySummary>();

  for (const monthKey of monthKeys) {
    grouped.set(monthKey, {
      monthKey,
      monthLabel: formatMonthLabel(monthKey),
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

  return Array.from(grouped.values()).map((entry) => ({
    ...entry,
    averageExpense: entry.expenseCount > 0 ? entry.expense / entry.expenseCount : 0,
    savingsRate: entry.income > 0 ? entry.net / entry.income : null
  }));
}

export function buildCategorySummariesForTransactions(transactions: Transaction[], monthCount: number) {
  const grouped = new Map<string, { totalExpense: number; transactionCount: number }>();
  const totalExpense = transactions
    .filter((transaction) => transaction.type === "Expense")
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  for (const transaction of transactions) {
    if (transaction.type !== "Expense") {
      continue;
    }

    const current = grouped.get(transaction.category) ?? { totalExpense: 0, transactionCount: 0 };
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

export function buildNoteSummariesForTransactions(transactions: Transaction[]) {
  const grouped = new Map<string, { totalExpense: number; transactionCount: number }>();

  for (const transaction of transactions) {
    if (transaction.type !== "Expense") {
      continue;
    }

    const current = grouped.get(transaction.note) ?? { totalExpense: 0, transactionCount: 0 };
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

export function buildRecurringForTransactions(transactions: Transaction[]) {
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
    .map(([id, entries]) => {
      const sorted = [...entries].sort((left, right) => left.date.localeCompare(right.date));
      const gaps = sorted.slice(1).map((entry, index) => {
        const current = new Date(`${entry.date}T00:00:00Z`);
        const previous = new Date(`${sorted[index].date}T00:00:00Z`);
        return (current.getTime() - previous.getTime()) / (1000 * 60 * 60 * 24);
      });
      const amounts = sorted.map((entry) => entry.amount);
      const averageAmount = average(amounts);
      const amountVariation =
        averageAmount > 0
          ? Math.max(...amounts.map((amount) => Math.abs(amount - averageAmount))) / averageAmount
          : 0;
      const cadenceDays = average(gaps);
      const monthsActive = new Set(sorted.map((entry) => entry.monthKey)).size;
      const totalExpense = amounts.reduce((sum, amount) => sum + amount, 0);

      return {
        id,
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
        isLikelySubscription:
          sorted.length >= 3 &&
          monthsActive >= 3 &&
          cadenceDays >= 20 &&
          cadenceDays <= 40 &&
          amountVariation <= 0.55
      } satisfies RecurringCandidate;
    })
    .filter((candidate) => candidate.count >= 3)
    .sort((left, right) => right.monthlyAverage - left.monthlyAverage);
}

export function buildSpikesForTransactions(transactions: Transaction[]) {
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
  for (const entry of grouped.values()) {
    const current = byCategory.get(entry.category) ?? [];
    current.push(entry);
    byCategory.set(entry.category, current);
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

  return spikes.sort((left, right) => right.increaseRatio - left.increaseRatio);
}

export function buildRollingNet(monthly: MonthlySummary[], windowSize = 3) {
  return monthly.map((entry, index) => {
    const frame = monthly.slice(Math.max(0, index - windowSize + 1), index + 1);
    return {
      monthKey: entry.monthKey,
      monthLabel: entry.monthLabel,
      rollingNet: average(frame.map((item) => item.net)),
      rollingExpense: average(frame.map((item) => item.expense))
    };
  });
}

export function calculateExpenseVolatility(monthly: MonthlySummary[]) {
  const expenseMonths = monthly.map((item) => item.expense);
  const mean = average(expenseMonths);
  if (expenseMonths.length === 0 || mean === 0) {
    return 0;
  }

  const variance = average(expenseMonths.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance) / mean;
}

export function getLargestTransactions(transactions: Transaction[], limit = 8) {
  return [...transactions]
    .filter((transaction) => transaction.type === "Expense")
    .sort((left, right) => right.amount - left.amount)
    .slice(0, limit);
}

export function getRecentTransactions(transactions: Transaction[], limit = 10) {
  return [...transactions]
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, limit);
}
