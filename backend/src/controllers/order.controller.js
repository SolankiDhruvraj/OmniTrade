import { z } from "zod";
import { confirmOrderBatch, createOrderPreview, listAllAdminOrderBatches, listOrderBatches } from "../services/order.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { isAdminUser } from "../utils/adminAccess.js";

const orderPayloadSchema = z.object({
  symbol: z.string().min(1),
  qty: z.coerce.number().int().positive(),
  type: z.coerce.number().int(),
  side: z.coerce.number().int(),
  productType: z.enum(["INTRADAY", "MARGIN", "CNC", "CO", "BO"]).default("INTRADAY"),
  limitPrice: z.coerce.number().min(0).default(0),
  stopPrice: z.coerce.number().min(0).default(0),
  validity: z.enum(["DAY", "IOC"]).default("DAY"),
  disclosedQty: z.coerce.number().int().min(0).default(0),
  offlineOrder: z.boolean().default(false),
});

export const previewSchema = z.object({
  body: z.object({
    brokerAccountIds: z.array(z.string().min(1)).min(1),
    accountMultipliers: z.record(z.string(), z.coerce.number().positive().max(100)).optional(),
    order: orderPayloadSchema.optional(),
    orders: z.array(orderPayloadSchema).min(1).max(20).optional(),
  }).refine((body) => body.order || body.orders, {
    message: "Either order or orders is required",
    path: ["orders"],
  }),
});

export const confirmSchema = z.object({
  params: z.object({
    batchId: z.string().min(1),
  }),
});

export const previewOrder = asyncHandler(async (req, res) => {
  const batch = await createOrderPreview({
    userId: req.user._id,
    brokerAccountIds: req.validated.body.brokerAccountIds,
    orders: req.validated.body.orders || [req.validated.body.order],
    accountMultipliers: req.validated.body.accountMultipliers || {},
  });

  res.status(201).json({ batch });
});

export const confirmOrder = asyncHandler(async (req, res) => {
  const result = await confirmOrderBatch({
    userId: req.user._id,
    batchId: req.validated.params.batchId,
  });

  res.json(result);
});

export const listOrders = asyncHandler(async (req, res) => {
  const page = req.query.page;
  const limit = req.query.limit;
  const isAdmin = isAdminUser(req.user);
  if (isAdmin && req.query.allUsers === "true") {
    const brokerAccount = req.query.brokerAccount || req.query.q || "";
    const result = await listAllAdminOrderBatches({ page, limit, brokerAccount });
    return res.json(result);
  }
  const result = await listOrderBatches({ userId: req.user._id, page, limit });
  res.json(result);
});

export const listAllAdminOrders = asyncHandler(async (req, res) => {
  const page = req.query.page;
  const limit = req.query.limit;
  const brokerAccount = req.query.brokerAccount || req.query.q || "";
  const result = await listAllAdminOrderBatches({ page, limit, brokerAccount });
  res.json(result);
});
