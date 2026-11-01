import { createRequire } from "module";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";

const require = createRequire(import.meta.url);
const { fyersModel } = require("fyers-api-v3");

const parseCredentials = (tokenOrJson) => {
  if (!tokenOrJson) return { accessToken: "" };
  if (typeof tokenOrJson === "object") return tokenOrJson;
  try {
    const parsed = JSON.parse(tokenOrJson);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed;
    }
  } catch {
    // Plain access token string
  }
  return { accessToken: tokenOrJson };
};

export class FyersBrokerAdapter {
  constructor() {
    this.name = "fyers";
  }

  createClient(credentialsData = "") {
    const creds = parseCredentials(credentialsData);
    const appId = creds.apiKey || creds.appId || env.fyers.appId;
    const redirectUrl = creds.redirectUrl || env.fyers.redirectUrl;
    const accessToken = creds.accessToken || (typeof credentialsData === "string" ? credentialsData : "");

    const fyers = new fyersModel();
    if (appId) {
      fyers.setAppId(appId);
    }
    if (redirectUrl) {
      fyers.setRedirectUrl(redirectUrl);
    }
    if (accessToken) {
      fyers.setAccessToken(accessToken);
    }

    return fyers;
  }

  assertConfigured(credentials = {}) {
    const appId = credentials.apiKey || credentials.appId || env.fyers.appId;
    const secretKey = credentials.apiSecret || credentials.secretKey || env.fyers.secretKey;
    const redirectUrl = credentials.redirectUrl || env.fyers.redirectUrl;

    if (!appId || !secretKey || !redirectUrl) {
      throw new AppError("Fyers credentials (appId, secretKey) are required", 400);
    }
    return { appId, secretKey, redirectUrl };
  }

  getAuthUrl(customCredentials = {}, state = "") {
    const config = this.assertConfigured(customCredentials);
    const fyers = new fyersModel();
    fyers.setAppId(config.appId);
    fyers.setRedirectUrl(config.redirectUrl);
    return fyers.generateAuthCode(state ? { state } : undefined);
  }

  async exchangeAuthCode(authCode, customCredentials = {}) {
    const config = this.assertConfigured(customCredentials);
    const fyers = new fyersModel();
    fyers.setAppId(config.appId);
    fyers.setRedirectUrl(config.redirectUrl);

    const response = await fyers.generate_access_token({
      client_id: config.appId,
      secret_key: config.secretKey,
      auth_code: authCode,
    });

    if (response?.s !== "ok" || !response.access_token) {
      throw new AppError("Unable to connect Fyers account", 400, response);
    }

    return response.access_token;
  }

  async getProfile(credentialsData) {
    const fyers = this.createClient(credentialsData);
    const response = await fyers.get_profile();

    if (response?.s && response.s !== "ok") {
      throw new AppError(response.message || "Unable to fetch Fyers profile", 400, response);
    }

    return response;
  }

  async getPositions(credentialsData) {
    return this.createClient(credentialsData).get_positions();
  }

  async getHoldings(credentialsData) {
    return this.createClient(credentialsData).get_holdings();
  }

  async getFunds(credentialsData) {
    return this.createClient(credentialsData).get_funds();
  }

  async cancelOrder(credentialsData, orderId) {
    return this.createClient(credentialsData).cancel_order({ id: orderId });
  }

  async getOrders(credentialsData) {
    const fyers = this.createClient(credentialsData);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        resolve({ orderBook: [] });
      }, 5000);

      fyers.get_orders()
        .then((res) => {
          clearTimeout(timer);
          resolve(res || { orderBook: [] });
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  async exitPosition(credentialsData, positionId) {
    return this.createClient(credentialsData).exit_position({ id: positionId });
  }

  async getOptionChain(credentialsData, params) {
    return this.createClient(credentialsData).getOptionChain(params);
  }

  async getHistory(credentialsData, params) {
    return this.createClient(credentialsData).getHistory(params);
  }

  async placeOrder(credentialsData, order) {
    return this.createClient(credentialsData).place_order(order);
  }

  async placeMultiOrder(credentialsData, orders) {
    return this.createClient(credentialsData).place_multi_order(orders);
  }
}
