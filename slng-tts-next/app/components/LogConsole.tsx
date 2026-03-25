"use client";

import { useState } from "react";
import type { LogEntry } from "../hooks/useSessionLog";

type LogConsoleProps = {
  entries: LogEntry[];
  onClear?: () => void;
};

export function LogConsole({ entries, onClear }: LogConsoleProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="log-section">
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          className={`log-toggle ${isOpen ? "open" : ""}`}
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
        >
          <span className="arrow">&#9654;</span> Log
        </button>
        {isOpen && entries.length > 0 && onClear && (
          <button
            type="button"
            onClick={onClear}
            title="Clear logs"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 2,
              lineHeight: 1,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--foreground, #333)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </button>
        )}
      </div>
      <div className={`log ${isOpen ? "open" : ""}`}>
        {entries.map((entry, i) => (
          <div key={i}>
            {entry.timestamp} {entry.message}
          </div>
        ))}
      </div>
    </div>
  );
}
