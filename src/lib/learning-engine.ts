import type { CategorySummary, MonthlySummary, RecurringCandidate, SpikeInsight, Transaction } from "@/data/types";

import { calculateExpenseVolatility } from "@/lib/insights";

export type InsightSeverity = "positive" | "watch" | "action";
export type SpendingBucket = "Essential" | "Flexible" | "Growth" | "Other";

export interface SpendingBucketSummary {
  bucket: SpendingBucket;
  totalExpense: number;
  share: number;
  monthlyAverage: number;
  categories: string[];
}

export interface NarrativeInsight {
  id: string;
  title: string;
  summary: string;
  evidence: string;
  action: string;
  severity: InsightSeverity;
  estimatedMonthlySavings?: number;
  relatedCategory?: string;
  relatedMonth?: string;
}

export interface InsightSnapshot {
  positiveMonths: number;
  negativeMonths: number;
  trackedMonths: number;
  recurringMonthlySpend: number;
  recurringShare: number;
  flexibleShare: number;
  essentialShare: number;
  optimizationPotentialMonthly: number;
  recentExpenseChange: number | null;
  recentNetChange: number | null;
}

export interface TrendComparison {
  label: string;
  recent: number;
  baseline: number;
  change: number | null;
}

export interface InsightReport {
  snapshot: InsightSnapshot;
  learnings: NarrativeInsight[];
  opportunities: NarrativeInsight[];
  buckets: SpendingBucketSummary[];
  trendComparisons: TrendComparison[];
  priorityCategories: Array<
    CategorySummary & {
      bucket: SpendingBucket;
    }
  >;
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function includesAny(value: string, terms: string[]) {
  const lower = normalize(value);
  return terms.some((term) => lower.includes(term));
}

export function getSpendingBucket(category: string): SpendingBucket {
  if (includesAny(category, ["rent", "affitto", "grocer", "health", "transport", "casa"])) {
    return "Essential";
  }

  if (includesAny(category, ["learn", "study", "course"])) {
    return "Growth";
  }

  if (
    includesAny(category, [
      "food",
      "sfizi",
      "subscription",
      "gift",
      "regalo",
      "sport",
      "viaggi",
      "travel",
      "mamma",
      "auh"
    ])
  ) {
    return "Flexible";
  }

  return "Other";
}

function findCategory(categories: CategorySummary[], names: string[]) {
  const normalizedNames = names.map(normalize);
  return categories.find((category) => normalizedNames.includes(normalize(category.category)));
}

function changeRatio(current: number, baseline: number) {
  if (baseline === 0) {
    return null;
  }

  return current / baseline - 1;
}

function buildSpendingBuckets(categories: CategorySummary[], monthCount: number) {
  const totalExpense = categories.reduce((sum, category) => sum + category.totalExpense, 0);
  const grouped = new Map<SpendingBucket, SpendingBucketSummary>();

  for (const category of categories) {
    const bucket = getSpendingBucket(category.category);
    const current = grouped.get(bucket) ?? {
      bucket,
      totalExpense: 0,
      share: 0,
      monthlyAverage: 0,
      categories: []
    };

    current.totalExpense += category.totalExpense;
    current.categories.push(category.category);
    grouped.set(bucket, current);
  }

  return Array.from(grouped.values())
    .map((bucket) => ({
      ...bucket,
      share: totalExpense > 0 ? bucket.totalExpense / totalExpense : 0,
      monthlyAverage: monthCount > 0 ? bucket.totalExpense / monthCount : 0
    }))
    .sort((left, right) => right.totalExpense - left.totalExpense);
}

function buildTrendComparisons(monthly: MonthlySummary[]) {
  const activeMonths = monthly.filter((month) => month.expense > 0 || month.income > 0);
  const recent = activeMonths.slice(-3);
  const baseline = activeMonths.slice(-9, -3);

  const recentExpense = average(recent.map((month) => month.expense));
  const baselineExpense = average(baseline.map((month) => month.expense));
  const recentNet = average(recent.map((month) => month.net));
  const baselineNet = average(baseline.map((month) => month.net));

  return [
    {
      label: "Expense trend",
      recent: recentExpense,
      baseline: baselineExpense,
      change: baseline.length > 0 ? changeRatio(recentExpense, baselineExpense) : null
    },
    {
      label: "Net trend",
      recent: recentNet,
      baseline: baselineNet,
      change: baseline.length > 0 ? changeRatio(recentNet, baselineNet) : null
    }
  ] satisfies TrendComparison[];
}

function buildLearnings({
  monthly,
  categories,
  recurring,
  spikes
}: {
  monthly: MonthlySummary[];
  categories: CategorySummary[];
  recurring: RecurringCandidate[];
  spikes: SpikeInsight[];
}) {
  const activeMonths = monthly.filter((month) => month.expense > 0 || month.income > 0);
  const positiveMonths = activeMonths.filter((month) => month.net >= 0).length;
  const negativeMonths = activeMonths.filter((month) => month.net < 0).length;
  const averageMonthlyExpense = average(activeMonths.map((month) => month.expense));
  const topCategory = categories[0];
  const likelySubscriptions = recurring.filter((candidate) => candidate.isLikelySubscription);
  const recurringMonthlySpend = likelySubscriptions.reduce(
    (sum, candidate) => sum + candidate.monthlyAverage,
    0
  );
  const recurringShare = averageMonthlyExpense > 0 ? recurringMonthlySpend / averageMonthlyExpense : 0;
  const buckets = buildSpendingBuckets(categories, activeMonths.length);
  const flexibleBucket = buckets.find((bucket) => bucket.bucket === "Flexible");
  const expenseVolatility = calculateExpenseVolatility(activeMonths);
  const trends = buildTrendComparisons(activeMonths);
  const food = findCategory(categories, ["food"]);
  const groceries = findCategory(categories, ["groceries"]);
  const learnings: NarrativeInsight[] = [];

  if (activeMonths.length > 0) {
    const positiveRatio = positiveMonths / activeMonths.length;
    learnings.push({
      id: "cashflow-stability",
      title:
        positiveRatio >= 0.65
          ? "You are usually cashflow-positive"
          : "Your month-to-month cashflow is still fragile",
      summary:
        positiveRatio >= 0.65
          ? `You finished ${positiveMonths} of ${activeMonths.length} tracked months with positive net cashflow, which means the system works most of the time.`
          : `Only ${positiveMonths} of ${activeMonths.length} tracked months finished positive, so spending shocks are still strong enough to break the month.`,
      evidence:
        negativeMonths > 0
          ? `${negativeMonths} months finished negative, with the worst months pulling down the average buffer.`
          : "No negative months were found in the current filtered view.",
      action:
        positiveRatio >= 0.65
          ? "Focus optimization on the categories that create bad months rather than trying to cut everything."
          : "Prioritize stabilizing flexible categories and recurring drag before worrying about smaller one-off expenses.",
      severity: positiveRatio >= 0.65 ? "positive" : "action"
    });
  }

  if (topCategory && topCategory.shareOfExpense >= 0.22) {
    learnings.push({
      id: "baseline-driver",
      title: `${topCategory.category} defines your baseline cost structure`,
      summary: `${topCategory.category} absorbs ${Math.round(topCategory.shareOfExpense * 100)}% of visible expenses, so it shapes the floor of your monthly budget more than any other category.`,
      evidence: `That works out to about ${roundMoney(topCategory.monthlyAverage)} per month on average across the filtered period.`,
      action:
        getSpendingBucket(topCategory.category) === "Essential"
          ? "Treat it as a fixed baseline and optimize around the categories layered on top of it."
          : "If this category matters less than it costs, even a modest trim will noticeably improve your monthly net.",
      severity: topCategory.shareOfExpense >= 0.32 ? "action" : "watch",
      relatedCategory: topCategory.category
    });
  }

  if (food && groceries && food.monthlyAverage > groceries.monthlyAverage * 1.1) {
    learnings.push({
      id: "food-vs-groceries",
      title: "Eating out is costing more than stocking the kitchen",
      summary: `Food is running above groceries in the current view, which usually means convenience or social meals are beating your lower-cost home baseline.`,
      evidence: `Average monthly Food spend is about ${roundMoney(food.monthlyAverage)}, versus ${roundMoney(groceries.monthlyAverage)} for Groceries.`,
      action: "If you intentionally shift even a small share of food spend into planned grocery meals, you should feel it quickly in monthly net.",
      severity: "action",
      relatedCategory: food.category
    });
  }

  if (recurringMonthlySpend > 0) {
    learnings.push({
      id: "recurring-drag",
      title:
        recurringShare >= 0.09
          ? "Recurring spend is a real fixed drag now"
          : "Recurring spend is present, but still manageable",
      summary: `Likely recurring charges add up to about ${roundMoney(recurringMonthlySpend)} per month in the current view.`,
      evidence: `${Math.round(recurringShare * 100)}% of average monthly expense is now tied up in repeat patterns rather than one-off decisions.`,
      action:
        recurringShare >= 0.09
          ? "Audit the top recurring items first, because they compound quietly every month."
          : "Keep recurring charges visible so they do not grow faster than the rest of your lifestyle spend.",
      severity: recurringShare >= 0.09 ? "action" : "watch"
    });
  }

  if ((flexibleBucket?.share ?? 0) >= 0.3) {
    learnings.push({
      id: "flexible-share",
      title: "A large share of your spend is still flexible",
      summary: `Categories like food, travel, subscriptions, gifts, and discretionary lifestyle items make up about ${Math.round((flexibleBucket?.share ?? 0) * 100)}% of your visible expenses.`,
      evidence: "That is useful, because it means meaningful optimization is still possible without touching true essentials first.",
      action: "Start with the highest flexible categories and set lighter guardrails there instead of chasing tiny cuts everywhere.",
      severity: "positive"
    });
  }

  if (expenseVolatility >= 0.25 || spikes.length > 0) {
    const biggestSpike = spikes[0];
    learnings.push({
      id: "lumpy-spend",
      title: "Your spending is lumpy rather than smooth",
      summary: "The dataset shows noticeable spikes instead of a perfectly even monthly rhythm, which makes planning harder even when the annual total is acceptable.",
      evidence: biggestSpike
        ? `${biggestSpike.category} spiked in ${biggestSpike.monthLabel}, landing about ${Math.round(
            (biggestSpike.increaseRatio - 1) * 100
          )}% above its own baseline.`
        : "Monthly expense volatility is high enough to suggest irregular shocks are part of the pattern.",
      action: "The fix is usually pre-planning big categories and one-off purchases, not trying to make every month identical.",
      severity: expenseVolatility >= 0.35 ? "action" : "watch",
      relatedCategory: biggestSpike?.category,
      relatedMonth: biggestSpike?.monthKey
    });
  }

  const expenseTrend = trends.find((trend) => trend.label === "Expense trend");
  if (expenseTrend?.change !== null && Math.abs(expenseTrend.change) >= 0.12) {
    const direction = expenseTrend.change > 0 ? "accelerating" : "cooling down";
    learnings.push({
      id: "recent-direction",
      title: `Recent spending is ${direction}`,
      summary:
        expenseTrend.change > 0
          ? "The latest months are running more expensive than the earlier baseline in the same filtered view."
          : "The latest months are running leaner than the earlier baseline, which suggests some improvement is already happening.",
      evidence: `Recent average expense is ${roundMoney(expenseTrend.recent)} versus ${roundMoney(
        expenseTrend.baseline
      )} in the prior baseline period.`,
      action:
        expenseTrend.change > 0
          ? "Check whether the increase came from a few high-friction categories or from a broad lifestyle creep."
          : "If this leaner pattern feels sustainable, codify what changed so it sticks.",
      severity: expenseTrend.change > 0 ? "watch" : "positive"
    });
  }

  return learnings.slice(0, 6);
}

function buildOpportunities({
  monthly,
  categories,
  recurring,
  spikes
}: {
  monthly: MonthlySummary[];
  categories: CategorySummary[];
  recurring: RecurringCandidate[];
  spikes: SpikeInsight[];
}) {
  const activeMonths = monthly.filter((month) => month.expense > 0 || month.income > 0);
  const food = findCategory(categories, ["food"]);
  const groceries = findCategory(categories, ["groceries"]);
  const likelySubscriptions = recurring.filter((candidate) => candidate.isLikelySubscription);
  const recurringMonthlySpend = likelySubscriptions.reduce(
    (sum, candidate) => sum + candidate.monthlyAverage,
    0
  );
  const buckets = buildSpendingBuckets(categories, activeMonths.length);
  const flexibleBucket = buckets.find((bucket) => bucket.bucket === "Flexible");
  const biggestFlexibleCategory = categories
    .filter((category) => getSpendingBucket(category.category) === "Flexible")
    .sort((left, right) => right.monthlyAverage - left.monthlyAverage)[0];

  const opportunities: NarrativeInsight[] = [];

  if (recurringMonthlySpend >= 50) {
    opportunities.push({
      id: "audit-recurring",
      title: "Audit recurring charges first",
      summary: "Recurring items are the easiest place to create durable savings because one decision pays off every month after that.",
      evidence: `Likely subscriptions and recurring charges add up to about ${roundMoney(recurringMonthlySpend)} per month.`,
      action: "Review the top recurring items and ask whether each one still earns its place. A 15% trim here is realistic for many people.",
      severity: "action",
      estimatedMonthlySavings: roundMoney(recurringMonthlySpend * 0.15)
    });
  }

  if (food && groceries && food.monthlyAverage > groceries.monthlyAverage * 1.1) {
    opportunities.push({
      id: "rebalance-food",
      title: "Rebalance Food vs Groceries",
      summary: "Your convenience or dining spend is outpacing your kitchen baseline, which usually leaves room for a painless reset.",
      evidence: `Food averages about ${roundMoney(food.monthlyAverage)} per month versus ${roundMoney(
        groceries.monthlyAverage
      )} for Groceries.`,
      action: "Try trimming Food by around 10% and replacing that spend with planned grocery-led meals.",
      severity: "action",
      estimatedMonthlySavings: roundMoney(food.monthlyAverage * 0.1),
      relatedCategory: food.category
    });
  }

  if (biggestFlexibleCategory && biggestFlexibleCategory.monthlyAverage >= 150) {
    opportunities.push({
      id: "largest-flexible-category",
      title: `Set a lighter guardrail on ${biggestFlexibleCategory.category}`,
      summary: `${biggestFlexibleCategory.category} is your biggest flexible category, which makes it the cleanest place to trim without touching fixed essentials.`,
      evidence: `It is averaging about ${roundMoney(biggestFlexibleCategory.monthlyAverage)} per month in the current view.`,
      action: "Even a 10% reduction here would be meaningful while still leaving room to enjoy the category.",
      severity: "watch",
      estimatedMonthlySavings: roundMoney(biggestFlexibleCategory.monthlyAverage * 0.1),
      relatedCategory: biggestFlexibleCategory.category
    });
  }

  if ((flexibleBucket?.monthlyAverage ?? 0) >= 500) {
    opportunities.push({
      id: "flexible-bucket",
      title: "Treat flexible spend as a managed budget, not leftovers",
      summary: "A meaningful amount of your money is in categories that are adjustable month to month.",
      evidence: `Flexible categories are averaging about ${roundMoney(
        flexibleBucket?.monthlyAverage ?? 0
      )} per month.`,
      action: "Create a soft monthly target for flexible categories and review it once per week instead of waiting for month-end.",
      severity: "watch",
      estimatedMonthlySavings: roundMoney((flexibleBucket?.monthlyAverage ?? 0) * 0.08)
    });
  }

  const biggestSpike = spikes[0];
  if (biggestSpike && biggestSpike.amount - biggestSpike.baseline >= 150) {
    opportunities.push({
      id: "spike-control",
      title: `Pre-plan ${biggestSpike.category} before it spikes again`,
      summary: "The sharpest overspend events usually come from categories that were not planned tightly enough ahead of time.",
      evidence: `${biggestSpike.category} hit ${roundMoney(biggestSpike.amount)} in ${biggestSpike.monthLabel}, versus a baseline of ${roundMoney(biggestSpike.baseline)}.`,
      action: "Give this category a specific monthly cap or sinking-fund style buffer so the next spike is expected instead of disruptive.",
      severity: "watch",
      relatedCategory: biggestSpike.category,
      relatedMonth: biggestSpike.monthKey
    });
  }

  return opportunities
    .sort(
      (left, right) =>
        (right.estimatedMonthlySavings ?? 0) - (left.estimatedMonthlySavings ?? 0)
    )
    .slice(0, 5);
}

export function buildInsightReport({
  monthly,
  categories,
  recurring,
  spikes
}: {
  monthly: MonthlySummary[];
  categories: CategorySummary[];
  recurring: RecurringCandidate[];
  spikes: SpikeInsight[];
  transactions: Transaction[];
}) {
  const activeMonths = monthly.filter((month) => month.expense > 0 || month.income > 0);
  const buckets = buildSpendingBuckets(categories, activeMonths.length);
  const likelySubscriptions = recurring.filter((candidate) => candidate.isLikelySubscription);
  const recurringMonthlySpend = likelySubscriptions.reduce(
    (sum, candidate) => sum + candidate.monthlyAverage,
    0
  );
  const averageMonthlyExpense = average(activeMonths.map((month) => month.expense));
  const trendComparisons = buildTrendComparisons(activeMonths);
  const opportunities = buildOpportunities({ monthly, categories, recurring, spikes });
  const flexibleBucket = buckets.find((bucket) => bucket.bucket === "Flexible");
  const essentialBucket = buckets.find((bucket) => bucket.bucket === "Essential");

  return {
    snapshot: {
      positiveMonths: activeMonths.filter((month) => month.net >= 0).length,
      negativeMonths: activeMonths.filter((month) => month.net < 0).length,
      trackedMonths: activeMonths.length,
      recurringMonthlySpend: roundMoney(recurringMonthlySpend),
      recurringShare: averageMonthlyExpense > 0 ? recurringMonthlySpend / averageMonthlyExpense : 0,
      flexibleShare: flexibleBucket?.share ?? 0,
      essentialShare: essentialBucket?.share ?? 0,
      optimizationPotentialMonthly: roundMoney(
        opportunities.reduce((sum, item) => sum + (item.estimatedMonthlySavings ?? 0), 0)
      ),
      recentExpenseChange: trendComparisons[0]?.change ?? null,
      recentNetChange: trendComparisons[1]?.change ?? null
    },
    learnings: buildLearnings({ monthly, categories, recurring, spikes }),
    opportunities,
    buckets,
    trendComparisons,
    priorityCategories: categories.slice(0, 8).map((category) => ({
      ...category,
      bucket: getSpendingBucket(category.category)
    }))
  } satisfies InsightReport;
}
