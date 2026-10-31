import crypto from "crypto";
import { User } from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { verifyToken } from "../utils/jwt.js";

export const requireAuth = asyncHandler(async (req, res, next) => {
  // Support both cookie-based auth AND Authorization: Bearer <token> header (essential for mobile browsers blocking 3rd-party cookies)
  const authHeader = req.get("Authorization") || "";
  const headerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  const token = req.cookies?.token || headerToken;

  if (!token) {
    throw new AppError("Authentication required", 401);
  }

  let decoded;
  try {
    decoded = verifyToken(token);
  } catch {
    res.clearCookie("token", {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    throw new AppError("Session is invalid or expired; sign in again", 401);
  }
  if (decoded.purpose === "two-factor-login") {
    throw new AppError("Complete two-factor verification first", 401);
  }
  if (!decoded.csrfToken) {
    throw new AppError("Session expired; sign in again", 401);
  }

  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    const suppliedToken = req.get("X-CSRF-Token") || "";
    const expected = Buffer.from(decoded.csrfToken);
    const supplied = Buffer.from(suppliedToken);
    if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) {
      throw new AppError("CSRF token is missing or invalid", 403);
    }
  }

  const user = await User.findById(decoded.sub).select("-passwordHash");

  if (!user) {
    throw new AppError("User no longer exists", 401);
  }

  req.auth = decoded;
  req.user = user;
  next();
});
