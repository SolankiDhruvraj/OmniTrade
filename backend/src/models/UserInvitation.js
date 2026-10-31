import mongoose from "mongoose";

const invitationSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  tokenHash: {
    type: String,
    required: true,
    unique: true,
    select: false,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  usedAt: {
    type: Date,
    default: null,
  },
  status: {
    type: String,
    enum: ["pending", "accepted", "revoked", "expired"],
    default: "pending",
  },
}, { timestamps: true });

invitationSchema.index({ status: 1, createdAt: -1 });
invitationSchema.index({ email: 1 });
invitationSchema.index({ createdAt: -1 });

export const UserInvitation = mongoose.model("UserInvitation", invitationSchema);