const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0
});

const currencyPreciseFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2
});

const percentFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1
});

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1
});

export function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

export function formatCurrencyPrecise(value: number) {
  return currencyPreciseFormatter.format(value);
}

export function formatPercent(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "n/a";
  }

  return percentFormatter.format(value);
}

export function formatNumber(value: number) {
  return numberFormatter.format(value);
}

export function formatMonthRangeLabel(startMonth: string, endMonth: string) {
  const [startYear, startMonthNumber] = startMonth.split("-").map(Number);
  const [endYear, endMonthNumber] = endMonth.split("-").map(Number);

  const startLabel = new Date(Date.UTC(startYear, startMonthNumber - 1, 1)).toLocaleString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  });
  const endLabel = new Date(Date.UTC(endYear, endMonthNumber - 1, 1)).toLocaleString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  });

  return startMonth === endMonth ? startLabel : `${startLabel} - ${endLabel}`;
}

export function formatDateLabel(date: string) {
  if (!date) {
    return "n/a";
  }

  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  });
}
