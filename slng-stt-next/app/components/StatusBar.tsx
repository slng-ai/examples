"use client";

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
  let barClass = "status-bar";
  if (isError) {
    barClass += " error";
  } else if (isReady) {
    barClass += " ready";
  } else if (isConnected) {
    barClass += " connected";
  }

  return (
    <div className={barClass}>
      <span className="status-dot" />
      <span>{status}</span>
    </div>
  );
}
