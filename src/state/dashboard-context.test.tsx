import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FilterBar } from "@/components/dashboard/FilterBar";
import { createExpenseDataset } from "@/data/expense-data";
import { DashboardProvider, useDashboard } from "@/state/dashboard-context";

const sampleCsv = `Date,Note,Amount,Category,Type
2026-01-05 09:00:00 +0000,Rent,950,Rent,Expense
2026-01-06 09:00:00 +0000,Salary,3000,Paycheck,Income
2026-02-05 09:00:00 +0000,Groceries,85,Groceries,Expense
2026-02-10 09:00:00 +0000,Salary,3000,Paycheck,Income`;

function Probe() {
  const { filteredTransactions } = useDashboard();
  return <p data-testid="count">{filteredTransactions.length}</p>;
}

afterEach(() => {
  cleanup();
});

describe("DashboardProvider + FilterBar", () => {
  it("updates filtered transactions when category or type changes", async () => {
    window.localStorage.clear();
    window.history.replaceState({}, "", "/");
    const dataset = createExpenseDataset(sampleCsv);

    render(
      <DashboardProvider dataset={dataset}>
        <FilterBar />
        <Probe />
      </DashboardProvider>
    );

    expect(screen.getByTestId("count")).toHaveTextContent("4");

    fireEvent.change(screen.getByLabelText("Category"), {
      target: { value: "Groceries" }
    });

    await waitFor(() => {
      expect(screen.getByTestId("count")).toHaveTextContent("1");
    });

    fireEvent.change(screen.getByLabelText("Category"), {
      target: { value: "all" }
    });
    fireEvent.change(screen.getByLabelText("Type"), {
      target: { value: "income" }
    });

    await waitFor(() => {
      expect(screen.getByTestId("count")).toHaveTextContent("2");
    });

    expect(window.location.search).toContain("type=income");
  });

  it("hydrates filters from the URL query string", async () => {
    window.localStorage.clear();
    window.history.replaceState({}, "", "/?category=Groceries&type=expense&start=2026-02&end=2026-02");
    const dataset = createExpenseDataset(sampleCsv);

    render(
      <DashboardProvider dataset={dataset}>
        <FilterBar />
        <Probe />
      </DashboardProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("count")).toHaveTextContent("1");
    });

    expect(screen.getByLabelText("Category")).toHaveValue("Groceries");
    expect(screen.getByLabelText("Type")).toHaveValue("expense");
  });
});
