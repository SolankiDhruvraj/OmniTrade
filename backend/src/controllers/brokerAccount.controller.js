import { z } from "zod";
import { BrokerFactory } from "../brokers/BrokerFactory.js";
import { env } from "../config/env.js";
import { BrokerAccount } from "../models/BrokerAccount.js";
import { OrderExecution } from "../models/OrderExecution.js";
import { OrderBatch } from "../models/OrderBatch.js";
import { connectBrokerAccount, createManualBrokerAccount, getBrokerAccessToken } from "../services/brokerAccount.service.js";
import { AppError } from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { signOAuthState, verifyOAuthState } from "../utils/jwt.js";

const brokerValues = ["fyers", "zerodha"];

export const callbackSchema = z.object({
  query: z.object({
    auth_code: z.string().optional(),
    code: z.string().optional(),
    request_token: z.string().optional(),
    status: z.string().optional(),
    s: z.string().optional(),
    message: z.string().optional(),
    state: z.string().optional(),
  }),
});

export const paramsSchema = z.object({
  params: z.object({
    id: z.string().min(1),
  }),
});

export const exitPositionsSchema = z.object({
  body: z.object({
    positions: z.array(z.object({
      brokerAccountId: z.string().regex(/^[a-fA-F0-9]{24}$/),
      positionId: z.string().trim().min(1).max(200),
    })).min(1).max(50),
  }).refine(({ positions }) => {
    const keys = positions.map(({ brokerAccountId, positionId }) => `${brokerAccountId}:${positionId}`);
    return new Set(keys).size === keys.length;
  }, { message: "Duplicate positions are not allowed" }),
});

const getNetPositions = (response) => {
  const positions = response?.netPositions || response?.data?.netPositions;
  if (!Array.isArray(positions)) {
    throw new AppError("Fyers returned an invalid positions response", 502);
  }
  if (response?.s && response.s !== "ok") {
    throw new AppError(response.message || "Unable to fetch Fyers positions", 502);
  }
  return positions;
};

const normalizePosition = (position) => ({
  id: String(position.id || position.positionId || position.position_id || position.tradingsymbol || ""),
  symbol: position.symbol || position.tradingsymbol || "",
  netQty: Number(position.netQty ?? position.net_qty ?? position.quantity ?? 0),
  netAvg: Number(position.netAvg ?? position.net_avg ?? position.average_price ?? position.buy_price ?? 0),
  productType: position.productType || position.product_type || position.product || "",
  exchange: position.exchange || "",
  segment: position.segment || "",
  unrealizedProfit: Number(position.unrealized_profit ?? position.pl_unrealized ?? position.unrealised ?? position.m2m ?? position.pnl ?? 0),
  realizedProfit: Number(position.realized_profit ?? position.pl_realized ?? position.realised ?? 0),
  ltp: Number(position.ltp ?? position.last_price ?? 0),
});

const normalizeHolding = (holding) => ({
  symbol: holding.symbol || holding.tradingsymbol || "",
  isin: holding.isin || "",
  exchange: holding.exchange || "NSE",
  quantity: Number(holding.quantity ?? holding.holdingQty ?? holding.total_qty ?? 0),
  t1Quantity: Number(holding.t1Quantity ?? holding.t1_quantity ?? 0),
  averagePrice: Number(holding.costPrice ?? holding.average_price ?? holding.avg_price ?? 0),
  lastPrice: Number(holding.ltp ?? holding.last_price ?? 0),
  pnl: Number(holding.pl ?? holding.pnl ?? 0),
  pnlPercentage: Number(holding.pnl_percentage ?? holding.pl_percentage ?? 0),
  currentValue: Number(
    (holding.quantity ?? holding.holdingQty ?? holding.total_qty ?? 0) * (holding.ltp ?? holding.last_price ?? 0)
  ),
  investedValue: Number(
    (holding.quantity ?? holding.holdingQty ?? holding.total_qty ?? 0) * (holding.costPrice ?? holding.average_price ?? holding.avg_price ?? 0)
  ),
});

const normalizeBrokerOrder = (order) => {
  if (!order || typeof order !== "object") return null;
  return {
    id: String(order.id || order.order_id || order.orderId || ""),
    symbol: order.symbol || order.tradingsymbol || "",
    exchange: order.exchange || "",
    status: String(order.status || "").toUpperCase(),
    orderType: String(order.type || order.order_type || ""),
    transactionType: (order.side === 1 || order.side === "BUY" || order.transaction_type === "BUY") ? "BUY" : "SELL",
    product: order.productType || order.product || "",
    quantity: Number(order.qty ?? order.quantity ?? 0),
    filledQuantity: Number(order.filledQty ?? order.filled_quantity ?? 0),
    price: Number(order.limitPrice ?? order.price ?? 0),
    triggerPrice: Number(order.stopPrice ?? order.trigger_price ?? 0),
    averagePrice: Number(order.tradedPrice ?? order.average_price ?? 0),
    orderTimestamp: order.orderDateTime || order.order_timestamp || order.exchange_timestamp || order.orderTimestamp || "",
    message: order.message || order.status_message || "",
  };
};

const normalizeFunds = (broker, rawResponse) => {
  if (broker === "zerodha") {
    const eq = rawResponse?.margins?.equity || rawResponse?.equity || {};
    const comm = rawResponse?.margins?.commodity || rawResponse?.commodity || {};
    const availableCash = Number(eq.available?.cash ?? eq.net ?? 0);
    const availableMargin = Number(eq.net ?? eq.available?.live_balance ?? 0);
    const usedMargin = Number(eq.utilised?.debits ?? eq.utilised?.m2m_realised ?? 0);
    const collateral = Number(eq.available?.collateral ?? 0);
    return {
      availableCash,
      availableMargin,
      usedMargin,
      collateral,
      raw: eq,
    };
  }

  // Fyers format
  // Fyers get_funds() returns fund_limit array with id/title/equityAmount
  const fundLimits = rawResponse?.fund_limit || rawResponse?.data?.fund_limit || [];
  let availableMargin = 0;
  let availableCash = 0;
  let usedMargin = 0;
  let collateral = 0;

  if (Array.isArray(fundLimits)) {
    fundLimits.forEach((item) => {
      const title = String(item.title || "").toLowerCase();
      const val = Number(item.equityAmount ?? item.amount ?? 0);
      if (title.includes("total balance") || title.includes("net balance") || item.id === 1) {
        availableMargin = val;
      } else if (title.includes("available balance") || title.includes("clear balance") || item.id === 2) {
        availableCash = val;
      } else if (title.includes("utilized") || title.includes("margin used") || item.id === 3) {
        usedMargin = val;
      } else if (title.includes("collateral") || item.id === 4) {
        collateral = val;
      }
    });
  }

  return {
    availableCash: availableCash || availableMargin,
    availableMargin: availableMargin || availableCash,
    usedMargin,
    collateral,
    raw: rawResponse,
  };
};

export const createBrokerAccountSchema = z.object({
  body: z.object({
    broker: z.enum(brokerValues),
    accountId: z.string().trim().min(2).max(80),
    displayName: z.string().trim().min(2).max(100),
    credentials: z.object({
      apiKey: z.string().trim().max(300).optional(),
      apiSecret: z.string().trim().max(300).optional(),
      accessToken: z.string().trim().max(3000).optional(),
      refreshToken: z.string().trim().max(3000).optional(),
      totpSecret: z.string().trim().max(300).optional(),
      password: z.string().trim().max(300).optional(),
      pin: z.string().trim().max(80).optional(),
    }).refine((credentials) => Object.values(credentials).some(Boolean), {
      message: "At least one credential is required",
    }),
    notes: z.string().trim().max(500).optional().default(""),
  }),
});

export const getFyersAuthUrl = asyncHandler(async (req, res) => {
  const adapter = BrokerFactory.getBroker("fyers");
  // Embed user ID in signed state token so callback works across all browsers (including mobile)
  const stateToken = signOAuthState({ sub: String(req.user._id) });
  const authUrl = adapter.getAuthUrl({}, stateToken);

  res.json({ url: authUrl });
});

export const handleFyersCallback = asyncHandler(async (req, res) => {
  const authCode = req.validated.query.auth_code || req.validated.query.code;

  if (!authCode) {
    const message = req.validated.query.message || "Missing Fyers auth code";
    return res.redirect(`${env.clientUrl}/accounts?connected=false&message=${encodeURIComponent(message)}`);
  }

  let userId = req.user?._id;
  const stateToken = req.validated.query.state;
  if (stateToken) {
    try {
      const stateData = verifyOAuthState(stateToken);
      if (!userId) userId = stateData.sub;
    } catch (err) {
      console.warn("Fyers OAuth state token expired or invalid:", err.message);
    }
  }

  if (!userId) {
    return res.redirect(`${env.clientUrl}/accounts?connected=false&message=${encodeURIComponent("Could not identify user. Please sign in and connect again.")}`);
  }

  const account = await connectBrokerAccount({
    userId,
    broker: "fyers",
    authCode,
  });

  res.redirect(`${env.clientUrl}/accounts?connected=true&account=${encodeURIComponent(account.accountId)}`);
});

export const getZerodhaAuthUrl = asyncHandler(async (req, res) => {
  // Accept per-account credentials from the request body (POST).
  // Falls back to .env global credentials if none provided.
  const { apiKey, apiSecret, label } = req.body || {};

  const adapter = BrokerFactory.getBroker("zerodha");
  const customCredentials = apiKey && apiSecret ? { apiKey: apiKey.trim(), apiSecret: apiSecret.trim() } : {};
  const loginUrl = adapter.getAuthUrl(customCredentials);

  // Embed per-account credentials + user ID in a signed, short-lived state token
  // so the callback can use the correct keys to exchange the request token.
  const statePayload = {
    sub: String(req.user._id),
    apiKey: customCredentials.apiKey || "",
    apiSecret: customCredentials.apiSecret || "",
    label: label || "",
  };
  const stateToken = signOAuthState(statePayload);

  // Kite Connect appends ?state=... from the URL you supply in the login URL
  // via the `&state=` query param (supported in Kite API v3).
  const urlWithState = `${loginUrl}&state=${encodeURIComponent(stateToken)}`;

  res.json({ url: urlWithState });
});

export const handleZerodhaCallback = asyncHandler(async (req, res) => {
  const requestToken = req.validated.query.request_token || req.validated.query.auth_code || req.validated.query.code;

  if (!requestToken) {
    const message = req.validated.query.message || "Missing Zerodha request token";
    return res.redirect(`${env.clientUrl}/accounts?connected=false&message=${encodeURIComponent(message)}`);
  }

  // Decode the state token to retrieve per-account credentials and user ID.
  let userId = req.user?._id;
  let customCredentials = {};
  const stateToken = req.validated.query.state;
  if (stateToken) {
    try {
      const stateData = verifyOAuthState(stateToken);
      // Use user ID from state if request is unauthenticated (browser redirect has no cookie)
      if (!userId) userId = stateData.sub;
      if (stateData.apiKey && stateData.apiSecret) {
        customCredentials = { apiKey: stateData.apiKey, apiSecret: stateData.apiSecret };
      }
    } catch (err) {
      console.warn("Zerodha OAuth state token invalid or expired:", err.message);
      return res.redirect(`${env.clientUrl}/accounts?connected=false&message=${encodeURIComponent("OAuth session expired. Please try connecting again.")}`);
    }
  }

  if (!userId) {
    return res.redirect(`${env.clientUrl}/accounts?connected=false&message=${encodeURIComponent("Could not identify user. Please log in and try again.")}`);
  }

  const account = await connectBrokerAccount({
    userId,
    broker: "zerodha",
    authCode: requestToken,
    customCredentials,
  });

  res.redirect(`${env.clientUrl}/accounts?connected=true&account=${encodeURIComponent(account.accountId)}`);
});

export const getReconnectAuthUrl = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const account = await BrokerAccount.findOne({ _id: id, user: req.user._id });
  if (!account) {
    throw new AppError("Broker account not found", 404);
  }

  if (account.broker === "fyers") {
    const adapter = BrokerFactory.getBroker("fyers");
    const stateToken = signOAuthState({ sub: String(req.user._id) });
    const authUrl = adapter.getAuthUrl({}, stateToken);
    return res.json({ url: authUrl });
  }

  if (account.broker === "zerodha") {
    const credentialsPayload = getBrokerAccessToken(account);
    let creds = {};
    try {
      creds = typeof credentialsPayload === "string" ? JSON.parse(credentialsPayload) : credentialsPayload;
    } catch {
      // not JSON
    }

    const apiKey = creds.apiKey;
    const apiSecret = creds.apiSecret;

    if (!apiKey || !apiSecret) {
      throw new AppError("Account does not have stored API credentials. Please re-connect with your API Key and Secret.", 400);
    }

    const adapter = BrokerFactory.getBroker("zerodha");
    const loginUrl = adapter.getAuthUrl({ apiKey, apiSecret });

    const statePayload = {
      sub: String(req.user._id),
      apiKey,
      apiSecret,
      label: account.displayName || "",
    };
    const stateToken = signOAuthState(statePayload);
    const urlWithState = `${loginUrl}&state=${encodeURIComponent(stateToken)}`;

    return res.json({ url: urlWithState });
  }

  throw new AppError(`Unsupported broker: ${account.broker}`, 400);
});

export const listBrokerAccounts = asyncHandler(async (req, res) => {
  const accounts = await BrokerAccount.find({ user: req.user._id, isActive: true }).sort({ createdAt: -1 });
  res.json({ accounts: accounts.map((account) => account.toSafeJSON()) });
});

export const listBrokerPositions = asyncHandler(async (req, res) => {
  const accounts = await BrokerAccount.find({ user: req.user._id, isActive: true }).sort({ createdAt: -1 });
  const results = await Promise.all(accounts.map(async (account) => {
    if (account.broker !== "fyers" && account.broker !== "zerodha") {
      return {
        brokerAccountId: String(account._id),
        broker: account.broker,
        accountId: account.accountId,
        displayName: account.displayName,
        error: `Positions are not yet supported for ${account.broker}`,
        positions: [],
      };
    }

    try {
      const adapter = BrokerFactory.getBroker(account.broker);
      const response = await adapter.getPositions(getBrokerAccessToken(account));
      const positions = (account.broker === "zerodha" ? (response.netPositions || []) : getNetPositions(response))
        .map(normalizePosition)
        .filter((position) => position.netQty !== 0);
      return {
        brokerAccountId: String(account._id),
        broker: account.broker,
        accountId: account.accountId,
        displayName: account.displayName,
        positions,
      };
    } catch (error) {
      return {
        brokerAccountId: String(account._id),
        broker: account.broker,
        accountId: account.accountId,
        displayName: account.displayName,
        error: error.message || "Unable to fetch positions",
        positions: [],
      };
    }
  }));

  res.json({ accounts: results, updatedAt: new Date() });
});

export const listBrokerHoldings = asyncHandler(async (req, res) => {
  const accounts = await BrokerAccount.find({ user: req.user._id, isActive: true }).sort({ createdAt: -1 });
  const results = await Promise.all(accounts.map(async (account) => {
    if (account.broker !== "fyers" && account.broker !== "zerodha") {
      return {
        brokerAccountId: String(account._id),
        broker: account.broker,
        accountId: account.accountId,
        displayName: account.displayName,
        error: `Holdings are not yet supported for ${account.broker}`,
        holdings: [],
      };
    }

    try {
      const adapter = BrokerFactory.getBroker(account.broker);
      const response = await adapter.getHoldings(getBrokerAccessToken(account));
      const rawHoldings = account.broker === "zerodha"
        ? (response.holdings || response.data || [])
        : (response?.holdings || response?.data?.holdings || response?.overall?.holdings || response?.data || (Array.isArray(response) ? response : []));
      const holdings = (Array.isArray(rawHoldings) ? rawHoldings : [])
        .map(normalizeHolding)
        .filter((h) => h.quantity !== 0);

      const totalInvested = holdings.reduce((sum, h) => sum + h.investedValue, 0);
      const totalCurrent = holdings.reduce((sum, h) => sum + h.currentValue, 0);
      const totalPnl = totalCurrent - totalInvested;
      const totalPnlPercentage = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

      return {
        brokerAccountId: String(account._id),
        broker: account.broker,
        accountId: account.accountId,
        displayName: account.displayName,
        holdings,
        summary: {
          totalInvested,
          totalCurrent,
          totalPnl,
          totalPnlPercentage,
          count: holdings.length,
        },
      };
    } catch (error) {
      return {
        brokerAccountId: String(account._id),
        broker: account.broker,
        accountId: account.accountId,
        displayName: account.displayName,
        error: error.message || "Unable to fetch holdings",
        holdings: [],
        summary: { totalInvested: 0, totalCurrent: 0, totalPnl: 0, totalPnlPercentage: 0, count: 0 },
      };
    }
  }));

  res.json({ accounts: results, updatedAt: new Date() });
});

export const listBrokerOrders = asyncHandler(async (req, res) => {
  const accounts = await BrokerAccount.find({ user: req.user._id, isActive: true }).sort({ createdAt: -1 });
  const results = await Promise.all(accounts.map(async (account) => {
    if (account.broker !== "fyers" && account.broker !== "zerodha") {
      return {
        brokerAccountId: String(account._id),
        broker: account.broker,
        accountId: account.accountId,
        displayName: account.displayName,
        error: `Orders are not yet supported for ${account.broker}`,
        orders: [],
      };
    }

    try {
      const adapter = BrokerFactory.getBroker(account.broker);
      const response = await adapter.getOrders(getBrokerAccessToken(account));
      const rawOrders = account.broker === "zerodha"
        ? (response.orderBook || response.orders || (Array.isArray(response) ? response : []))
        : (response?.orderBook || response?.data?.orderBook || response?.orders || response?.data || (Array.isArray(response) ? response : []));
      const orders = (Array.isArray(rawOrders) ? rawOrders : []).map(normalizeBrokerOrder).filter(Boolean);

      return {
        brokerAccountId: String(account._id),
        broker: account.broker,
        accountId: account.accountId,
        displayName: account.displayName,
        orders,
      };
    } catch (error) {
      return {
        brokerAccountId: String(account._id),
        broker: account.broker,
        accountId: account.accountId,
        displayName: account.displayName,
        error: error.message || "Unable to fetch orders",
        orders: [],
      };
    }
  }));

  res.json({ accounts: results, updatedAt: new Date() });
});

export const exitBrokerPositions = asyncHandler(async (req, res) => {
  const { positions } = req.validated.body;
  const accountIds = [...new Set(positions.map(({ brokerAccountId }) => brokerAccountId))];
  const accounts = await BrokerAccount.find({
    _id: { $in: accountIds },
    user: req.user._id,
    isActive: true,
  });
  const accountsById = new Map(accounts.map((account) => [String(account._id), account]));
  if (accountsById.size !== accountIds.length) {
    throw new AppError("One or more selected broker accounts are invalid", 400);
  }

  const results = await Promise.all(positions.map(async ({ brokerAccountId, positionId }) => {
    const account = accountsById.get(brokerAccountId);
    if (account.broker !== "fyers" && account.broker !== "zerodha") {
      return { brokerAccountId, positionId, status: "failed", error: `Position exits are not supported for ${account.broker}` };
    }

    try {
      const adapter = BrokerFactory.getBroker(account.broker);
      const accessToken = getBrokerAccessToken(account);
      const positionsResponse = await adapter.getPositions(accessToken);
      const livePositions = account.broker === "zerodha" 
        ? (positionsResponse.netPositions || [])
        : getNetPositions(positionsResponse);
      const livePosition = livePositions.find((position) => String(position.id || position.tradingsymbol || "") === positionId);
      const netQty = Number(livePosition?.netQty ?? livePosition?.net_qty ?? livePosition?.quantity ?? 0);
      if (!livePosition || netQty === 0) {
        throw new AppError("Position is no longer open; refresh positions", 409);
      }

      const response = await adapter.exitPosition(accessToken, positionId);
      if (response?.s && response.s !== "ok") {
        throw new AppError(response.message || `${account.broker} rejected the position exit`, 502);
      }
      return {
        brokerAccountId,
        accountName: account.displayName,
        positionId,
        symbol: livePosition.symbol || "",
        status: "submitted",
        response,
      };
    } catch (error) {
      return {
        brokerAccountId,
        accountName: account.displayName,
        positionId,
        status: "failed",
        error: error.message || "Unable to exit position",
      };
    }
  }));

  res.json({
    results,
    submitted: results.filter((result) => result.status === "submitted").length,
    failed: results.filter((result) => result.status === "failed").length,
  });
});

export const listBrokerFunds = asyncHandler(async (req, res) => {
  const accounts = await BrokerAccount.find({ user: req.user._id, isActive: true }).sort({ createdAt: -1 });
  const results = await Promise.all(accounts.map(async (account) => {
    if (account.broker !== "fyers" && account.broker !== "zerodha") {
      return {
        brokerAccountId: String(account._id),
        broker: account.broker,
        accountId: account.accountId,
        displayName: account.displayName,
        funds: { availableCash: 0, availableMargin: 0, usedMargin: 0, collateral: 0 },
        error: `Funds not supported for ${account.broker}`,
      };
    }

    try {
      const adapter = BrokerFactory.getBroker(account.broker);
      const raw = await adapter.getFunds(getBrokerAccessToken(account));
      const funds = normalizeFunds(account.broker, raw);
      return {
        brokerAccountId: String(account._id),
        broker: account.broker,
        accountId: account.accountId,
        displayName: account.displayName,
        funds,
      };
    } catch (err) {
      return {
        brokerAccountId: String(account._id),
        broker: account.broker,
        accountId: account.accountId,
        displayName: account.displayName,
        funds: { availableCash: 0, availableMargin: 0, usedMargin: 0, collateral: 0 },
        error: err.message || "Failed to fetch funds",
      };
    }
  }));

  res.json({ accounts: results, updatedAt: new Date() });
});

export const killSwitchPanicSquareOff = asyncHandler(async (req, res) => {
  const accounts = await BrokerAccount.find({ user: req.user._id, isActive: true }).sort({ createdAt: -1 });

  // 1. Scope to ONLY orders and positions placed via this console
  const consoleExecutions = await OrderExecution.find({
    user: req.user._id,
    brokerOrderId: { $exists: true, $ne: "" },
  }).select("brokerAccount brokerOrderId status").lean();

  const consoleBatches = await OrderBatch.find({ user: req.user._id }).select("order orders").lean();
  const consoleSymbols = new Set();
  consoleBatches.forEach((b) => {
    const list = Array.isArray(b.orders) && b.orders.length > 0 ? b.orders : [b.order];
    list.filter(Boolean).forEach((o) => {
      if (o.symbol) consoleSymbols.add(String(o.symbol).trim().toUpperCase());
    });
  });

  const consoleOrderIdsByAccount = new Map();
  consoleExecutions.forEach((exec) => {
    const accId = String(exec.brokerAccount);
    if (!consoleOrderIdsByAccount.has(accId)) {
      consoleOrderIdsByAccount.set(accId, new Set());
    }
    consoleOrderIdsByAccount.get(accId).add(String(exec.brokerOrderId));
  });

  const accountReports = await Promise.all(accounts.map(async (account) => {
    const report = {
      brokerAccountId: String(account._id),
      broker: account.broker,
      displayName: account.displayName,
      cancelledOrders: [],
      exitedPositions: [],
      errors: [],
    };

    if (account.broker !== "fyers" && account.broker !== "zerodha") {
      return report;
    }

    const adapter = BrokerFactory.getBroker(account.broker);
    const token = getBrokerAccessToken(account);
    const consoleOrderIds = consoleOrderIdsByAccount.get(String(account._id)) || new Set();

    // 1. Cancel ONLY console-placed open/pending orders
    try {
      const ordersRes = await adapter.getOrders(token);
      const rawOrders = account.broker === "zerodha"
        ? (ordersRes.orderBook || [])
        : (ordersRes.orderBook || ordersRes.data?.orderBook || ordersRes.orders || []);

      const openOrders = rawOrders.filter((o) => {
        const orderId = String(o.id || o.order_id || o.orderId);
        const s = String(o.status || "").toUpperCase();
        const isOpen = ["OPEN", "TRIGGER PENDING", "PENDING", "MODIFY PENDING", "PUT ORDER REQ RECEIVED"].includes(s);
        // Only cancel if this order ID was originated by this console
        return isOpen && consoleOrderIds.has(orderId);
      });

      for (const order of openOrders) {
        const orderId = String(order.id || order.order_id || order.orderId);
        try {
          await adapter.cancelOrder(token, orderId, order.variety || "regular");
          report.cancelledOrders.push(orderId);
        } catch (err) {
          report.errors.push(`Failed to cancel console order ${orderId}: ${err.message}`);
        }
      }
    } catch (err) {
      report.errors.push(`Orderbook fetch failed: ${err.message}`);
    }

    // 2. Square off ONLY positions corresponding to console-traded symbols
    try {
      const posRes = await adapter.getPositions(token);
      const positions = (account.broker === "zerodha" ? (posRes.netPositions || []) : getNetPositions(posRes))
        .map(normalizePosition)
        .filter((p) => {
          const sym = String(p.symbol || "").trim().toUpperCase();
          return p.netQty !== 0 && consoleSymbols.has(sym);
        });

      for (const pos of positions) {
        try {
          await adapter.exitPosition(token, pos.id);
          report.exitedPositions.push({ symbol: pos.symbol, netQty: pos.netQty });
        } catch (err) {
          report.errors.push(`Failed to exit console position ${pos.symbol}: ${err.message}`);
        }
      }
    } catch (err) {
      report.errors.push(`Positions fetch failed: ${err.message}`);
    }

    return report;
  }));

  const totalCancelled = accountReports.reduce((sum, r) => sum + r.cancelledOrders.length, 0);
  const totalExited = accountReports.reduce((sum, r) => sum + r.exitedPositions.length, 0);

  res.json({
    message: `Console Kill switch executed: ${totalCancelled} console open orders cancelled, ${totalExited} console positions squared off. External orders were untouched.`,
    totalCancelled,
    totalExited,
    accounts: accountReports,
  });
});

export const createBrokerAccount = asyncHandler(async (req, res) => {
  const account = await createManualBrokerAccount({
    userId: req.user._id,
    ...req.validated.body,
  });

  res.status(201).json({ account });
});

export const listAllAdminBrokerAccounts = asyncHandler(async (req, res) => {
  const accounts = await BrokerAccount.find()
    .populate("user", "name email")
    .sort({ createdAt: -1 });

  res.json({
    accounts: accounts.map((account) => ({
      id: account._id,
      broker: account.broker,
      accountId: account.accountId,
      displayName: account.displayName,
      profile: account.profile,
      isActive: account.isActive,
      user: account.user ? {
        id: account.user._id,
        name: account.user.name,
        email: account.user.email,
      } : null,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    })),
  });
});

export const revokeAdminBrokerAccount = asyncHandler(async (req, res) => {
  const account = await BrokerAccount.findByIdAndUpdate(
    req.validated.params.id,
    { isActive: false },
    { new: true },
  ).populate("user", "name email");

  if (!account) {
    throw new AppError("Broker account not found", 404);
  }

  res.json({
    message: "Broker account revoked successfully",
    account: {
      id: account._id,
      accountId: account.accountId,
      displayName: account.displayName,
      isActive: account.isActive,
    },
  });
});

export const activateAdminBrokerAccount = asyncHandler(async (req, res) => {
  const account = await BrokerAccount.findByIdAndUpdate(
    req.validated.params.id,
    { isActive: true },
    { new: true },
  ).populate("user", "name email");

  if (!account) {
    throw new AppError("Broker account not found", 404);
  }

  res.json({
    message: "Broker account reactivated successfully",
    account: {
      id: account._id,
      accountId: account.accountId,
      displayName: account.displayName,
      isActive: account.isActive,
    },
  });
});

export const deleteBrokerAccount = asyncHandler(async (req, res) => {
  const account = await BrokerAccount.findOneAndUpdate(
    { _id: req.validated.params.id, user: req.user._id },
    { isActive: false },
    { new: true },
  );

  if (!account) {
    throw new AppError("Broker account not found", 404);
  }

  res.json({ message: "Broker account removed" });
});
