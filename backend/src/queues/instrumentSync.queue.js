import { Queue } from "bullmq";
import { env } from "../config/env.js";
import { createRedisConnection } from "../config/redis.js";

const queueName = `${env.orderQueue.name}-instrument-sync`;

export const instrumentSyncQueue = new Queue(queueName, {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { age: 60 * 60, count: 50 },
    removeOnFail: { age: 24 * 60 * 60, count: 50 },
  },
});

export const enqueueFyersInstrumentSync = async () => {
  const jobId = "fyers-symbol-master-sync";
  const existingJob = await instrumentSyncQueue.getJob(jobId);

  if (existingJob) {
    const state = await existingJob.getState();
    if (["waiting", "active", "delayed"].includes(state)) return existingJob;
    await existingJob.remove();
  }

  return instrumentSyncQueue.add("sync-fyers-symbol-master", {}, { jobId });
};

export const closeInstrumentSyncQueue = async () => {
  await instrumentSyncQueue.close();
};