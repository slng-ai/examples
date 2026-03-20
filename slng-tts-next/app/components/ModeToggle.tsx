"use client";

type ModeToggleProps = {
  currentMode: "rest" | "websocket";
  onModeChange: (mode: "rest" | "websocket") => void;
};

export function ModeToggle({ currentMode, onModeChange }: ModeToggleProps) {
  return (
    <div className="mode-toggle">
      <button
        type="button"
        className={currentMode === "rest" ? "active" : ""}
        onClick={() => onModeChange("rest")}
      >
        REST
      </button>
      <button
        type="button"
        className={currentMode === "websocket" ? "active" : ""}
        onClick={() => onModeChange("websocket")}
      >
        WebSocket
      </button>
    </div>
  );
}
