import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren
} from "react";

import { filterTransactions } from "@/data/filters";
import type { ExpenseDataset } from "@/data/types";
import {
  buildCategorySummariesForTransactions,
  buildMonthlyForTransactions,
  buildNoteSummariesForTransactions,
  buildRecurringForTransactions,
  buildSpikesForTransactions
} from "@/lib/insights";

export interface DashboardFilters {
  startMonth: string;
  endMonth: string;
  category: string;
  type: "all" | "expense" | "income";
  search: string;
}

interface DashboardContextValue {
  dataset: ExpenseDataset;
  filters: DashboardFilters;
  setFilters: (next: Partial<DashboardFilters>) => void;
  resetFilters: () => void;
  filteredTransactions: ExpenseDataset["transactions"];
  filteredMonthly: ExpenseDataset["monthly"];
  filteredCategories: ExpenseDataset["categories"];
  filteredNotes: ExpenseDataset["notes"];
  filteredRecurring: ExpenseDataset["recurring"];
  filteredSpikes: ExpenseDataset["spikes"];
}

const STORAGE_KEY = "expense-analyzer:filters";
const QUERY_PARAM_KEYS = {
  startMonth: "start",
  endMonth: "end",
  category: "category",
  type: "type",
  search: "q"
} as const;

const DashboardContext = createContext<DashboardContextValue | null>(null);

function createDefaultFilters(dataset: ExpenseDataset): DashboardFilters {
  return {
    startMonth: dataset.availableMonths[0],
    endMonth: dataset.availableMonths[dataset.availableMonths.length - 1],
    category: "all",
    type: "all",
    search: ""
  };
}

function sanitizeFilters(dataset: ExpenseDataset, filters: Partial<DashboardFilters>, fallback: DashboardFilters) {
  const startMonth =
    filters.startMonth && dataset.availableMonths.includes(filters.startMonth)
      ? filters.startMonth
      : fallback.startMonth;
  const endMonth =
    filters.endMonth && dataset.availableMonths.includes(filters.endMonth)
      ? filters.endMonth
      : fallback.endMonth;
  const category =
    filters.category === "all" || dataset.availableCategories.includes(filters.category ?? "")
      ? filters.category ?? fallback.category
      : fallback.category;
  const type =
    filters.type === "expense" || filters.type === "income" || filters.type === "all"
      ? filters.type
      : fallback.type;

  return {
    ...fallback,
    ...filters,
    startMonth,
    endMonth: endMonth < startMonth ? startMonth : endMonth,
    category,
    type,
    search: filters.search ?? fallback.search
  };
}

function filtersToSearchParams(filters: DashboardFilters) {
  const params = new URLSearchParams();

  if (filters.startMonth) {
    params.set(QUERY_PARAM_KEYS.startMonth, filters.startMonth);
  }
  if (filters.endMonth) {
    params.set(QUERY_PARAM_KEYS.endMonth, filters.endMonth);
  }
  if (filters.category !== "all") {
    params.set(QUERY_PARAM_KEYS.category, filters.category);
  }
  if (filters.type !== "all") {
    params.set(QUERY_PARAM_KEYS.type, filters.type);
  }
  if (filters.search.trim()) {
    params.set(QUERY_PARAM_KEYS.search, filters.search.trim());
  }

  return params;
}

function searchParamsToFilters(params: URLSearchParams): Partial<DashboardFilters> {
  return {
    startMonth: params.get(QUERY_PARAM_KEYS.startMonth) ?? undefined,
    endMonth: params.get(QUERY_PARAM_KEYS.endMonth) ?? undefined,
    category: params.get(QUERY_PARAM_KEYS.category) ?? undefined,
    type: (params.get(QUERY_PARAM_KEYS.type) as DashboardFilters["type"] | null) ?? undefined,
    search: params.get(QUERY_PARAM_KEYS.search) ?? undefined
  };
}

export function DashboardProvider({
  dataset,
  children
}: PropsWithChildren<{ dataset: ExpenseDataset }>) {
  const defaults = useMemo(() => createDefaultFilters(dataset), [dataset]);
  const [filters, setFilterState] = useState<DashboardFilters>(defaults);

  const setFilters = useCallback((next: Partial<DashboardFilters>) => {
    setFilterState((current) => {
      const updated = { ...current, ...next };
      if (updated.startMonth > updated.endMonth) {
        return {
          ...updated,
          endMonth: updated.startMonth
        };
      }
      return updated;
    });
  }, []);

  const resetFilters = useCallback(() => {
    setFilterState(defaults);
  }, [defaults]);

  useEffect(() => {
    const defaultFilters = createDefaultFilters(dataset);

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      const storedFilters = stored ? (JSON.parse(stored) as Partial<DashboardFilters>) : {};
      const queryFilters = searchParamsToFilters(new URLSearchParams(window.location.search));
      const merged = sanitizeFilters(dataset, { ...storedFilters, ...queryFilters }, defaultFilters);

      setFilterState(merged);
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
      setFilterState(defaultFilters);
    }
  }, [dataset]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));

    const params = filtersToSearchParams(filters);
    const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    window.history.replaceState({}, "", nextUrl);
  }, [filters]);

  const value = useMemo<DashboardContextValue>(() => {
    const filteredTransactions = filterTransactions(dataset.transactions, filters);
    const filteredMonthKeys = dataset.availableMonths.filter(
      (monthKey) => monthKey >= filters.startMonth && monthKey <= filters.endMonth
    );
    const filteredMonthly = buildMonthlyForTransactions(filteredTransactions, filteredMonthKeys);
    const filteredCategories = buildCategorySummariesForTransactions(
      filteredTransactions,
      filteredMonthly.length
    );
    const filteredNotes = buildNoteSummariesForTransactions(filteredTransactions);
    const filteredRecurring = buildRecurringForTransactions(filteredTransactions);
    const filteredSpikes = buildSpikesForTransactions(filteredTransactions);

    return {
      dataset,
      filters,
      setFilters,
      resetFilters,
      filteredTransactions,
      filteredMonthly,
      filteredCategories,
      filteredNotes,
      filteredRecurring,
      filteredSpikes
    };
  }, [dataset, filters, resetFilters, setFilters]);

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error("useDashboard must be used within DashboardProvider");
  }

  return context;
}
