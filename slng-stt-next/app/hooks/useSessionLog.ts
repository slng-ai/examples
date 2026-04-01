import { useCallback, useState } from "react";

export type LogEntry = {
  timestamp: string;
  message: string;
};

export function useSessionLog() {
  const [entries, setEntries] = useState<LogEntry[]>([]);

  const appendLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setEntries((prev) => [{ timestamp, message }, ...prev]);
  }, []);

  const clearLog = useCallback(() => {
    setEntries([]);
  }, []);

  return { entries, appendLog, clearLog };
}
