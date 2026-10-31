import dotenv from "dotenv";

dotenv.config();

const requiredInProduction = [
  "MONGO_URI",
  "JWT_SECRET",
  "BROKER_TOKEN_ENCRYPTION_KEY",
  "AUTH_SECRET_ENCRYPTION_KEY",
  "ADMIN_EMAILS",
  "FYERS_APP_ID",
  "FYERS_SECRET_KEY",
  "FYERS_REDIRECT_URL",
];

if (process.env.NODE_ENV === "production") {
  for (const key of requiredInProduction) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
}

export const env = {
  port: process.env.PORT || 8001,
  mongoUri: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/multi_broker_trading",
  jwtSecret: process.env.JWT_SECRET || "change-this-dev-jwt-secret",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  adminEmails: (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
  brokerTokenEncryptionKey: process.env.BROKER_TOKEN_ENCRYPTION_KEY || "change-this-32-byte-dev-secret-key",
  authSecretEncryptionKey: process.env.AUTH_SECRET_ENCRYPTION_KEY || "change-this-dev-auth-encryption-key",
  redisUrl: process.env.REDIS_URL || "redis://127.0.0.1:6379",
  orderQueue: {
    name: process.env.ORDER_QUEUE_NAME || "order-execution",
    concurrency: Number(process.env.ORDER_QUEUE_CONCURRENCY || 10),
    attempts: Number(process.env.ORDER_QUEUE_ATTEMPTS || 1),
    backoffMs: Number(process.env.ORDER_QUEUE_BACKOFF_MS || 250),
    workerEnabled: process.env.ORDER_WORKER_ENABLED !== "false",
  },
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || "")
      .split(",")
      .map((broker) => broker.trim())
      .filter(Boolean),
    clientId: process.env.KAFKA_CLIENT_ID || "multi-broker-trading",
    orderEventsTopic: process.env.KAFKA_ORDER_EVENTS_TOPIC || "order-events",
  },
  fyers: {
    appId: process.env.FYERS_APP_ID || "",
    secretKey: process.env.FYERS_SECRET_KEY || "",
    redirectUrl: process.env.FYERS_REDIRECT_URL || "http://localhost:8001/api/v1/broker-accounts/fyers/callback",
    nseFoSymbolMasterUrl: process.env.FYERS_NSE_FO_SYMBOL_MASTER_URL || "https://public.fyers.in/sym_details/NSE_FO.csv",
  },
  zerodha: {
    redirectUrl: process.env.ZERODHA_REDIRECT_URL || "http://localhost:8001/api/v1/broker-accounts/zerodha/callback",
  },
  email: {
    service: process.env.EMAIL_SERVICE || "", // e.g. "gmail" or empty if using host/port
    resendApiKey: process.env.RESEND_API_KEY || "", // HTTP-based email API (works on Render free tier)
    smtpHost: process.env.SMTP_HOST || "",
    smtpPort: Number(process.env.SMTP_PORT || 587),
    smtpSecure: process.env.SMTP_SECURE === "true",
    smtpUser: process.env.SMTP_USER || "",
    smtpPass: process.env.SMTP_PASS || "",
    from: process.env.EMAIL_FROM || "",
  },
};
