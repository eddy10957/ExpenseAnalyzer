import { describe, expect, it } from "vitest";

import { createExpenseDataset } from "@/data/expense-data";
import { buildInsightReport, getSpendingBucket } from "@/lib/learning-engine";

const sampleCsv = `Date,Note,Amount,Category,Type
2026-01-02 09:00:00 +0000,Rent,1000,Rent,Expense
2026-01-04 09:00:00 +0000,Food,420,Food,Expense
2026-01-07 09:00:00 +0000,Groceries,180,Groceries,Expense
2026-01-09 09:00:00 +0000,Netflix,20,Subscriptions,Expense
2026-01-10 09:00:00 +0000,Salary,2500,Paycheck,Income
2026-02-02 09:00:00 +0000,Rent,1000,Rent,Expense
2026-02-04 09:00:00 +0000,Food,390,Food,Expense
2026-02-07 09:00:00 +0000,Groceries,170,Groceries,Expense
2026-02-09 09:00:00 +0000,Netflix,20,Subscriptions,Expense
2026-02-10 09:00:00 +0000,Salary,2500,Paycheck,Income
2026-03-02 09:00:00 +0000,Rent,1000,Rent,Expense
2026-03-04 09:00:00 +0000,Food,450,Food,Expense
2026-03-07 09:00:00 +0000,Groceries,160,Groceries,Expense
2026-03-09 09:00:00 +0000,Netflix,20,Subscriptions,Expense
2026-03-10 09:00:00 +0000,Salary,2500,Paycheck,Income
2026-04-02 09:00:00 +0000,Rent,1000,Rent,Expense
2026-04-04 09:00:00 +0000,Food,700,Food,Expense
2026-04-07 09:00:00 +0000,Groceries,140,Groceries,Expense
2026-04-09 09:00:00 +0000,Netflix,20,Subscriptions,Expense
2026-04-10 09:00:00 +0000,Salary,2500,Paycheck,Income`;

describe("learning engine", () => {
  it("classifies common categories into useful spending buckets", () => {
    expect(getSpendingBucket("Rent")).toBe("Essential");
    expect(getSpendingBucket("Food")).toBe("Flexible");
    expect(getSpendingBucket("Learning")).toBe("Growth");
  });

  it("produces learnings and opportunities from spending patterns", () => {
    const dataset = createExpenseDataset(sampleCsv, "sample.csv");
    const report = buildInsightReport({
      monthly: dataset.monthly,
      categories: dataset.categories,
      recurring: dataset.recurring,
      spikes: dataset.spikes,
      transactions: dataset.transactions
    });

    expect(report.learnings.some((item) => item.id === "food-vs-groceries")).toBe(true);
    expect(report.learnings.some((item) => item.id === "baseline-driver")).toBe(true);
    expect(report.opportunities.some((item) => item.id === "rebalance-food")).toBe(true);
    expect(report.opportunities.some((item) => item.id === "audit-recurring")).toBe(true);
    expect(report.snapshot.optimizationPotentialMonthly).toBeGreaterThan(0);
  });
});
