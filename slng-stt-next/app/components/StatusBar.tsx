"use client";

import { cn } from "./ui/lib/utils";

type StatusBarProps = {
  status: string;
  isError: boolean;
  isConnected: boolean;
  isReady: boolean;
};

export function StatusBar({
  status,
  isError,
  isConnected,
  isReady,
}: StatusBarProps) {
  return (
    <div
      className={cn(
        "mt-4 flex items-center gap-2 rounded-md px-3 py-2 text-sm",
        isError
          ? "bg-destructive/10 text-destructive"
          : "bg-secondary text-muted-foreground"
      )}
    >
      <span
        className={cn(
          "h-2 w-2 shrink-0 rounded-full",
          isError
            ? "bg-destructive"
            : isReady
              ? "bg-brand-yellow animate-slng-pulse"
              : isConnected
                ? "bg-brand-yellow"
                : "bg-border"
        )}
      />
      <span>{status}</span>
    </div>
  );
}
