import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export const signToken = (userId, csrfToken) => jwt.sign({ sub: userId, csrfToken }, env.jwtSecret, {
  expiresIn: env.jwtExpiresIn,
});

export const signTwoFactorChallenge = (userId, challengeId) => jwt.sign(
  { sub: userId, purpose: "two-factor-login", jti: challengeId },
  env.jwtSecret,
  { expiresIn: "5m" },
);

export const verifyToken = (token) => jwt.verify(token, env.jwtSecret);

/**
 * Sign a short-lived state token for OAuth flows.
 * Embeds user ID, credentials (encrypted separately), and purpose.
 */
export const signOAuthState = (payload) => jwt.sign(
  { purpose: "oauth-state", ...payload },
  env.jwtSecret,
  { expiresIn: "10m" },
);

export const verifyOAuthState = (token) => {
  const decoded = jwt.verify(token, env.jwtSecret);
  if (decoded.purpose !== "oauth-state") throw new Error("Invalid OAuth state token");
  return decoded;
};
