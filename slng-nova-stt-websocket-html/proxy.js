const http = require("http");
const { WebSocketServer, WebSocket } = require("ws");

const PORT = Number(process.env.PORT) || 8787;

const server = http.createServer();
const wss = new WebSocketServer({ server });

function closeSocket(socket, code, reason) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.close(code, reason);
  }
}

wss.on("connection", (client) => {
  let upstream = null;
  let upstreamReady = false;
  let initialized = false;
  const pending = [];

  function flushPending() {
    while (pending.length > 0 && upstreamReady) {
      const { data, isBinary } = pending.shift();
      upstream.send(data, { binary: isBinary });
    }
  }

  function connectUpstream(target, apiKey) {
    upstream = new WebSocket(target, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    upstream.on("open", () => {
      upstreamReady = true;
      flushPending();
    });

    upstream.on("message", (data, isBinary) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data, { binary: isBinary });
      }
    });

    upstream.on("close", (code, reason) => {
      closeSocket(client, code, reason.toString());
    });

    upstream.on("error", () => {
      closeSocket(client, 1011, "Upstream error");
    });
  }

  client.on("message", (data, isBinary) => {
    if (!initialized) {
      if (isBinary) {
        closeSocket(client, 1008, "Expected JSON envelope");
        return;
      }

      let envelope = null;
      try {
        envelope = JSON.parse(data.toString());
      } catch {
        closeSocket(client, 1008, "Invalid JSON envelope");
        return;
      }

      const apiKey = envelope.api_key || envelope.apiKey;
      const target = envelope.target;
      if (!apiKey || !target) {
        closeSocket(client, 1008, "Missing api_key or target");
        return;
      }

      initialized = true;
      connectUpstream(target, apiKey);

      if (envelope.payload) {
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
    if (upstream) {
      upstream.close();
    }
  });

  client.on("error", () => {
    if (upstream) {
      upstream.close();
    }
  });
});

server.listen(PORT, () => {
  console.log(`WebSocket proxy listening on ws://localhost:${PORT}`);
});
