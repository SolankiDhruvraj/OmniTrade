import mongoose from "mongoose";

const orderBatchSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: ["pending", "queued", "processing", "completed", "partially_failed", "failed"],
    default: "pending",
  },
  brokerAccountIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "BrokerAccount",
  }],
  order: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  orders: [{
    type: mongoose.Schema.Types.Mixed,
  }],
  accountMultipliers: {
    type: Map,
    of: Number,
    default: {},
  },
  confirmedAt: {
    type: Date,
    default: null,
  },
}, { timestamps: true });

orderBatchSchema.index({ user: 1, createdAt: -1 });
orderBatchSchema.index({ status: 1 });
orderBatchSchema.index({ createdAt: -1 });

export const OrderBatch = mongoose.model("OrderBatch", orderBatchSchema);
