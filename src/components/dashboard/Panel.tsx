import type { PropsWithChildren, ReactNode } from "react";

import clsx from "clsx";

export function Panel({
  title,
  description,
  actions,
  className,
  children
}: PropsWithChildren<{
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}>) {
  return (
    <section
      className={clsx(
        "rounded-[28px] border border-white/50 bg-white/85 p-5 shadow-soft backdrop-blur",
        className
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="font-display text-xl text-ink">{title}</p>
          {description ? <p className="mt-1 text-sm text-ink/60">{description}</p> : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}
