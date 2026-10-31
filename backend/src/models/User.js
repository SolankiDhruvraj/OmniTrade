import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  passwordHash: {
    type: String,
    required: true,
  },
  totpEnabled: {
    type: Boolean,
    default: false,
  },
  totpSecret: {
    type: String,
    select: false,
  },
  pendingTotpSecret: {
    type: String,
    select: false,
  },
  pendingTotpExpiresAt: {
    type: Date,
    select: false,
  },
  lastTotpCounter: {
    type: Number,
    select: false,
  },
  activeTwoFactorChallengeId: {
    type: String,
    select: false,
  },
  activeTwoFactorChallengeExpiresAt: {
    type: Date,
    select: false,
  },
  totpRecoveryCodeHashes: {
    type: [String],
    default: [],
    select: false,
  },
  passwordResetTokenHash: {
    type: String,
    select: false,
  },
  passwordResetExpiresAt: {
    type: Date,
    select: false,
  },
}, { timestamps: true });

userSchema.methods.comparePassword = function comparePassword(password) {
  return bcrypt.compare(password, this.passwordHash);
};

userSchema.statics.hashPassword = function hashPassword(password) {
  return bcrypt.hash(password, 12);
};

export const User = mongoose.model("User", userSchema);
