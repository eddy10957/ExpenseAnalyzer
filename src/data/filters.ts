import type { Transaction, TransactionType } from "@/data/types";

export function filterTransactions(
  transactions: Transaction[],
  filters: {
    startMonth: string;
    endMonth: string;
    category: string;
    type: "all" | Lowercase<TransactionType>;
    search: string;
  }
) {
  const searchTerm = filters.search.trim().toLowerCase();

  return transactions.filter((transaction) => {
    if (transaction.monthKey < filters.startMonth || transaction.monthKey > filters.endMonth) {
      return false;
    }

    if (filters.category !== "all" && transaction.category !== filters.category) {
      return false;
    }

    if (filters.type !== "all" && transaction.type.toLowerCase() !== filters.type) {
      return false;
    }

    if (!searchTerm) {
      return true;
    }

    return (
      transaction.note.toLowerCase().includes(searchTerm) ||
      transaction.category.toLowerCase().includes(searchTerm)
    );
  });
}
