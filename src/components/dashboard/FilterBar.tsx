import { startTransition, useDeferredValue, useEffect, useState } from "react";

import { formatDateLabel, formatMonthRangeLabel } from "@/lib/format";
import { useDashboard } from "@/state/dashboard-context";

function buildPresetMonths(availableMonths: string[], count: number) {
  if (availableMonths.length === 0) {
    return null;
  }

  const endMonth = availableMonths[availableMonths.length - 1];
  const startIndex = Math.max(0, availableMonths.length - count);
  return {
    startMonth: availableMonths[startIndex],
    endMonth
  };
}

export function FilterBar() {
  const { dataset, filters, setFilters, resetFilters, filteredTransactions } = useDashboard();
  const [searchValue, setSearchValue] = useState(filters.search);
  const [copied, setCopied] = useState(false);
  const deferredSearch = useDeferredValue(searchValue);
  const last3Months = buildPresetMonths(dataset.availableMonths, 3);
  const last6Months = buildPresetMonths(dataset.availableMonths, 6);
  const last12Months = buildPresetMonths(dataset.availableMonths, 12);

  useEffect(() => {
    setSearchValue(filters.search);
  }, [filters.search]);

  useEffect(() => {
    startTransition(() => {
      setFilters({ search: deferredSearch });
    });
  }, [deferredSearch, setFilters]);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeout = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  const copyCurrentView = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
  };

  return (
    <section className="rounded-[32px] border border-white/50 bg-white/85 p-5 shadow-panel backdrop-blur">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-ink/40">Global Filters</p>
          <p className="mt-2 font-display text-2xl text-ink">
            {formatMonthRangeLabel(filters.startMonth, filters.endMonth)}
          </p>
          <p className="mt-1 text-sm text-ink/60">
            {filteredTransactions.length} transactions in view
          </p>
          <p className="mt-2 text-xs uppercase tracking-[0.22em] text-ink/35">
            Source {dataset.meta.sourceName} · {formatDateLabel(dataset.meta.firstDate)} to{" "}
            {formatDateLabel(dataset.meta.lastDate)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={copyCurrentView}
            className="rounded-full border border-ink/10 px-4 py-2 text-sm font-medium text-ink transition hover:border-moss hover:bg-mist"
          >
            {copied ? "Link copied" : "Copy current view"}
          </button>
          <button
            type="button"
            onClick={resetFilters}
            className="rounded-full border border-ink/10 px-4 py-2 text-sm font-medium text-ink transition hover:border-moss hover:bg-mist"
          >
            Reset filters
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() =>
            setFilters({
              startMonth: dataset.availableMonths[0],
              endMonth: dataset.availableMonths[dataset.availableMonths.length - 1]
            })
          }
          className="rounded-full bg-mist px-3 py-1.5 text-sm text-ink/75 transition hover:bg-sage"
        >
          All time
        </button>
        {last3Months ? (
          <button
            type="button"
            onClick={() => setFilters(last3Months)}
            className="rounded-full bg-mist px-3 py-1.5 text-sm text-ink/75 transition hover:bg-sage"
          >
            Last 3 months
          </button>
        ) : null}
        {last6Months ? (
          <button
            type="button"
            onClick={() => setFilters(last6Months)}
            className="rounded-full bg-mist px-3 py-1.5 text-sm text-ink/75 transition hover:bg-sage"
          >
            Last 6 months
          </button>
        ) : null}
        {last12Months ? (
          <button
            type="button"
            onClick={() => setFilters(last12Months)}
            className="rounded-full bg-mist px-3 py-1.5 text-sm text-ink/75 transition hover:bg-sage"
          >
            Last 12 months
          </button>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <label className="flex flex-col gap-2 text-sm text-ink/60">
          Start month
          <select
            value={filters.startMonth}
            onChange={(event) => setFilters({ startMonth: event.target.value })}
            className="rounded-2xl border border-ink/10 bg-cream px-4 py-3 text-sm text-ink outline-none transition focus:border-moss"
          >
            {dataset.availableMonths.map((month) => (
              <option key={month} value={month}>
                {month}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm text-ink/60">
          End month
          <select
            value={filters.endMonth}
            onChange={(event) => setFilters({ endMonth: event.target.value })}
            className="rounded-2xl border border-ink/10 bg-cream px-4 py-3 text-sm text-ink outline-none transition focus:border-moss"
          >
            {dataset.availableMonths.map((month) => (
              <option key={month} value={month}>
                {month}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm text-ink/60">
          Category
          <select
            value={filters.category}
            onChange={(event) => setFilters({ category: event.target.value })}
            className="rounded-2xl border border-ink/10 bg-cream px-4 py-3 text-sm text-ink outline-none transition focus:border-moss"
          >
            <option value="all">All categories</option>
            {dataset.availableCategories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm text-ink/60">
          Type
          <select
            value={filters.type}
            onChange={(event) =>
              setFilters({
                type: event.target.value as "all" | "expense" | "income"
              })
            }
            className="rounded-2xl border border-ink/10 bg-cream px-4 py-3 text-sm text-ink outline-none transition focus:border-moss"
          >
            <option value="all">Income + expenses</option>
            <option value="expense">Expenses only</option>
            <option value="income">Income only</option>
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm text-ink/60">
          Search
          <input
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Merchant, category, note"
            className="rounded-2xl border border-ink/10 bg-cream px-4 py-3 text-sm text-ink outline-none transition placeholder:text-ink/35 focus:border-moss"
          />
        </label>
      </div>
    </section>
  );
}
