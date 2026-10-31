import mongoose from "mongoose";

const instrumentSchema = new mongoose.Schema({
  broker: {
    type: String,
    required: true,
    enum: ["fyers"],
    lowercase: true,
    index: true,
  },
  exchange: {
    type: String,
    required: true,
  },
  symbol: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    default: "",
  },
  underlying: {
    type: String,
    default: "",
    index: true,
  },
  instrumentType: {
    type: String,
    default: "",
  },
  expiry: {
    type: String,
    default: "",
  },
  strike: {
    type: Number,
    default: null,
  },
  optionType: {
    type: String,
    default: "",
  },
  lotSize: {
    type: Number,
    default: null,
  },
  raw: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, { timestamps: true });

instrumentSchema.index({ broker: 1, symbol: 1 }, { unique: true });
instrumentSchema.index({ broker: 1, symbol: "text", name: "text", underlying: "text" });

export const Instrument = mongoose.model("Instrument", instrumentSchema);
