"use client";

import { useState } from "react";

type TranscriptDisplayProps = {
  finalText: string;
  partialText: string;
  onClear: () => void;
};

export function TranscriptDisplay({
  finalText,
  partialText,
  onClear,
}: TranscriptDisplayProps) {
  const [copied, setCopied] = useState(false);
  const fullText = (finalText + (partialText ? " " + partialText : "")).trim();

  const handleCopy = () => {
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-4 max-h-[400px] min-h-[120px] overflow-y-auto rounded-lg border border-border bg-secondary p-4">
      <div className="mb-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
        Transcript
      </div>
      {!finalText && !partialText ? (
        <div className="text-sm italic text-muted-foreground">
          Waiting for audio...
        </div>
      ) : (
        <p className="m-0 text-base leading-relaxed">
          {finalText && <span className="text-foreground">{finalText}</span>}
          {partialText && (
            <span className="italic text-muted-foreground"> {partialText}</span>
          )}
        </p>
      )}
      {fullText && (
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
          <button
            type="button"
            onClick={onClear}
            className="rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
