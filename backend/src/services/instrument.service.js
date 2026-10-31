import { env } from "../config/env.js";
import { Instrument } from "../models/Instrument.js";

const parseCsvLine = (line) => {
  const values = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === "\"" && quoted && next === "\"") {
      current += "\"";
      index += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
};

const normaliseRow = (row) => {
  const symbol = row[9] || row.symbol || row.Symbol || "";
  const name = row[1] || row.description || row.name || "";
  const exchange = symbol.split(":")[0] || "NSE";
  const instrumentType = row[16] || row.instrumentType || row.instrument_type || "";
  const lotSize = Number(row[3] || row.lotSize || row.lot_size || 0) || null;
  const strike = Number(row[15] || row.strike || 0) || null;
  const optionType = /CE\b/i.test(symbol) ? "CE" : /PE\b/i.test(symbol) ? "PE" : "";
  const expiry = row[7] || row[8] || row.expiry || "";
  const underlying = row[13] || row.underlying || row.underlying_symbol || "";

  return {
    broker: "fyers",
    exchange,
    symbol,
    name,
    underlying,
    instrumentType,
    expiry,
    strike,
    optionType,
    lotSize,
    raw: row,
  };
};

export const syncFyersNseFoInstruments = async ({ onProgress = async () => {} } = {}) => {
  const response = await fetch(env.fyers.nseFoSymbolMasterUrl, {
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`Unable to fetch Fyers symbol master: ${response.status}`);
  }

  const text = await response.text();
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) {
    return { inserted: 0, matched: 0 };
  }

  const batchSize = 1000;
  const totals = { inserted: 0, modified: 0, matched: 0, total: 0 };
  await onProgress({ stage: "writing", processed: 0, total: lines.length });

  for (let offset = 0; offset < lines.length; offset += batchSize) {
    const operations = lines
      .slice(offset, offset + batchSize)
      .map((line) => normaliseRow(parseCsvLine(line)))
      .filter((instrument) => instrument.symbol && instrument.symbol.includes(":"))
      .map((instrument) => ({
        updateOne: {
          filter: { broker: "fyers", symbol: instrument.symbol },
          update: { $set: instrument },
          upsert: true,
        },
      }));

    if (operations.length > 0) {
      const result = await Instrument.bulkWrite(operations, { ordered: false });
      totals.inserted += result.upsertedCount;
      totals.modified += result.modifiedCount;
      totals.matched += result.matchedCount;
      totals.total += operations.length;
    }

    await onProgress({
      stage: "writing",
      processed: Math.min(offset + batchSize, lines.length),
      total: lines.length,
    });
  }

  return { upserted: totals.inserted, modified: totals.modified, matched: totals.matched, total: totals.total };
};

export const searchInstruments = async ({ broker = "fyers", query }) => {
  const cleanQuery = query.trim();
  const regex = new RegExp(cleanQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const [totalCached, instruments] = await Promise.all([
    Instrument.countDocuments({ broker }),
    Instrument.find({
    broker,
    $or: [
      { symbol: regex },
      { name: regex },
      { underlying: regex },
    ],
  })
    .sort({ symbol: 1 })
      .limit(50),
  ]);

  return {
    instruments,
    meta: {
      broker,
      query: cleanQuery,
      totalCached,
      hasCache: totalCached > 0,
      resultCount: instruments.length,
    },
  };
};
