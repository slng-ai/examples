import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";

const PORT = Number(process.env.PORT) || 8787;

const server = http.createServer();
const wss = new WebSocketServer({ server });

function isValidCloseCode(code: number): boolean {
  // WebSocket spec: 1000, 1001, 1002, 1003, 1007-1011, 1012-1014, 3000-4999.
  if (code === 1000 || code === 1001 || code === 1002 || code === 1003) return true;
  if (code >= 1007 && code <= 1014) return true;
  if (code >= 3000 && code <= 4999) return true;
  return false;
}

function closeSocket(socket: WebSocket, code: number, reason: string) {
  if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
    const safeCode = isValidCloseCode(code) ? code : 1011;
    socket.close(safeCode, reason.slice(0, 120));
  }
}

wss.on("connection", (client) => {
  let upstream: WebSocket | null = null;
  let upstreamReady = false;
  let initialized = false;
  const pending: Array<{ data: unknown; isBinary: boolean }> = [];

  function flushPending() {
    while (pending.length > 0 && upstreamReady && upstream) {
      const { data, isBinary } = pending.shift()!;
      upstream.send(data as Buffer, { binary: isBinary });
    }
  }

  function connectUpstream(target: string, apiKey: string) {
    console.log(`[proxy] upstream connect → ${target}`);
    upstream = new WebSocket(target, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    upstream.on("open", () => {
      console.log(`[proxy] upstream open ← ${target}`);
      upstreamReady = true;
      flushPending();
    });

    upstream.on("unexpected-response", (_req, res) => {
      console.log(`[proxy] upstream unexpected-response status=${res.statusCode}`);
      let body = "";
      res.on("data", (c: Buffer) => (body += c.toString()));
      res.on("end", () => {
        const detail = body.slice(0, 200);
        console.log(`[proxy] upstream body: ${detail}`);
        closeSocket(client, 1011, `Upstream HTTP ${res.statusCode}: ${detail}`);
      });
    });

    upstream.on("message", (data: Buffer, isBinary: boolean) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data, { binary: isBinary });
      }
    });

    upstream.on("close", (code: number, reason: Buffer) => {
      const reasonText = reason.toString();
      console.log(`[proxy] upstream close code=${code} reason="${reasonText}"`);
      closeSocket(client, code, reasonText || `Upstream closed (${code})`);
    });

    upstream.on("error", (err: Error) => {
      console.log(`[proxy] upstream error: ${err.message}`);
      closeSocket(client, 1011, `Upstream error: ${err.message}`);
    });
  }

  client.on("message", (data: Buffer, isBinary: boolean) => {
    if (!initialized) {
      if (isBinary) {
        closeSocket(client, 1008, "Expected JSON envelope");
        return;
      }

      let envelope: { api_key?: string; apiKey?: string; target?: string; payload?: string } | null =
        null;
      try {
        envelope = JSON.parse(data.toString());
      } catch {
        closeSocket(client, 1008, "Invalid JSON envelope");
        return;
      }

      const apiKey = envelope?.api_key || envelope?.apiKey;
      const target = envelope?.target;
      if (!apiKey || !target) {
        closeSocket(client, 1008, "Missing api_key or target");
        return;
      }

      initialized = true;
      connectUpstream(target, apiKey);

      if (envelope?.payload) {
        pending.push({ data: envelope.payload, isBinary: false });
      }
      return;
    }

    if (!upstream) {
      pending.push({ data, isBinary });
      return;
    }

    if (upstreamReady) {
      upstream.send(data, { binary: isBinary });
    } else {
      pending.push({ data, isBinary });
    }
  });

  client.on("close", () => {
    if (upstream) upstream.close();
  });

  client.on("error", () => {
    if (upstream) upstream.close();
  });
});

const HOST = process.env.HOST || "0.0.0.0";

server.listen(PORT, HOST, () => {
  console.log(`WebSocket proxy listening on ws://${HOST}:${PORT}`);
});
