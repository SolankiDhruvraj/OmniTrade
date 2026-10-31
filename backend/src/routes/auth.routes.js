import { Router } from "express";
import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";
import {
	acceptInvitation,
	acceptInvitationSchema,
	createInvitation,
	createInvitationSchema,
	disableTwoFactor,
	enableTwoFactor,
	login,
	loginSchema,
	logout,
	me,
	register,
	registerSchema,
	startTwoFactorSetup,
	twoFactorDisableSchema,
	twoFactorEnableSchema,
	twoFactorLoginSchema,
	twoFactorStatus,
	validateInvitation,
	validateInvitationSchema,
	verifyTwoFactorLogin,
	listInvitations,
	listInvitationsSchema,
	revokeInvitation,
	revokeInvitationSchema,
	requestPasswordReset,
	resetPasswordWithToken,
	changePassword,
	forgotPasswordSchema,
	resetPasswordSchema,
	changePasswordSchema,
} from "../controllers/auth.controller.js";
import { requireAuth } from "../middlewares/auth.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";
import { validate } from "../middlewares/validate.js";

const router = Router();
const requireTrustedOrigin = (req, res, next) => {
	const origin = req.get("Origin");
	if (origin && origin !== env.clientUrl) {
		throw new AppError("Request origin is not allowed", 403);
	}
	next();
};

const loginLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 20,
	standardHeaders: true,
	legacyHeaders: false,
});
const twoFactorLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 10,
	standardHeaders: true,
	legacyHeaders: false,
});
const invitationLimiter = rateLimit({
	windowMs: 60 * 60 * 1000,
	limit: 20,
	standardHeaders: true,
	legacyHeaders: false,
});

const forgotPasswordLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 5,
	standardHeaders: true,
	legacyHeaders: false,
});

router.post("/register", requireTrustedOrigin, register);
router.post("/login", requireTrustedOrigin, loginLimiter, validate(loginSchema), login);
router.post("/forgot-password", requireTrustedOrigin, forgotPasswordLimiter, validate(forgotPasswordSchema), requestPasswordReset);
router.post("/reset-password", requireTrustedOrigin, forgotPasswordLimiter, validate(resetPasswordSchema), resetPasswordWithToken);
router.post("/change-password", requireAuth, requireTrustedOrigin, validate(changePasswordSchema), changePassword);
router.post("/2fa/login", requireTrustedOrigin, twoFactorLimiter, validate(twoFactorLoginSchema), verifyTwoFactorLogin);
router.get("/invitations/validate", validate(validateInvitationSchema), validateInvitation);
router.post("/invitations/accept", requireTrustedOrigin, invitationLimiter, validate(acceptInvitationSchema), acceptInvitation);
router.get("/invitations", requireAuth, requireAdmin, validate(listInvitationsSchema), listInvitations);
router.post("/invitations", requireAuth, requireAdmin, requireTrustedOrigin, invitationLimiter, validate(createInvitationSchema), createInvitation);
router.delete("/invitations/:id", requireAuth, requireAdmin, requireTrustedOrigin, validate(revokeInvitationSchema), revokeInvitation);
router.get("/me", requireAuth, me);
router.post("/logout", requireAuth, logout);
router.get("/2fa/status", requireAuth, twoFactorStatus);
router.post("/2fa/setup", requireAuth, twoFactorLimiter, startTwoFactorSetup);
router.post("/2fa/enable", requireAuth, twoFactorLimiter, validate(twoFactorEnableSchema), enableTwoFactor);
router.post("/2fa/disable", requireAuth, twoFactorLimiter, validate(twoFactorDisableSchema), disableTwoFactor);

export default router;
