"use client";

import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";

type ModeToggleProps = {
  currentMode: "rest" | "websocket";
  onModeChange: (mode: "rest" | "websocket") => void;
  disableRest?: boolean;
};

export function ModeToggle({ currentMode, onModeChange, disableRest }: ModeToggleProps) {
  return (
    <Tabs
      value={currentMode}
      onValueChange={(v) => onModeChange(v as "rest" | "websocket")}
    >
      <TabsList>
        <TabsTrigger
          value="rest"
          disabled={disableRest}
          title={disableRest ? "This model supports WebSocket only" : undefined}
        >
          REST
        </TabsTrigger>
        <TabsTrigger value="websocket">WebSocket</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
