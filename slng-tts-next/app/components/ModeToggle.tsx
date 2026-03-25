"use client";

type ModeToggleProps = {
  currentMode: "rest" | "websocket";
  onModeChange: (mode: "rest" | "websocket") => void;
  disableRest?: boolean;
};

export function ModeToggle({ currentMode, onModeChange, disableRest }: ModeToggleProps) {
  return (
    <div className="mode-toggle">
      <button
        type="button"
        className={currentMode === "rest" ? "active" : ""}
        onClick={() => onModeChange("rest")}
        disabled={disableRest}
        title={disableRest ? "This model supports WebSocket only" : undefined}
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
