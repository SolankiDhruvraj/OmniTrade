import { AppError } from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { isAdminUser } from "../utils/adminAccess.js";

export const requireAdmin = asyncHandler(async (req, res, next) => {
  if (!isAdminUser(req.user)) {
    throw new AppError("Administrator access required", 403);
  }
  next();
});