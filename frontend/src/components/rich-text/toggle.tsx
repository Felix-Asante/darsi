import { Button } from "@/components/ui/button";

export function Toggle({
  label,
  pressed,
  onClick,
  children,
}: Readonly<{ label: string; pressed?: boolean; onClick: () => void; children: React.ReactNode }>) {
  return (
    <Button
      type="button"
      variant={pressed ? "secondary" : "ghost"}
      size="icon-sm"
      aria-label={label}
      aria-pressed={pressed ?? false}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
