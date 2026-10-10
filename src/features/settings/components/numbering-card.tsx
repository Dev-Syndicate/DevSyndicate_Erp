"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DOC_TYPES,
  numberingError,
  RESETS,
  renderNumber,
  TOKENS,
  type DocType,
  type Reset,
} from "@/features/settings/numbering";

type Row = { doc_type: string; pattern: string; padding: number; reset: string; next_value: number };

const GRID = "grid gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-[9rem_minmax(12rem,1fr)_5.5rem_11rem_7rem_minmax(11rem,1fr)] lg:items-center";

function NumberingRow({ docType, label, initial, errors }: { docType: DocType; label: string; initial?: Row; errors: Record<string, string> }) {
  const [rawPattern, setPattern] = useState(initial?.pattern ?? "");
  // Keep the raw text in state (rewriting it while typing moves the cursor); CSS shows it upper-cased.
  const pattern = rawPattern.toUpperCase();
  const [padding, setPadding] = useState(initial?.padding ?? 4);
  const [reset, setReset] = useState<Reset>((initial?.reset as Reset) ?? "financial_year");
  const [next, setNext] = useState(String(initial?.next_value ?? 1));
  const id = (field: string) => `num_${docType}_${field}`;
  const error = errors[id("pattern")] ?? errors[id("next")] ?? numberingError(docType, pattern, padding, reset);
  const seq = Number.parseInt(next, 10);

  return (
    <div className={`${GRID} border-t py-4`}>
      <div className="font-medium sm:col-span-2 lg:col-span-1">{label}</div>
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor={id("pattern")} className="lg:sr-only">Format</FieldLabel>
        <Input
          id={id("pattern")}
          name={id("pattern")}
          value={rawPattern}
          onChange={(e) => setPattern(e.target.value)}
          maxLength={30}
          aria-invalid={!!error}
          aria-describedby={id("preview")}
          className="font-mono uppercase"
          spellCheck={false}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor={id("padding")} className="lg:sr-only">Digits</FieldLabel>
        <Select name={id("padding")} value={String(padding)} onValueChange={(v) => setPadding(Number(v))}>
          <SelectTrigger id={id("padding")} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor={id("reset")} className="lg:sr-only">Resets</FieldLabel>
        <Select name={id("reset")} value={reset} onValueChange={(v) => setReset(v as Reset)}>
          <SelectTrigger id={id("reset")} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RESETS.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor={id("next")} className="lg:sr-only">Next number</FieldLabel>
        <Input
          id={id("next")}
          name={id("next")}
          type="number"
          min={1}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          className="tabular-nums"
        />
      </div>
      <div id={id("preview")} aria-live="polite" className="font-mono text-sm sm:col-span-2 lg:col-span-1">
        {error ? (
          <FieldError>{error}</FieldError>
        ) : (
          <span className="text-foreground">{renderNumber(pattern, padding, seq >= 1 ? seq : 1, new Date())}</span>
        )}
      </div>
    </div>
  );
}

export function NumberingCard({ rows, errors }: { rows: Row[]; errors: Record<string, string> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Document numbering</CardTitle>
        <CardDescription>
          Numbers are assigned when a document is issued, never skip, and can restart each year. Next number lets you
          continue from your existing records.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm">
        <div className={`${GRID} hidden pb-2 text-muted-foreground lg:grid`}>
          <span>Document</span>
          <span>Format</span>
          <span>Digits</span>
          <span>Resets</span>
          <span>Next number</span>
          <span>Next document gets</span>
        </div>
        {DOC_TYPES.map(({ type, label }) => (
          <NumberingRow
            key={type}
            docType={type}
            label={label}
            initial={rows.find((r) => r.doc_type === type)}
            errors={errors}
          />
        ))}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-4 text-muted-foreground">
          <span>Format tokens:</span>
          {TOKENS.map((t) => (
            <span key={t.token} className="flex items-center gap-1.5">
              <Badge variant="outline" className="font-mono">
                {t.token}
              </Badge>
              {t.meaning}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
