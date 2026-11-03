import mongoose from "mongoose";

const brokerAccountSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  broker: {
    type: String,
    required: true,
    enum: ["fyers", "zerodha"],
    lowercase: true,
  },
  accountId: {
    type: String,
    required: true,
  },
  displayName: {
    type: String,
    required: true,
  },
  encryptedAccessToken: {
    type: String,
    required: true,
  },
  profile: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  authStatus: {
    type: String,
    enum: ["active", "expired"],
    default: "active",
  },
  authExpiredAt: {
    type: Date,
    default: null,
  },
}, { timestamps: true });

brokerAccountSchema.index({ user: 1, broker: 1, accountId: 1 }, { unique: true });

brokerAccountSchema.methods.toSafeJSON = function toSafeJSON() {
  const sanitizedProfile = { ...(this.profile || {}) };
  // Explicitly ensure no sensitive token or key properties leak out
  delete sanitizedProfile.apiKey;
  delete sanitizedProfile.apiSecret;
  delete sanitizedProfile.accessToken;
  delete sanitizedProfile.refreshToken;
  delete sanitizedProfile.totpSecret;
  delete sanitizedProfile.password;
  delete sanitizedProfile.pin;

  return {
    id: this._id,
    broker: this.broker,
    accountId: this.accountId,
    displayName: this.displayName,
    profile: sanitizedProfile,
    isActive: this.isActive,
    authStatus: this.authStatus || "active",
    authExpiredAt: this.authExpiredAt || null,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export const BrokerAccount = mongoose.model("BrokerAccount", brokerAccountSchema);
