import { Worker } from "bullmq";
import { env } from "../config/env.js";
import { createRedisConnection } from "../config/redis.js";
import { syncFyersNseFoInstruments } from "../services/instrument.service.js";

export const startInstrumentSyncWorker = () => {
  const worker = new Worker(
    `${env.orderQueue.name}-instrument-sync`,
    (job) => syncFyersNseFoInstruments({
      onProgress: (progress) => job.updateProgress(progress),
    }),
    { connection: createRedisConnection(), concurrency: 1 },
  );

  worker.on("ready", () => console.log("Fyers instrument sync worker ready"));
  worker.on("failed", (job, error) => {
    console.error(`Fyers instrument sync ${job?.id || "unknown"} failed`, error);
  });

  return worker;
};