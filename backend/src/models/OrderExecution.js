import mongoose from "mongoose";

const orderExecutionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  batch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "OrderBatch",
    required: true,
    index: true,
  },
  brokerAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "BrokerAccount",
    required: true,
  },
  broker: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ["queued", "processing", "success", "failed"],
    required: true,
  },
  brokerOrderId: {
    type: String,
    default: "",
  },
  response: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  errorMessage: {
    type: String,
    default: "",
  },
}, { timestamps: true });

orderExecutionSchema.index({ batch: 1, brokerAccount: 1 }, { unique: true });
orderExecutionSchema.index({ user: 1, createdAt: -1 });
orderExecutionSchema.index({ batch: 1, status: 1 });
orderExecutionSchema.index({ createdAt: -1 });
orderExecutionSchema.index({ brokerAccount: 1, createdAt: -1 });

export const OrderExecution = mongoose.model("OrderExecution", orderExecutionSchema);
