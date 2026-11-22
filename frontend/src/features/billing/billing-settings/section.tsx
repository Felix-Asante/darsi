import type { ReactNode } from "react";

export function Section({
  id,
  title,
  description,
  children,
}: Readonly<{
  id: string;
  title: string;
  description: string;
  children: ReactNode;
}>) {
  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id={`${id}-title`} className="text-lg font-semibold tracking-tight">
          {title}
        </h2>
        <p className="text-muted-foreground max-w-prose text-sm">
          {description}
        </p>
      </div>
      {children}
    </section>
  );
}
