"use client";

import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

type Props = {
  id?: string;
  /** Posts the value as YYYY-MM-DD in a hidden input (FormData / GET forms). */
  name?: string;
  /** Controlled value, YYYY-MM-DD ("" = none). */
  value?: string;
  /** Uncontrolled initial value. */
  defaultValue?: string;
  onChange?: (value: string) => void;
  min?: string;
  max?: string;
  /** Shows a Clear button for optional dates. */
  clearable?: boolean;
  placeholder?: string;
  className?: string;
  "aria-invalid"?: boolean;
};

// Business dates are YYYY-MM-DD strings (PRD §8); the calendar works in local Dates at midnight.
const toDate = (s?: string) => {
  if (!s) return undefined;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const toIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** shadcn date picker (Popover + Calendar) used for every date field. */
export function DatePicker({ id, name, value, defaultValue = "", onChange, min, max, clearable, placeholder = "Pick a date", className, ...rest }: Props) {
  const [inner, setInner] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const current = value ?? inner;
  const selected = toDate(current);
  const disabled = [min && { before: toDate(min)! }, max && { after: toDate(max)! }].filter((m) => !!m);

  function pick(next: string) {
    setInner(next);
    onChange?.(next);
    setOpen(false);
  }

  return (
    <>
      {name && <input type="hidden" name={name} value={current} />}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            aria-invalid={rest["aria-invalid"]}
            className={cn("w-full justify-start font-normal tabular-nums", !current && "text-muted-foreground", className)}
          >
            <CalendarIcon />
            {current ? formatDate(current) : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected ?? toDate(max)}
            onSelect={(d) => d && pick(toIso(d))}
            disabled={disabled}
            captionLayout="dropdown"
            startMonth={new Date(2020, 0)}
            endMonth={new Date(new Date().getFullYear() + 5, 11)}
          />
          {clearable && current && (
            <div className="border-t p-2">
              <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => pick("")}>
                Clear
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </>
  );
}
