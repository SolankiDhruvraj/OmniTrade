import app from "./app.js";
import { connectDB } from "./src/config/db.js";
import { env } from "./src/config/env.js";
import { disconnectKafkaProducer } from "./src/events/kafkaProducer.js";
import { closeOrderQueue } from "./src/queues/order.queue.js";
import { closeInstrumentSyncQueue } from "./src/queues/instrumentSync.queue.js";
import { startOrderWorker } from "./src/workers/order.worker.js";
import { startInstrumentSyncWorker } from "./src/workers/instrumentSync.worker.js";
import { initWebSocketServer } from "./src/services/websocket.service.js";

let orderWorker = null;
let instrumentSyncWorker = null;
let server = null;
let wss = null;

const shutdown = async () => {
  console.log("Shutting down");
  await Promise.allSettled([
    orderWorker?.close(),
    instrumentSyncWorker?.close(),
    closeOrderQueue(),
    closeInstrumentSyncQueue(),
    disconnectKafkaProducer(),
  ]);
  server?.close(() => process.exit(0));
};

connectDB()
  .then(() => {
    orderWorker = startOrderWorker();
    instrumentSyncWorker = startInstrumentSyncWorker();
    server = app.listen(env.port, () => {
      console.log(`Listening at PORT ${env.port}`);
    });
    wss = initWebSocketServer(server);
  })
  .catch((error) => {
    console.error("Failed to start server", error);
    process.exit(1);
  });

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
