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
    <div className="transcript-wrap">
      <div className="transcript-label">Transcript</div>
      {!finalText && !partialText ? (
        <div className="transcript-empty">
          Waiting for audio...
        </div>
      ) : (
        <>
          {finalText && <span className="transcript-final">{finalText}</span>}
          {partialText && (
            <span className="transcript-partial"> {partialText}</span>
          )}
        </>
      )}
      {fullText && (
        <div className="transcript-actions">
          <button type="button" onClick={handleCopy}>
            {copied ? "Copied!" : "Copy"}
          </button>
          <button type="button" onClick={onClear}>
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
