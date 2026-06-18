"use client";

import { useState } from "react";
import { ChevronRight, Trash2 } from "lucide-react";
import { cn } from "./ui/lib/utils";
import type { LogEntry } from "../hooks/useSessionLog";

type LogConsoleProps = {
  entries: LogEntry[];
  onClear?: () => void;
};

export function LogConsole({ entries, onClear }: LogConsoleProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mt-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => setIsOpen((prev) => !prev)}
        >
          <ChevronRight
            className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-90")}
          />
          Log
        </button>
        {isOpen && entries.length > 0 && onClear && (
          <button
            type="button"
            onClick={onClear}
            title="Clear logs"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {isOpen && (
        <div className="mt-1.5 max-h-40 overflow-y-auto whitespace-pre-wrap break-all rounded-md border border-border bg-secondary p-3 font-mono text-xs text-muted-foreground">
          {entries.map((entry, i) => (
            <div key={i}>
              {entry.timestamp} {entry.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
