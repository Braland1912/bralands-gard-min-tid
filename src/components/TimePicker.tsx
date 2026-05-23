import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface TimePickerProps {
  value: string; // "HH:mm" or ""
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** @deprecated native picker styrs av OS — minutsteg ignoreras */
  minuteStep?: number;
}

/**
 * Mobilvänlig tidsväljare: använder native <input type="time">
 * som på iOS/Android öppnar systemets klockhjul.
 */
export function TimePicker({
  value,
  onChange,
  placeholder = "--:--",
  className,
}: TimePickerProps) {
  return (
    <Input
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn("input-datetime h-12 w-full", className)}
    />
  );
}
