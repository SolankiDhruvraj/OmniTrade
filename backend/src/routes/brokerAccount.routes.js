import { Router } from "express";
import {
  callbackSchema,
  exitBrokerPositions,
  exitPositionsSchema,
  createBrokerAccount,
  createBrokerAccountSchema,
  deleteBrokerAccount,
  getFyersAuthUrl,
  handleFyersCallback,
  getZerodhaAuthUrl,
  handleZerodhaCallback,
  listAllAdminBrokerAccounts,
  revokeAdminBrokerAccount,
  activateAdminBrokerAccount,
  listBrokerAccounts,
  listBrokerPositions,
  listBrokerHoldings,
  listBrokerOrders,
  listBrokerFunds,
  killSwitchPanicSquareOff,
  paramsSchema,
} from "../controllers/brokerAccount.controller.js";
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

// ── OAuth callbacks come in as browser redirects (no cookie) — must be before requireAuth ──
router.get("/fyers/callback", validate(callbackSchema), handleFyersCallback);
router.get("/zerodha/callback", validate(callbackSchema), handleZerodhaCallback);

// All routes below require an authenticated session
router.use(requireAuth);

// Admin-only endpoints
router.get("/admin/all", requireAdmin, listAllAdminBrokerAccounts);
router.post("/admin/:id/revoke", requireAdmin, requireTrustedOrigin, validate(paramsSchema), revokeAdminBrokerAccount);
router.post("/admin/:id/activate", requireAdmin, requireTrustedOrigin, validate(paramsSchema), activateAdminBrokerAccount);

router.get("/", listBrokerAccounts);
router.get("/positions", listBrokerPositions);
router.get("/holdings", listBrokerHoldings);
router.get("/funds", listBrokerFunds);
router.post("/kill-switch", requireTrustedOrigin, killSwitchPanicSquareOff);
router.get("/broker-orders", listBrokerOrders);
router.post("/positions/exit", requireTrustedOrigin, validate(exitPositionsSchema), exitBrokerPositions);
router.post("/", requireTrustedOrigin, validate(createBrokerAccountSchema), createBrokerAccount);
router.get("/fyers/auth-url", getFyersAuthUrl);
// Zerodha auth-url is POST so it can receive { apiKey, apiSecret } in the body for multi-account OAuth
router.post("/zerodha/auth-url", requireTrustedOrigin, getZerodhaAuthUrl);
router.delete("/:id", requireTrustedOrigin, validate(paramsSchema), deleteBrokerAccount);

export default router;
