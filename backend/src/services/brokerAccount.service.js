import { BrokerFactory } from "../brokers/BrokerFactory.js";
import { BrokerAccount } from "../models/BrokerAccount.js";
import { decryptText, encryptText } from "../utils/crypto.js";
import { createAuditLog } from "./auditLog.service.js";

const pickProfileData = (profileResponse) => profileResponse?.data || profileResponse || {};
const secretFieldNames = new Set(["apiKey", "apiSecret", "accessToken", "refreshToken", "totpSecret", "password", "pin"]);

export const connectBrokerAccount = async ({ userId, broker, authCode, customCredentials = {} }) => {
  const adapter = BrokerFactory.getBroker(broker);
  // Exchange auth code using per-account credentials if provided (supports multi-account Zerodha)
  const accessToken = await adapter.exchangeAuthCode(authCode, customCredentials);

  // For Zerodha: wrap access token + apiKey so it can be resolved later for API calls.
  // For Fyers: access token is a plain string.
  let credentialPayload;
  if (broker === "zerodha" && customCredentials.apiKey) {
    credentialPayload = JSON.stringify({
      accessToken,
      apiKey: customCredentials.apiKey,
      apiSecret: customCredentials.apiSecret,
    });
  } else {
    credentialPayload = accessToken;
  }

  const profileResponse = await adapter.getProfile(credentialPayload);
  const profile = pickProfileData(profileResponse);
  const accountId = profile.fy_id || profile.client_id || profile.id || profile.email_id || `${broker}-${Date.now()}`;
  const displayName = profile.name || profile.display_name || profile.fy_id || `${broker.toUpperCase()} account`;

  const account = await BrokerAccount.findOneAndUpdate(
    { user: userId, broker, accountId },
    {
      user: userId,
      broker,
      accountId,
      displayName,
      encryptedAccessToken: encryptText(credentialPayload),
      profile,
      isActive: true,
      authStatus: "active",
      authExpiredAt: null,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  createAuditLog({
    userId,
    action: "broker_account_authenticated",
    category: "broker",
    status: "success",
    message: `${broker.toUpperCase()} account "${displayName}" (${accountId}) was successfully authenticated`,
    metadata: { broker, accountId, displayName },
  });

  return account.toSafeJSON();
};

export const createManualBrokerAccount = async ({ userId, broker, accountId, displayName, credentials = {}, notes = "" }) => {
  const sanitizedCredentials = Object.fromEntries(
    Object.entries(credentials).filter(([, value]) => typeof value === "string" && value.trim()),
  );
  const credentialFields = Object.keys(sanitizedCredentials).filter((field) => secretFieldNames.has(field));

  // Store credentials as JSON payload so individual apiKey / apiSecret / accessToken can be resolved
  const credentialsPayload = JSON.stringify(sanitizedCredentials);

  let profileData = {
    connectionType: "manual",
    credentialFields,
    notes,
  };

  // If user provided an active accessToken, verify and fetch live profile
  if (sanitizedCredentials.accessToken) {
    try {
      const adapter = BrokerFactory.getBroker(broker);
      const profileResponse = await adapter.getProfile(credentialsPayload);
      profileData = {
        ...profileData,
        ...pickProfileData(profileResponse),
      };
    } catch (err) {
      console.warn(`Could not fetch profile for manual ${broker} account:`, err.message);
    }
  }

  const account = await BrokerAccount.findOneAndUpdate(
    { user: userId, broker, accountId },
    {
      user: userId,
      broker,
      accountId,
      displayName,
      encryptedAccessToken: encryptText(credentialsPayload),
      profile: profileData,
      isActive: true,
      authStatus: "active",
      authExpiredAt: null,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  createAuditLog({
    userId,
    action: "broker_account_added",
    category: "broker",
    status: "success",
    message: `Manual ${broker.toUpperCase()} account "${displayName}" (${accountId}) was added`,
    metadata: { broker, accountId, displayName, connectionType: "manual" },
  });

  return account.toSafeJSON();
};

export const getBrokerAccessToken = (brokerAccount) => decryptText(brokerAccount.encryptedAccessToken);
