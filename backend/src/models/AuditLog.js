import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false,
    index: true,
  },
  userEmail: {
    type: String,
    default: "",
    index: true,
  },
  userName: {
    type: String,
    default: "",
  },
  action: {
    type: String,
    required: true,
    enum: [
      "user_login",
      "user_login_failed",
      "user_2fa_login",
      "user_logout",
      "broker_account_added",
      "broker_account_authenticated",
      "broker_account_reconnected",
      "broker_account_revoked",
      "broker_auth_expired",
      "order_preview_created",
      "order_batch_confirmed",
      "order_execution_success",
      "order_execution_failed",
      "position_exit_submitted",
      "kill_switch_triggered",
    ],
    index: true,
  },
  category: {
    type: String,
    enum: ["auth", "broker", "order", "security"],
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: ["success", "failed", "warning", "info"],
    default: "info",
    index: true,
  },
  message: {
    type: String,
    required: true,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  ip: {
    type: String,
    default: "",
  },
  userAgent: {
    type: String,
    default: "",
  },
}, { timestamps: true });

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ category: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ user: 1, createdAt: -1 });

export const AuditLog = mongoose.model("AuditLog", auditLogSchema);
