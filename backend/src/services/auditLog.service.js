import { AuditLog } from "../models/AuditLog.js";

/**
 * Record an audit log entry safely without interrupting primary request flow.
 */
export const createAuditLog = async ({
  userId,
  userEmail,
  userName,
  action,
  category,
  status = "info",
  message,
  metadata = {},
  req,
}) => {
  try {
    let resolvedEmail = userEmail || "";
    let resolvedName = userName || "";

    if (req?.user) {
      if (!resolvedEmail) resolvedEmail = req.user.email || "";
      if (!resolvedName) resolvedName = req.user.name || "";
      if (!userId) userId = req.user._id;
    }

    const ip = req?.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() || req?.socket?.remoteAddress || "";
    const userAgent = req?.headers?.["user-agent"] || "";

    await AuditLog.create({
      user: userId || undefined,
      userEmail: resolvedEmail,
      userName: resolvedName,
      action,
      category,
      status,
      message,
      metadata,
      ip,
      userAgent: typeof userAgent === "string" ? userAgent.slice(0, 200) : "",
    });
  } catch (err) {
    console.error("Failed to write audit log:", err.message);
  }
};
