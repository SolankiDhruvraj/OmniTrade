import { Queue } from "bullmq";
import { env } from "../config/env.js";
import { createRedisConnection } from "../config/redis.js";

export const orderQueue = new Queue(env.orderQueue.name, {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: env.orderQueue.attempts,
    backoff: {
      type: "fixed",
      delay: env.orderQueue.backoffMs,
    },
    removeOnComplete: false,
    removeOnFail: false,
  },
});

export const addOrderExecutionJobs = async (executions) => {
  if (executions.length === 0) return [];

  return orderQueue.addBulk(executions.map((execution) => ({
    name: "place-order",
    data: {
      executionId: String(execution._id),
      batchId: String(execution.batch),
      brokerAccountId: String(execution.brokerAccount),
      orders: execution.preloadedOrders || null,
      credentials: execution.preloadedCredentials || null,
    },
    opts: {
      // Deterministic JobId ensures BullMQ never executes duplicates for the same batch and account
      jobId: `${execution.batch}:${execution.brokerAccount}`,
    },
  })));
};

export const closeOrderQueue = async () => {
  await orderQueue.close();
};
