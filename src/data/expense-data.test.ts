import { describe, expect, it } from "vitest";

import { createExpenseDataset } from "@/data/expense-data";

const sampleCsv = `Date,Note,Amount,Category,Type
2026-01-05 09:00:00 +0000,Rent,950,Rent,Expense
2026-01-06 09:00:00 +0000,Salary,3000,Paycheck,Income
2026-02-05 09:00:00 +0000,Rent,950,Rent,Expense
2026-02-07 09:00:00 +0000,Netflix,12.99,Subscriptions,Expense
2026-02-10 09:00:00 +0000,Salary,3000,Paycheck,Income
2026-03-05 09:00:00 +0000,Rent,950,Rent,Expense
2026-03-07 09:00:00 +0000,Netflix,12.99,Subscriptions,Expense
2026-03-10 09:00:00 +0000,Salary,3000,Paycheck,Income
2026-04-07 09:00:00 +0000,Netflix,12.99,Subscriptions,Expense`;

describe("createExpenseDataset", () => {
  it("parses rows and assigns signed amounts from Type", () => {
    const dataset = createExpenseDataset(sampleCsv, "sample.csv");

    expect(dataset.transactions).toHaveLength(9);
    expect(dataset.transactions[0]).toMatchObject({
      category: "Rent",
      type: "Expense",
      signedAmount: -950
    });
    expect(dataset.transactions[1]).toMatchObject({
      category: "Paycheck",
      type: "Income",
      signedAmount: 3000
    });
    expect(dataset.meta).toMatchObject({
      sourceName: "sample.csv",
      firstDate: "2026-01-05",
      lastDate: "2026-04-07",
      expenseRows: 6,
      incomeRows: 3
    });
  });

  it("builds monthly and category aggregations correctly", () => {
    const dataset = createExpenseDataset(sampleCsv);
    const february = dataset.monthly.find((month) => month.monthKey === "2026-02");
    const rent = dataset.categories.find((category) => category.category === "Rent");

    expect(february).toMatchObject({
      income: 3000,
      expense: 962.99,
      net: 2037.01
    });
    expect(rent?.totalExpense).toBe(2850);
    expect(dataset.kpis.totalIncome).toBe(9000);
    expect(dataset.kpis.totalExpense).toBeCloseTo(2888.97);
  });

  it("detects recurring candidates for repeated note and category patterns", () => {
    const dataset = createExpenseDataset(sampleCsv);
    const recurringNotes = dataset.recurring.map((candidate) => candidate.note);

    expect(recurringNotes).toContain("Rent");
    expect(recurringNotes).toContain("Netflix");
    expect(dataset.recurring.find((candidate) => candidate.note === "Netflix")?.isLikelySubscription).toBe(true);
  });
});
