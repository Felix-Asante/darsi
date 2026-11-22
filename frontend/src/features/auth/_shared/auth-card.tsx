export function AuthCard({
  title,
  description,
  children,
  footer,
}: Readonly<{
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}>) {
  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <div className="bg-card flex flex-col gap-6 rounded-xl border p-6 shadow-xs sm:p-8">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {description && (
            <p className="text-muted-foreground text-sm">{description}</p>
          )}
        </div>
        {children}
      </div>
      {footer && (
        <div className="text-muted-foreground text-center text-sm">
          {footer}
        </div>
      )}
    </div>
  );
}
