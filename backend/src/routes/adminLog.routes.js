import { Router } from "express";
import { AuditLog } from "../models/AuditLog.js";
import { requireAuth } from "../middlewares/auth.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.use(requireAuth);
router.use(requireAdmin);

/**
 * GET /api/v1/admin/logs
 * List audit logs with pagination and filters
 */
router.get("/", asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const skip = (page - 1) * limit;

  const category = req.query.category;
  const status = req.query.status;
  const search = req.query.search || req.query.q || "";

  const filter = {};
  if (category && category !== "all") {
    filter.category = category;
  }
  if (status && status !== "all") {
    filter.status = status;
  }
  if (search && search.trim()) {
    const sRegex = new RegExp(search.trim(), "i");
    filter.$or = [
      { message: sRegex },
      { userEmail: sRegex },
      { userName: sRegex },
      { action: sRegex },
      { ip: sRegex },
    ];
  }

  const [logs, totalCount] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("user", "name email"),
    AuditLog.countDocuments(filter),
  ]);

  res.json({
    logs: logs.map((log) => ({
      id: log._id,
      user: log.user ? {
        id: log.user._id,
        name: log.user.name,
        email: log.user.email,
      } : {
        name: log.userName,
        email: log.userEmail,
      },
      action: log.action,
      category: log.category,
      status: log.status,
      message: log.message,
      metadata: log.metadata,
      ip: log.ip,
      userAgent: log.userAgent,
      createdAt: log.createdAt,
    })),
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit) || 1,
      hasPrevPage: page > 1,
      hasNextPage: page * limit < totalCount,
    },
  });
}));

export default router;
