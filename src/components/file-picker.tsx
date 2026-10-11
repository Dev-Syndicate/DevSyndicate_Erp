"use client";

import { useRef, useState } from "react";
import { FileText, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  id?: string;
  /** Posts the file with the surrounding form (FormData). */
  name?: string;
  accept: string;
  required?: boolean;
  disabled?: boolean;
  /** Shown until a file is chosen. */
  placeholder?: string;
  onChange?: (file: File | null) => void;
  className?: string;
};

/** Styled single-file picker replacing the browser's "Choose File / No file chosen" control. */
export function FilePicker({ id, name, accept, required, disabled, placeholder = "No file chosen", onChange, className }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);

  function choose(next: File | null) {
    setFile(next);
    onChange?.(next);
  }

  return (
    <div className={cn("flex min-w-0 items-center gap-3 rounded-lg border border-dashed p-2", className)}>
      {/* sr-only (not display:none) so the browser can still flag a required file. */}
      <input
        ref={input}
        id={id}
        name={name}
        type="file"
        accept={accept}
        required={required}
        disabled={disabled}
        className="sr-only"
        onChange={(e) => choose(e.target.files?.[0] ?? null)}
      />
      <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => input.current?.click()}>
        <Upload /> Choose file
      </Button>
      {file ? (
        <>
          <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{Math.ceil(file.size / 1024)} KB</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Remove ${file.name}`}
            disabled={disabled}
            onClick={() => {
              if (input.current) input.current.value = "";
              choose(null);
            }}
          >
            <X />
          </Button>
        </>
      ) : (
        <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{placeholder}</span>
      )}
    </div>
  );
}
