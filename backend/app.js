import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { env } from "./src/config/env.js";
import authRoutes from "./src/routes/auth.routes.js";
import brokerAccountRoutes from "./src/routes/brokerAccount.routes.js";
import instrumentRoutes from "./src/routes/instrument.routes.js";
import orderRoutes from "./src/routes/order.routes.js";

const app = express();

// Trust reverse proxy (Render load balancer) so express-rate-limit and IP detection work correctly
app.set("trust proxy", 1);

app.use(helmet());
app.use(cors({
  origin: env.clientUrl,
  credentials: true,
}));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
}));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get("/api/v1/health-management", (req, res) => {
  res.status(200).json({ message: "Health Management API is running!" });
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/broker-accounts", brokerAccountRoutes);
app.use("/api/v1/instruments", instrumentRoutes);
app.use("/api/v1/orders", orderRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use((err, req, res, next) => {
  const status = err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === "production";

  // Prevent leakage of raw stack traces, tokens, or broker secrets in 500 errors
  let safeMessage = err.message || "Internal server error";
  if (status >= 500 && isProduction) {
    safeMessage = "An internal server error occurred. Please contact support.";
  }

  res.status(status).json({
    message: safeMessage,
    ...(isProduction ? {} : { details: err.details }),
  });
});

export default app;
