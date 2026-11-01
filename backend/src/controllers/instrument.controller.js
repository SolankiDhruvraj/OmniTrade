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

export const candlesSchema = z.object({
  query: z.object({
    symbol: z.string().min(1),
    resolution: z.string().default("D"),
    rangeFrom: z.string().optional(),
    rangeTo: z.string().optional(),
    broker: z.string().default("fyers"),
    accountId: z.string().optional(),
  }),
});

export const optionChainSchema = z.object({
  query: z.object({
    broker: z.string().default("fyers"),
    accountId: z.string().optional(),
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

export const getCandles = asyncHandler(async (req, res) => {
  const { symbol, resolution, rangeFrom, rangeTo, broker, accountId } = req.validated.query;
  let account = null;

  if (accountId) {
    account = await BrokerAccount.findOne({
      _id: accountId,
      user: req.user._id,
      broker,
      isActive: true,
    });
  } else {
    account = await BrokerAccount.findOne({
      user: req.user._id,
      broker,
      isActive: true,
    });
  }

  if (!account) {
    throw new AppError("No active linked Fyers account found to fetch historical candles", 404);
  }

  const adapter = BrokerFactory.getBroker(broker);
  const resolvedSymbol = broker === "fyers"
    ? await resolveFyersOptionChainSymbol(symbol)
    : symbol;

  // Calculate default range if not passed (e.g. last 180 days for D, or 10 days for minute resolutions)
  const toDate = new Date();
  const fromDate = new Date();
  if (resolution === "D") {
    fromDate.setDate(toDate.getDate() - 200);
  } else {
    fromDate.setDate(toDate.getDate() - 15);
  }

  const formatDate = (d) => d.toISOString().split("T")[0];
  const rFrom = rangeFrom || formatDate(fromDate);
  const rTo = rangeTo || formatDate(toDate);

  const historyParams = {
    symbol: resolvedSymbol,
    resolution,
    date_format: "1",
    range_from: rFrom,
    range_to: rTo,
    cont_flag: "1",
  };

  const historyResponse = await adapter.getHistory(getBrokerAccessToken(account), historyParams);
  if (historyResponse?.s && historyResponse.s !== "ok") {
    throw new AppError(historyResponse.message || "Fyers failed to return historical candle data", 502, historyResponse);
  }

  // Fyers candles format: [epoch_timestamp, open, high, low, close, volume]
  const rawCandles = historyResponse?.candles || [];
  const candles = rawCandles.map((c) => ({
    time: c[0], // epoch in seconds
    open: Number(c[1]),
    high: Number(c[2]),
    low: Number(c[3]),
    close: Number(c[4]),
    volume: Number(c[5] || 0),
  }));

  res.json({
    symbol: resolvedSymbol,
    resolution,
    candles,
  });
});

export const optionChain = asyncHandler(async (req, res) => {
  const { accountId, broker, symbol, timestamp, strikecount, greeks } = req.validated.query;
  let account = null;

  if (accountId) {
    account = await BrokerAccount.findOne({
      _id: accountId,
      user: req.user._id,
      broker,
      isActive: true,
    });
  } else {
    // Pick first active account for the broker
    account = await BrokerAccount.findOne({
      user: req.user._id,
      broker,
      isActive: true,
    });
  }

  if (!account) {
    throw new AppError("No active linked Fyers account found to fetch live option chain", 404);
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
