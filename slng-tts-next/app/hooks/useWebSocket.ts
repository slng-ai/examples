import { useCallback, useRef, useState } from "react";

type WsCallbacks = {
  onJsonMessage: (payload: Record<string, unknown>) => void;
  onBinaryMessage: (data: ArrayBuffer) => void;
  onLog: (message: string) => void;
  onStatusChange: (message: string, isError?: boolean) => void;
};

export function useWebSocket(callbacks: WsCallbacks) {
  const [isConnected, setIsConnected] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    setIsReady(false);
    setIsConnected(false);
  }, []);

  const connect = useCallback(
    (options: {
      wsUrl: string;
      apiKey: string;
      useProxy: boolean;
      proxyUrl: string;
      initMessage: string;
    }) => {
      const { wsUrl, apiKey, useProxy, proxyUrl, initMessage } = options;
      const targetUrl = useProxy ? proxyUrl : wsUrl;

      callbacksRef.current.onLog(`Connecting to ${targetUrl}`);
      callbacksRef.current.onStatusChange("Connecting...");

      const ws = new WebSocket(targetUrl);
      ws.binaryType = "arraybuffer";
      socketRef.current = ws;
      setIsConnected(true);

      ws.addEventListener("open", () => {
        callbacksRef.current.onLog("WebSocket open. Sending init.");

        if (useProxy) {
          const envelope = JSON.stringify({ api_key: apiKey, target: wsUrl });
          ws.send(envelope);
        }

        if (initMessage) {
          ws.send(initMessage);
        }

        callbacksRef.current.onStatusChange("Connected. Waiting for ready...");
      });

      ws.addEventListener("message", (event) => {
        if (typeof event.data === "string") {
          callbacksRef.current.onLog(`Message: ${event.data}`);
          try {
            const payload = JSON.parse(event.data) as Record<string, unknown>;

            const type = (payload.type as string)?.toLowerCase();
            if (type === "metadata" || type === "ready") {
              setIsReady(true);
              callbacksRef.current.onStatusChange("Ready to send text.");
            }

            callbacksRef.current.onJsonMessage(payload);

            if (payload.is_final) {
              callbacksRef.current.onLog("Received final marker.");
            }
          } catch {
            callbacksRef.current.onStatusChange(event.data);
          }
          return;
        }

        callbacksRef.current.onLog("Binary audio chunk received.");
        callbacksRef.current.onBinaryMessage(event.data as ArrayBuffer);
      });

      ws.addEventListener("close", () => {
        callbacksRef.current.onLog("WebSocket closed.");
        callbacksRef.current.onStatusChange("Disconnected.");
        setIsReady(false);
        setIsConnected(false);
        socketRef.current = null;
      });

      ws.addEventListener("error", () => {
        callbacksRef.current.onStatusChange(
          "WebSocket error. Check the log for details.",
          true
        );
        callbacksRef.current.onLog("WebSocket error.");
      });
    },
    []
  );

  const sendPayload = useCallback(
    (payload: string, flushMessage: string) => {
      const ws = socketRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(payload);
      ws.send(flushMessage);
    },
    []
  );

  return { connect, disconnect, sendPayload, isConnected, isReady };
}
