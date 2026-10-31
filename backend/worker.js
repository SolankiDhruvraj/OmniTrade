import { connectDB } from "./src/config/db.js";
import { disconnectKafkaProducer } from "./src/events/kafkaProducer.js";
import { closeOrderQueue } from "./src/queues/order.queue.js";
import { startOrderWorker } from "./src/workers/order.worker.js";

let worker = null;

const shutdown = async () => {
  console.log("Shutting down worker");
  await Promise.allSettled([
    worker?.close(),
    closeOrderQueue(),
    disconnectKafkaProducer(),
  ]);
  process.exit(0);
};

connectDB()
  .then(() => {
    worker = startOrderWorker();
  })
  .catch((error) => {
    console.error("Failed to start worker", error);
    process.exit(1);
  });

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
