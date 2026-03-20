"use client";

import { useState } from "react";
import type { LogEntry } from "../hooks/useSessionLog";

type LogConsoleProps = {
  entries: LogEntry[];
};

export function LogConsole({ entries }: LogConsoleProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="log-section">
      <button
        className={`log-toggle ${isOpen ? "open" : ""}`}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span className="arrow">&#9654;</span> Log
      </button>
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
