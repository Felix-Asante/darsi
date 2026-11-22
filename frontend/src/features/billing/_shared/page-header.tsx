import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: Readonly<{ title: string; description?: string; actions?: ReactNode }>) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="text-muted-foreground max-w-prose text-sm">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
