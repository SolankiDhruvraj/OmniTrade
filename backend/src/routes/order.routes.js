import { Router } from "express";
import { confirmOrder, confirmSchema, listAllAdminOrders, listOrders, previewOrder, previewSchema } from "../controllers/order.controller.js";
import { requireAuth } from "../middlewares/auth.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";
import { validate } from "../middlewares/validate.js";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";

const requireTrustedOrigin = (req, res, next) => {
  const origin = req.get("Origin");
  if (origin && origin !== env.clientUrl) {
    throw new AppError("Request origin is not allowed", 403);
  }
  next();
};

const router = Router();

router.use(requireAuth);
router.get("/admin/all", requireAdmin, listAllAdminOrders);
router.get("/", listOrders);
router.post("/preview", requireTrustedOrigin, validate(previewSchema), previewOrder);
router.post("/:batchId/confirm", requireTrustedOrigin, validate(confirmSchema), confirmOrder);

export default router;
