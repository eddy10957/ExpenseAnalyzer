import type { NarrativeInsight } from "@/lib/learning-engine";

import { formatCurrency } from "@/lib/format";

const severityStyles = {
  positive: "bg-sage/35 text-pine",
  watch: "bg-gold/25 text-ink",
  action: "bg-ember/15 text-ember"
} as const;

const severityLabels = {
  positive: "Working",
  watch: "Watch",
  action: "Act"
} as const;

export function InsightCard({
  insight,
  onFocusCategory
}: {
  insight: NarrativeInsight;
  onFocusCategory?: (category: string) => void;
}) {
  return (
    <article className="rounded-[24px] border border-white/60 bg-gradient-to-br from-white to-mist/55 p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className={`rounded-full px-3 py-1 text-xs font-semibold ${severityStyles[insight.severity]}`}>
          {severityLabels[insight.severity]}
        </div>
        {typeof insight.estimatedMonthlySavings === "number" ? (
          <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink/70">
            About {formatCurrency(insight.estimatedMonthlySavings)}/mo
          </div>
        ) : null}
      </div>

      <h3 className="mt-4 font-display text-2xl text-ink">{insight.title}</h3>
      <p className="mt-3 text-sm leading-6 text-ink/70">{insight.summary}</p>

      <div className="mt-4 rounded-[20px] bg-white/70 px-4 py-3 text-sm text-ink/68">
        <p className="font-medium text-ink">Evidence</p>
        <p className="mt-1">{insight.evidence}</p>
      </div>

      <div className="mt-3 rounded-[20px] bg-cream/80 px-4 py-3 text-sm text-ink/72">
        <p className="font-medium text-ink">Suggested move</p>
        <p className="mt-1">{insight.action}</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {insight.relatedCategory && onFocusCategory ? (
          <button
            type="button"
            onClick={() => onFocusCategory(insight.relatedCategory!)}
            className="rounded-full bg-pine px-3 py-1.5 text-sm text-white transition hover:bg-moss"
          >
            Focus {insight.relatedCategory}
          </button>
        ) : null}
        {insight.relatedMonth ? (
          <div className="rounded-full bg-mist px-3 py-1.5 text-sm text-ink/70">
            Month {insight.relatedMonth}
          </div>
        ) : null}
      </div>
    </article>
  );
}
