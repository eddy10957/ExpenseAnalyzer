import type { ReactNode } from "react";

export function MetricCard({
  label,
  value,
  hint,
  accent
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: ReactNode;
}) {
  return (
    <article className="rounded-[26px] border border-white/60 bg-gradient-to-br from-white to-mist/60 p-5 shadow-soft">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm uppercase tracking-[0.18em] text-ink/45">{label}</p>
        {accent}
      </div>
      <p className="mt-4 font-display text-3xl text-ink">{value}</p>
      {hint ? <p className="mt-2 text-sm text-ink/60">{hint}</p> : null}
    </article>
  );
}
