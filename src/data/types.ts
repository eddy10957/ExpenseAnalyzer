export type TransactionType = "Expense" | "Income";

export interface Transaction {
  id: string;
  rawDate: string;
  isoDate: string;
  date: string;
  year: number;
  month: number;
  day: number;
  monthKey: string;
  monthLabel: string;
  note: string;
  amount: number;
  category: string;
  type: TransactionType;
  signedAmount: number;
}

export interface MonthlySummary {
  monthKey: string;
  monthLabel: string;
  income: number;
  expense: number;
  net: number;
  transactionCount: number;
  expenseCount: number;
  incomeCount: number;
  averageExpense: number;
  savingsRate: number | null;
}

export interface CategorySummary {
  category: string;
  totalExpense: number;
  transactionCount: number;
  averageExpense: number;
  monthlyAverage: number;
  shareOfExpense: number;
}

export interface NoteSummary {
  note: string;
  totalExpense: number;
  transactionCount: number;
}

export interface RecurringCandidate {
  id: string;
  note: string;
  category: string;
  count: number;
  totalExpense: number;
  averageAmount: number;
  lastDate: string;
  monthsActive: number;
  cadenceDays: number;
  amountVariation: number;
  monthlyAverage: number;
  isLikelySubscription: boolean;
}

export interface YearOverYearMonth {
  month: number;
  label: string;
  [year: string]: number | string;
}

export interface SpikeInsight {
  monthKey: string;
  monthLabel: string;
  category: string;
  amount: number;
  baseline: number;
  increaseRatio: number;
}

export interface KpiSummary {
  totalIncome: number;
  totalExpense: number;
  net: number;
  monthsTracked: number;
  averageMonthlyIncome: number;
  averageMonthlyExpense: number;
  averageMonthlyNet: number;
  savingsRate: number | null;
  largestExpense: number;
  largestIncome: number;
}

export interface DatasetMeta {
  sourceName: string;
  firstDate: string;
  lastDate: string;
  expenseRows: number;
  incomeRows: number;
}

export interface ExpenseDataset {
  transactions: Transaction[];
  monthly: MonthlySummary[];
  categories: CategorySummary[];
  notes: NoteSummary[];
  recurring: RecurringCandidate[];
  yoyExpense: YearOverYearMonth[];
  yoyNet: YearOverYearMonth[];
  spikes: SpikeInsight[];
  kpis: KpiSummary;
  availableMonths: string[];
  availableCategories: string[];
  meta: DatasetMeta;
}
