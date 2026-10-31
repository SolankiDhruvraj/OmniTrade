import https from "node:https";
import { KiteConnect } from "kiteconnect";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";

// Reusable HTTPS agent with TCP Keep-Alive for pooled, low-latency requests
const sharedHttpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 1000,
  maxSockets: 100,
  maxFreeSockets: 20,
  timeout: 10000,
});

const parseCredentials = (tokenOrJson) => {
  if (!tokenOrJson) return { accessToken: "" };
  if (typeof tokenOrJson === "object") return tokenOrJson;
  try {
    const parsed = JSON.parse(tokenOrJson);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed;
    }
  } catch {
    // Plain string
  }
  return { accessToken: tokenOrJson };
};

export class ZerodhaBrokerAdapter {
  constructor() {
    this.name = "zerodha";
  }

  createClient(credentialsData = "") {
    const creds = parseCredentials(credentialsData);
    const apiKey = creds.apiKey || "";
    const accessToken = creds.accessToken || (typeof credentialsData === "string" ? credentialsData : "");

    const kc = new KiteConnect({
      api_key: apiKey,
      access_token: accessToken || undefined,
    });
    if (kc.requestInstance?.defaults) {
      kc.requestInstance.defaults.httpsAgent = sharedHttpsAgent;
    }
    return kc;
  }

  assertConfigured(credentials = {}) {
    const apiKey = credentials.apiKey;
    const apiSecret = credentials.apiSecret;

    if (!apiKey || !apiSecret) {
      throw new AppError("Zerodha API Key & Secret are required to connect this account. Please enter them in the connection prompt.", 400);
    }
    return { apiKey, apiSecret };
  }

  getAuthUrl(customCredentials = {}) {
    const config = this.assertConfigured(customCredentials);
    const kc = new KiteConnect({ api_key: config.apiKey });
    return kc.getLoginURL();
  }

  async exchangeAuthCode(requestToken, customCredentials = {}) {
    const config = this.assertConfigured(customCredentials);
    const kc = new KiteConnect({ api_key: config.apiKey });
    try {
      const response = await kc.generateSession(requestToken, config.apiSecret);
      if (!response?.access_token) {
        throw new AppError("Unable to connect Zerodha account: missing access token", 400, response);
      }
      return response.access_token;
    } catch (err) {
      throw new AppError(err.message || "Failed to exchange Zerodha request token", 400, err);
    }
  }

  async getProfile(credentialsData) {
    try {
      const kc = this.createClient(credentialsData);
      const profile = await kc.getProfile();
      return profile;
    } catch (err) {
      throw new AppError(err.message || "Unable to fetch Zerodha profile", 400, err);
    }
  }

  async getPositions(credentialsData) {
    try {
      const kc = this.createClient(credentialsData);
      const positions = await kc.getPositions();
      return {
        s: "ok",
        netPositions: positions.net || [],
      };
    } catch (err) {
      throw new AppError(err.message || "Unable to fetch Zerodha positions", 400, err);
    }
  }

  async getHoldings(credentialsData) {
    try {
      const kc = this.createClient(credentialsData);
      const holdings = await kc.getHoldings();
      return {
        s: "ok",
        holdings: holdings || [],
      };
    } catch (err) {
      throw new AppError(err.message || "Unable to fetch Zerodha holdings", 400, err);
    }
  }

  async getFunds(credentialsData) {
    try {
      const kc = this.createClient(credentialsData);
      const margins = await kc.getMargins();
      return {
        s: "ok",
        margins: margins || {},
      };
    } catch (err) {
      throw new AppError(err.message || "Unable to fetch Zerodha margins", 400, err);
    }
  }

  async cancelOrder(credentialsData, orderId, variety = "regular") {
    try {
      const kc = this.createClient(credentialsData);
      const res = await kc.cancelOrder(variety, orderId);
      return {
        s: "ok",
        order_id: res?.order_id || orderId,
      };
    } catch (err) {
      throw new AppError(err.message || "Unable to cancel Zerodha order", 400, err);
    }
  }

  async getOrders(credentialsData) {
    try {
      const kc = this.createClient(credentialsData);
      const orders = await Promise.race([
        kc.getOrders(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Zerodha orderbook timeout")), 5000)),
      ]);
      return {
        s: "ok",
        orderBook: orders || [],
      };
    } catch (err) {
      return {
        s: "error",
        message: err.message || "Unable to fetch Zerodha orders",
        orderBook: [],
      };
    }
  }

  async exitPosition(credentialsData, positionId) {
    const kc = this.createClient(credentialsData);
    return kc.placeOrder("regular", {
      variety: "regular",
      tradingsymbol: positionId,
      exchange: "NFO",
      transaction_type: "SELL",
      order_type: "MARKET",
      product: "NRML",
      quantity: 1,
    });
  }

  async placeOrder(credentialsData, order) {
    try {
      const kc = this.createClient(credentialsData);
      const variety = order.variety || "regular";
      const params = {
        exchange: order.exchange || "NFO",
        tradingsymbol: order.symbol || order.tradingsymbol,
        transaction_type: (order.side === 1 || order.side === "BUY" || order.transaction_type === "BUY") ? "BUY" : "SELL",
        quantity: Number(order.qty || order.quantity),
        product: order.productType || order.product || "NRML",
        order_type: order.type === 2 ? "MARKET" : (order.order_type || "LIMIT"),
        price: Number(order.limitPrice || order.price || 0),
        trigger_price: Number(order.stopPrice || order.trigger_price || 0),
        validity: order.validity || "DAY",
      };

      const response = await kc.placeOrder(variety, params);
      return {
        s: "ok",
        id: response.order_id,
        order_id: response.order_id,
      };
    } catch (err) {
      throw new AppError(err.message || "Zerodha order placement failed", 400, err);
    }
  }

  async placeMultiOrder(credentialsData, orders) {
    const results = [];
    for (const order of orders) {
      const res = await this.placeOrder(credentialsData, order);
      results.push(res);
    }
    return {
      s: "ok",
      data: results,
    };
  }
}
