import { Router } from "express";
import { AuditLog } from "../models/AuditLog.js";
import { requireAuth } from "../middlewares/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { isAdminUser } from "../utils/adminAccess.js";

const router = Router();

router.use(requireAuth);

/**
 * GET /api/v1/logs
 * - Regular users see ONLY their own activity logs.
 * - Administrators see all system logs by default, or can filter by specific user.
 */
router.get("/", asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const skip = (page - 1) * limit;

  const category = req.query.category;
  const status = req.query.status;
  const search = req.query.search || req.query.q || "";
  const isAdmin = isAdminUser(req.user);

  const filter = {};

  // Access Control: Non-admins strictly scoped to their own logs
  if (!isAdmin) {
    filter.$or = [
      { user: req.user._id },
      { userEmail: req.user.email?.toLowerCase() },
    ];
  } else if (req.query.scope === "mine") {
    // Admin optionally viewing only their own logs
    filter.$or = [
      { user: req.user._id },
      { userEmail: req.user.email?.toLowerCase() },
    ];
  }

  if (category && category !== "all") {
    filter.category = category;
  }
  if (status && status !== "all") {
    filter.status = status;
  }

  if (search && search.trim()) {
    const sRegex = new RegExp(search.trim(), "i");
    const searchConditions = [
      { message: sRegex },
      { action: sRegex },
      { ip: sRegex },
    ];
    if (isAdmin) {
      searchConditions.push({ userEmail: sRegex });
      searchConditions.push({ userName: sRegex });
    }

    if (filter.$or) {
      // Combine ownership constraint with search condition using $and
      filter.$and = [
        { $or: filter.$or },
        { $or: searchConditions },
      ];
      delete filter.$or;
    } else {
      filter.$or = searchConditions;
    }
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
    isAdmin,
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
