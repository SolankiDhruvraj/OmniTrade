/**
 * Utility to identify whether a broker response or caught error indicates that
 * the broker's daily session token / OAuth access token has expired or is invalid.
 *
 * Broker-specific indicators:
 * - Fyers:
 *   - Error codes: -8 (token expired), -15, -16 (invalid access token), -17 (token expired/invalid), 401
 *   - Messages: "token expired", "invalid token", "access token expired", "session expired", "please authenticate"
 *   - s: "error" with code/message matching above
 * - Zerodha Kite:
 *   - Kite Connect TokenException
 *   - HTTP 403 Forbidden with error_type: "TokenException"
 *   - Messages: "Incorrect `api_key` or `access_token`", "TokenException", "Session expired", "Invalid token"
 */

export const AUTH_EXPIRED_MESSAGE = "Auth expired, please authenticate your broker account again";

export const isBrokerAuthExpired = (error, broker) => {
  if (!error) return false;

  const code = error?.code || error?.status_code || error?.statusCode || error?.response?.status || error?.status || error?.data?.code;
  const errorType = error?.error_type || error?.response?.data?.error_type || error?.data?.error_type || "";
  const rawMsg = [
    error?.message,
    error?.response?.data?.message,
    error?.data?.message,
    error?.description,
    typeof error === "string" ? error : "",
  ].filter(Boolean).join(" ").toLowerCase();

  // Check HTTP 401 / 403 status or TokenException
  if (code === 401 || code === 403 || errorType === "TokenException") {
    return true;
  }

  // Fyers explicit codes (-8, -15, -16, -17)
  const fyersExpiredCodes = new Set([-8, -15, -16, -17, "-8", "-15", "-16", "-17"]);
  if (fyersExpiredCodes.has(code)) {
    return true;
  }

  // Common keywords across both brokers
  const expiryKeywords = [
    "token expired",
    "access token expired",
    "token has expired",
    "invalid token",
    "invalid access token",
    "tokenexception",
    "incorrect `api_key` or `access_token`",
    "incorrect api_key or access_token",
    "session expired",
    "please authenticate",
    "user session has expired",
    "invalid session",
    "session is expired",
    "auth expired",
  ];

  return expiryKeywords.some((keyword) => rawMsg.includes(keyword));
};
