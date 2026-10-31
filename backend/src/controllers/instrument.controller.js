import { z } from "zod";
import { BrokerAccount } from "../models/BrokerAccount.js";
import { Instrument } from "../models/Instrument.js";
import { BrokerFactory } from "../brokers/BrokerFactory.js";
import { getBrokerAccessToken } from "../services/brokerAccount.service.js";
import { searchInstruments } from "../services/instrument.service.js";
import { enqueueFyersInstrumentSync, instrumentSyncQueue } from "../queues/instrumentSync.queue.js";
import { AppError } from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const searchSchema = z.object({
  query: z.object({
    q: z.string().min(1),
    broker: z.string().default("fyers"),
  }),
});

export const optionChainSchema = z.object({
  query: z.object({
    broker: z.string().default("fyers"),
    accountId: z.string().min(1),
    symbol: z.string().min(1),
    timestamp: z.string().optional(),
    strikecount: z.string().optional(),
    greeks: z.string().optional(),
  }),
});

const fyersIndexSymbols = {
  NIFTY: "NSE:NIFTY50-INDEX",
  NIFTY50: "NSE:NIFTY50-INDEX",
  BANKNIFTY: "NSE:NIFTYBANK-INDEX",
  NIFTYBANK: "NSE:NIFTYBANK-INDEX",
  FINNIFTY: "NSE:FINNIFTY-INDEX",
  MIDCPNIFTY: "NSE:MIDCPNIFTY-INDEX",
  NIFTYNXT50: "NSE:NIFTYNXT50-INDEX",
};
const unresolvedFyersContract = /\d{2}[A-Z]{3}(?:FUT|\d+(?:CE|PE))$/;

export const resolveFyersOptionChainSymbol = async (inputSymbol) => {
  const suppliedSymbol = inputSymbol.trim().toUpperCase();
  const instrument = await Instrument.findOne({ broker: "fyers", symbol: suppliedSymbol })
    .select("underlying");
  const source = (instrument?.underlying || suppliedSymbol).trim().toUpperCase();
  const colonIndex = source.indexOf(":");
  const exchange = colonIndex >= 0 ? source.slice(0, colonIndex) : "NSE";
  const root = colonIndex >= 0 ? source.slice(colonIndex + 1) : source;
  const indexSymbol = fyersIndexSymbols[root.replace(/-INDEX$/, "")];

  if (indexSymbol) return indexSymbol;
  if (root.endsWith("-INDEX") || root.endsWith("-EQ")) return `${exchange}:${root}`;
  if (!instrument && unresolvedFyersContract.test(root)) {
    throw new AppError("Select a F&O contract from instrument search so its underlying can be resolved", 400);
  }

  return `${exchange}:${root}-EQ`;
};

export const syncFyersInstruments = asyncHandler(async (req, res) => {
  const job = await enqueueFyersInstrumentSync();
  res.status(202).json({
    jobId: job.id,
    status: await job.getState(),
    progress: job.progress,
  });
});

export const getFyersInstrumentSyncStatus = asyncHandler(async (req, res) => {
  const job = await instrumentSyncQueue.getJob(req.params.jobId);
  if (!job) throw new AppError("Fyers instrument sync job not found", 404);

  res.json({
    jobId: job.id,
    status: await job.getState(),
    progress: job.progress,
    result: job.returnvalue || null,
    error: job.failedReason || null,
  });
});

export const search = asyncHandler(async (req, res) => {
  const result = await searchInstruments({
    broker: req.validated.query.broker,
    query: req.validated.query.q,
  });
  res.json(result);
});

export const optionChain = asyncHandler(async (req, res) => {
  const { accountId, broker, symbol, timestamp, strikecount, greeks } = req.validated.query;
  const account = await BrokerAccount.findOne({
    _id: accountId,
    user: req.user._id,
    broker,
    isActive: true,
  });

  if (!account) {
    throw new AppError("Linked broker account not found", 404);
  }

  const adapter = BrokerFactory.getBroker(broker);
  const optionChainSymbol = broker === "fyers"
    ? await resolveFyersOptionChainSymbol(symbol)
    : symbol;
  const params = {
    symbol: optionChainSymbol,
    ...(timestamp ? { timestamp } : {}),
    ...(strikecount ? { strikecount: Number(strikecount) } : {}),
    ...(greeks ? { greeks } : {}),
  };
  const chain = await adapter.getOptionChain(getBrokerAccessToken(account), params);
  if (chain?.s && chain.s !== "ok") {
    throw new AppError(chain.message || "Fyers rejected the option-chain symbol", 502, chain);
  }
  res.json({ chain });
});
