"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function Choice<T extends string>({
  id,
  label,
  items,
  value,
  onChange,
  className = "sm:w-56",
}: Readonly<{
  id: string;
  label: string;
  items: { value: T; label: string }[];
  value: T | "";
  onChange: (value: T) => void;
  className?: string;
}>) {
  return (
    <div className={`flex w-full flex-col gap-1.5 ${className}`}>
      <Label htmlFor={id}>{label}</Label>
      <Select
        items={items}
        value={value || null}
        onValueChange={(next) => next && onChange(next as T)}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
