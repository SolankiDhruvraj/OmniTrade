import { BrokerAccount } from "../models/BrokerAccount.js";
import { OrderBatch } from "../models/OrderBatch.js";
import { OrderExecution } from "../models/OrderExecution.js";
import { publishOrderEvent } from "../events/kafkaProducer.js";
import { addOrderExecutionJobs } from "../queues/order.queue.js";
import { getBrokerAccessToken } from "./brokerAccount.service.js";
import { AppError } from "../utils/AppError.js";
import { AUTH_EXPIRED_MESSAGE } from "../utils/brokerAuth.js";
import { createAuditLog } from "./auditLog.service.js";

export const extractBrokerOrderId = (response) => {
  if (!response) return "";
  return response.id || response.order_id || response.orderId || response.data?.id || response.data?.order_id || "";
};

export const refreshBatchStatus = async (batchId) => {
  const [batch, executions] = await Promise.all([
    OrderBatch.findById(batchId),
    OrderExecution.find({ batch: batchId }),
  ]);

  if (!batch) return null;
  if (executions.length === 0) return batch;

  const successCount = executions.filter((execution) => execution.status === "success").length;
  const failedCount = executions.filter((execution) => execution.status === "failed").length;
  const processingCount = executions.filter((execution) => execution.status === "processing").length;
  const queuedCount = executions.filter((execution) => execution.status === "queued").length;

  if (successCount === executions.length) {
    batch.status = "completed";
  } else if (failedCount === executions.length) {
    batch.status = "failed";
  } else if (successCount + failedCount === executions.length) {
    batch.status = "partially_failed";
  } else if (processingCount > 0) {
    batch.status = "processing";
  } else if (queuedCount > 0) {
    batch.status = "queued";
  }

  await batch.save();
  await publishOrderEvent("order.batch.status_changed", {
    batchId: batch._id,
    status: batch.status,
    successCount,
    failedCount,
    processingCount,
    queuedCount,
    totalCount: executions.length,
  });

  return batch;
};

export const createOrderPreview = async ({ userId, brokerAccountIds, orders, accountMultipliers = {} }) => {
  const accounts = await BrokerAccount.find({
    _id: { $in: brokerAccountIds },
    user: userId,
    isActive: true,
  });

  if (accounts.length !== brokerAccountIds.length) {
    throw new AppError("One or more selected broker accounts are invalid", 400);
  }

  const expiredAccount = accounts.find((a) => a.authStatus === "expired");
  if (expiredAccount) {
    throw new AppError(`Auth expired for ${expiredAccount.displayName || expiredAccount.accountId}, please authenticate your broker account again`, 400);
  }

  return OrderBatch.create({
    user: userId,
    brokerAccountIds,
    order: orders[0],
    orders,
    accountMultipliers,
    status: "pending",
  });
};

export const confirmOrderBatch = async ({ userId, batchId }) => {
  const batch = await OrderBatch.findOne({ _id: batchId, user: userId });

  if (!batch) {
    throw new AppError("Order batch not found", 404);
  }

  if (batch.status !== "pending") {
    throw new AppError("Order batch has already been confirmed", 409);
  }

  const accounts = await BrokerAccount.find({
    _id: { $in: batch.brokerAccountIds },
    user: userId,
    isActive: true,
  });

  if (accounts.length !== batch.brokerAccountIds.length) {
    throw new AppError("One or more selected broker accounts are invalid", 400);
  }

  const expiredAccount = accounts.find((a) => a.authStatus === "expired");
  if (expiredAccount) {
    throw new AppError(`Auth expired for ${expiredAccount.displayName || expiredAccount.accountId}, please authenticate your broker account again`, 400);
  }

  // Pre-resolve credentials and orders map for ultra-fast, zero-roundtrip worker execution
  const accountMap = new Map(accounts.map((acc) => [String(acc._id), acc]));
  const orders = Array.isArray(batch.orders) && batch.orders.length > 0 ? batch.orders : [batch.order];

  // Bulk upsert executions with ordered: false to execute concurrently at MongoDB engine level
  const bulkOps = accounts.map((account) => ({
    updateOne: {
      filter: { batch: batch._id, brokerAccount: account._id },
      update: {
        $setOnInsert: {
          user: userId,
          batch: batch._id,
          brokerAccount: account._id,
          broker: account.broker,
          status: "queued",
          response: {},
          brokerOrderId: "",
          errorMessage: "",
        },
      },
      upsert: true,
    },
  }));

  await OrderExecution.bulkWrite(bulkOps, { ordered: false });

  const executions = await OrderExecution.find({ batch: batch._id, brokerAccount: { $in: accounts.map((a) => a._id) } });

  // Attach preloaded credentials & order payload (scaled by accountMultiplier if configured)
  const multipliers = batch.accountMultipliers || {};
  executions.forEach((exec) => {
    const acc = accountMap.get(String(exec.brokerAccount));
    if (acc) {
      exec.preloadedCredentials = getBrokerAccessToken(acc);
      const mult = Number(multipliers.get?.(String(exec.brokerAccount)) ?? multipliers[String(exec.brokerAccount)] ?? 1);
      exec.preloadedOrders = mult === 1 ? orders : orders.map((o) => ({
        ...o,
        qty: Math.max(1, Math.round((Number(o.qty) || 1) * mult)),
      }));
    }
  });

  batch.confirmedAt = new Date();
  try {
    await addOrderExecutionJobs(executions);
    batch.status = "queued";
  } catch (error) {
    await OrderExecution.updateMany(
      { _id: { $in: executions.map((execution) => execution._id) } },
      {
        $set: {
          status: "failed",
          errorMessage: "Order queue is unavailable",
          response: { queueError: error.message },
        },
      },
    );
    batch.status = "failed";
    await batch.save();
    await publishOrderEvent("order.batch.enqueue_failed", {
      batchId: batch._id,
      accountCount: executions.length,
      errorMessage: error.message,
    });
    throw new AppError("Unable to enqueue order executions", 503, { queueError: error.message });
  }

  await batch.save();
  await publishOrderEvent("order.batch.queued", {
    batchId: batch._id,
    accountCount: executions.length,
  });

  const orderSummary = orders.map((o) => `${o.side === 1 ? "BUY" : "SELL"} ${o.qty} ${o.symbol}`).join(", ");
  createAuditLog({
    userId,
    action: "order_batch_confirmed",
    category: "order",
    status: "info",
    message: `Order batch placed across ${executions.length} accounts: ${orderSummary}`,
    metadata: {
      batchId: batch._id,
      accountCount: executions.length,
      orders: orders.map((o) => ({ symbol: o.symbol, side: o.side, qty: o.qty, type: o.type, product: o.productType })),
    },
  });

  return { batch, executions };
};

export const listOrderBatches = async ({ userId, page = 1, limit = 10 }) => {
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(50, Math.max(1, Number(limit) || 10));
  const skip = (pageNum - 1) * limitNum;

  const [batches, totalCount] = await Promise.all([
    OrderBatch.find({ user: userId }).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
    OrderBatch.countDocuments({ user: userId }),
  ]);

  const executions = await OrderExecution.find({ batch: { $in: batches.map((batch) => batch._id) } })
    .populate("brokerAccount", "broker accountId displayName")
    .sort({ createdAt: -1 });

  const items = batches.map((batch) => ({
    ...batch.toObject(),
    executions: executions.filter((execution) => String(execution.batch) === String(batch._id)),
  }));

  return {
    batches: items,
    pagination: {
      page: pageNum,
      limit: limitNum,
      totalCount,
      totalPages: Math.ceil(totalCount / limitNum) || 1,
      hasPrevPage: pageNum > 1,
      hasNextPage: pageNum * limitNum < totalCount,
    },
  };
};

export const listAllAdminOrderBatches = async ({ page = 1, limit = 15, brokerAccount = "" }) => {
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(50, Math.max(1, Number(limit) || 15));
  const skip = (pageNum - 1) * limitNum;

  let batchFilter = {};

  if (brokerAccount && brokerAccount.trim()) {
    const searchRegex = new RegExp(brokerAccount.trim(), "i");
    // Find matching broker accounts by accountId, displayName, or broker name
    const matchedAccounts = await BrokerAccount.find({
      $or: [
        { accountId: searchRegex },
        { displayName: searchRegex },
        { broker: searchRegex },
      ],
    }).select("_id");

    const matchedAccountIds = matchedAccounts.map((a) => a._id);
    batchFilter = { brokerAccountIds: { $in: matchedAccountIds } };
  }

  const [batches, totalCount] = await Promise.all([
    OrderBatch.find(batchFilter)
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum),
    OrderBatch.countDocuments(batchFilter),
  ]);

  const executions = await OrderExecution.find({ batch: { $in: batches.map((batch) => batch._id) } })
    .populate("brokerAccount", "broker accountId displayName")
    .populate("user", "name email")
    .sort({ createdAt: -1 });

  const items = batches.map((batch) => ({
    ...batch.toObject(),
    user: batch.user ? {
      id: batch.user._id,
      name: batch.user.name,
      email: batch.user.email,
    } : null,
    executions: executions.filter((execution) => String(execution.batch) === String(batch._id)),
  }));

  return {
    batches: items,
    pagination: {
      page: pageNum,
      limit: limitNum,
      totalCount,
      totalPages: Math.ceil(totalCount / limitNum) || 1,
      hasPrevPage: pageNum > 1,
      hasNextPage: pageNum * limitNum < totalCount,
    },
  };
};
