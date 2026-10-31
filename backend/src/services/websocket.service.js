import { WebSocketServer } from "ws";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

let wssInstance = null;

export const initWebSocketServer = (httpServer) => {
  const wss = new WebSocketServer({
    server: httpServer,
    path: "/api/v1/ws",
  });

  wss.on("connection", (ws, req) => {
    // Authenticate WS connection via query token or cookie
    try {
      const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      const token = url.searchParams.get("token") || req.headers.cookie?.match(/token=([^;]+)/)?.[1];
      if (token) {
        const decoded = jwt.verify(token, env.jwtSecret);
        ws.userId = decoded.userId || decoded.id;
      }
    } catch {
      // Allow unauthenticated connection or reject if strict
    }

    ws.isAlive = true;
    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === "ping") {
          ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
        }
      } catch {
        // ignore malformed
      }
    });

    // Send connection welcome
    ws.send(JSON.stringify({
      type: "connected",
      message: "Console Realtime Feed connected",
      timestamp: Date.now(),
    }));
  });

  // Heartbeat ping-pong to clean up dead sockets
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on("close", () => clearInterval(interval));

  wssInstance = wss;
  return wss;
};

export const broadcastMarketUpdate = (payload) => {
  if (!wssInstance) return;
  const message = JSON.stringify({
    type: "market_update",
    payload,
    timestamp: Date.now(),
  });

  wssInstance.clients.forEach((client) => {
    if (client.readyState === 1) { // 1 === WebSocket.OPEN
      client.send(message);
    }
  });
};
