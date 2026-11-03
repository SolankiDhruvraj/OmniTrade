import { Worker } from "bullmq";
import { BrokerFactory } from "../brokers/BrokerFactory.js";
import { env } from "../config/env.js";
import { createRedisConnection } from "../config/redis.js";
import { BrokerAccount } from "../models/BrokerAccount.js";
import { OrderBatch } from "../models/OrderBatch.js";
import { OrderExecution } from "../models/OrderExecution.js";
import { publishOrderEvent } from "../events/kafkaProducer.js";
import { getBrokerAccessToken } from "../services/brokerAccount.service.js";
import { extractBrokerOrderId, refreshBatchStatus } from "../services/order.service.js";
import { AUTH_EXPIRED_MESSAGE, isBrokerAuthExpired } from "../utils/brokerAuth.js";
import { createAuditLog } from "../services/auditLog.service.js";

const placeOrderForExecution = async (job) => {
  const { executionId, batchId, brokerAccountId, orders: preloadedOrders, credentials: preloadedCredentials } = job.data;

  // 1. Idempotency Check & Atomic State Claim
  // Atomically claim the job to prevent parallel/duplicate execution
  const execution = await OrderExecution.findOneAndUpdate(
    { _id: executionId, status: { $in: ["queued", "failed"] } },
    { $set: { status: "processing", errorMessage: "" } },
    { new: true }
  );

  // If execution already succeeded or is currently processing elsewhere, skip immediately to prevent double orders
  if (!execution) {
    const existing = await OrderExecution.findById(executionId);
    if (existing?.status === "success") {
      return { skipped: true, status: existing.status, brokerOrderId: existing.brokerOrderId };
    }
    // If it already has a brokerOrderId recorded, do not re-place under any circumstance
    if (existing?.brokerOrderId) {
      return { skipped: true, status: existing.status, brokerOrderId: existing.brokerOrderId };
    }
  }

  // 2. Resolve Orders and Credentials (fast-path: use preloaded data if available)
  let orders = preloadedOrders;
  let credentials = preloadedCredentials;
  let broker = execution?.broker;

  if (!orders || !credentials || !broker) {
    const [batch, account] = await Promise.all([
      OrderBatch.findById(batchId),
      BrokerAccount.findOne({ _id: brokerAccountId, isActive: true }),
    ]);

    if (!batch) throw new Error(`Order batch ${batchId} not found`);
    if (!account) throw new Error(`Broker account ${brokerAccountId} not found`);

    orders = Array.isArray(batch.orders) && batch.orders.length > 0 ? batch.orders : [batch.order];
    credentials = getBrokerAccessToken(account);
    broker = account.broker;
  }

  // Notify async without blocking broker request
  publishOrderEvent("order.execution.processing", {
    batchId,
    executionId,
    brokerAccountId,
    broker,
  }).catch(() => {});

  try {
    const adapter = BrokerFactory.getBroker(broker);
    const response = orders.length > 1
      ? await adapter.placeMultiOrder(credentials, orders)
      : await adapter.placeOrder(credentials, orders[0]);

    if (response?.s && response.s !== "ok") {
      const error = new Error(response.message || "Broker rejected order");
      error.details = response;
      throw error;
    }

    const brokerOrderId = extractBrokerOrderId(response);

    // Update execution status
    await OrderExecution.updateOne(
      { _id: executionId },
      {
        $set: {
          status: "success",
          response: response || {},
          brokerOrderId,
          errorMessage: "",
        },
      }
    );

    refreshBatchStatus(batchId).catch(() => {});
    publishOrderEvent("order.execution.success", {
      batchId,
      executionId,
      brokerAccountId,
      broker,
      brokerOrderId,
    }).catch(() => {});

    createAuditLog({
      action: "order_execution_success",
      category: "order",
      status: "success",
      message: `${broker.toUpperCase()} order execution succeeded (Order ID: ${brokerOrderId || "N/A"})`,
      metadata: { batchId, executionId, brokerAccountId, broker, brokerOrderId },
    });

    return { status: "success", brokerOrderId };
  } catch (error) {
    const isExpired = isBrokerAuthExpired(error, broker);
    if (isExpired && brokerAccountId) {
      BrokerAccount.updateOne({ _id: brokerAccountId }, { $set: { authStatus: "expired", authExpiredAt: new Date() } }).catch(() => {});
    }
    const errorMessage = isExpired ? AUTH_EXPIRED_MESSAGE : (error.message || "Order failed");
    await OrderExecution.updateOne(
      { _id: executionId },
      {
        $set: {
          status: "failed",
          response: error.details || {},
          errorMessage,
        },
      }
    );

    refreshBatchStatus(batchId).catch(() => {});
    publishOrderEvent("order.execution.failed", {
      batchId,
      executionId,
      brokerAccountId,
      broker,
      errorMessage,
    }).catch(() => {});

    createAuditLog({
      action: isExpired ? "broker_auth_expired" : "order_execution_failed",
      category: isExpired ? "security" : "order",
      status: "failed",
      message: `${broker.toUpperCase()} order execution failed: ${errorMessage}`,
      metadata: { batchId, executionId, brokerAccountId, broker, errorMessage },
    });

    throw error;
  }
};

export const startOrderWorker = () => {
  if (!env.orderQueue.workerEnabled) {
    console.log("Order worker disabled");
    return null;
  }

  const worker = new Worker(env.orderQueue.name, placeOrderForExecution, {
    connection: createRedisConnection(),
    concurrency: env.orderQueue.concurrency,
  });

  worker.on("ready", () => {
    console.log(`Order worker ready with concurrency ${env.orderQueue.concurrency}`);
  });

  worker.on("failed", (job, error) => {
    console.error(`Order job ${job?.id || "unknown"} failed`, error);
  });

  return worker;
};
