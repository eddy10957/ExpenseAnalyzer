import { useMemo, useState } from "react";

import type { Transaction } from "@/data/types";
import { formatCurrencyPrecise, formatDateLabel } from "@/lib/format";

type SortMode = "latest" | "largest" | "smallest";

export function TransactionTable({
  title,
  description,
  transactions,
  defaultSort = "latest",
  limit
}: {
  title: string;
  description?: string;
  transactions: Transaction[];
  defaultSort?: SortMode;
  limit?: number;
}) {
  const [sortMode, setSortMode] = useState<SortMode>(defaultSort);
  const rows = useMemo(() => {
    const sorted = [...transactions].sort((left, right) => {
      if (sortMode === "largest") {
        return right.amount - left.amount;
      }
      if (sortMode === "smallest") {
        return left.amount - right.amount;
      }
      return right.date.localeCompare(left.date);
    });
    return limit ? sorted.slice(0, limit) : sorted;
  }, [limit, sortMode, transactions]);

  return (
    <div className="overflow-hidden rounded-[24px] border border-ink/8 bg-cream/70">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/8 px-4 py-3">
        <div>
          <p className="font-display text-lg text-ink">{title}</p>
          {description ? <p className="text-sm text-ink/60">{description}</p> : null}
        </div>
        <select
          value={sortMode}
          onChange={(event) => setSortMode(event.target.value as SortMode)}
          className="rounded-full border border-ink/10 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-moss"
        >
          <option value="latest">Latest first</option>
          <option value="largest">Largest amount</option>
          <option value="smallest">Smallest amount</option>
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-ink/8 text-left text-sm">
          <thead className="bg-white/70 text-ink/55">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Note</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/6 text-ink">
            {rows.map((transaction) => (
              <tr key={transaction.id} className="hover:bg-white/80">
                <td className="whitespace-nowrap px-4 py-3 text-ink/65">
                  {formatDateLabel(transaction.date)}
                </td>
                <td className="px-4 py-3">{transaction.note}</td>
                <td className="px-4 py-3 text-ink/75">{transaction.category}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      transaction.type === "Expense"
                        ? "bg-ember/15 text-ember"
                        : "bg-sage/30 text-pine"
                    }`}
                  >
                    {transaction.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-medium">
                  {formatCurrencyPrecise(transaction.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-ink/55">
          No transactions match the current filters.
        </div>
      ) : null}
    </div>
  );
}
