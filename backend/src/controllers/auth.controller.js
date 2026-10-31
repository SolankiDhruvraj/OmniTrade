import crypto from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import QRCode from "qrcode";
import { generateSecret, generateURI, verify as verifyTotp } from "otplib";
import { User } from "../models/User.js";
import { UserInvitation } from "../models/UserInvitation.js";
import { AppError } from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { decryptAuthSecret, encryptAuthSecret } from "../utils/crypto.js";
import { signToken, signTwoFactorChallenge, verifyToken } from "../utils/jwt.js";
import { isAdminUser } from "../utils/adminAccess.js";
import { env } from "../config/env.js";
import { sendInvitationEmail, sendPasswordResetEmail } from "../services/email.service.js";

const issuer = "F&O Console";
const recoveryCodeCount = 8;
const totpStepSeconds = 30;

const invalidCodeError = () => new AppError("Invalid or expired verification code", 401);

const verifyTotpCode = async (secret, token) => {
  // Allow a 1-step window (±30s to ±60s clock drift tolerance)
  const result = await verifyTotp({ secret, token, epochTolerance: 60 });
  if (!result.valid) return null;
  return typeof result.delta === "number"
    ? Math.floor(Date.now() / (totpStepSeconds * 1000)) + result.delta
    : Math.floor(Date.now() / (totpStepSeconds * 1000));
};

const consumeTotpCode = async (userId, encryptedSecret, token, challengeId) => {
  const counter = await verifyTotpCode(decryptAuthSecret(encryptedSecret), token.trim());
  if (counter === null) return false;

  const filter = {
    _id: userId,
    totpEnabled: true,
  };

  // If a login challenge was issued, consume and invalidate the challengeId
  const update = { $set: { lastTotpCounter: counter } };
  if (challengeId) {
    filter.activeTwoFactorChallengeId = challengeId;
    filter.activeTwoFactorChallengeExpiresAt = { $gt: new Date() };
    update.$unset = {
      activeTwoFactorChallengeId: 1,
      activeTwoFactorChallengeExpiresAt: 1,
    };
  }

  const result = await User.updateOne(filter, update);

  return result.modifiedCount === 1;
};

const consumeRecoveryCode = async (user, token, challengeId) => {
  let matchedHash;
  for (const hash of user.totpRecoveryCodeHashes || []) {
    if (await bcrypt.compare(token.toUpperCase(), hash)) {
      matchedHash = hash;
      break;
    }
  }
  if (!matchedHash) return false;

  const filter = {
    _id: user._id,
    totpRecoveryCodeHashes: matchedHash,
  };
  const update = { $pull: { totpRecoveryCodeHashes: matchedHash } };
  if (challengeId) {
    filter.activeTwoFactorChallengeId = challengeId;
    filter.activeTwoFactorChallengeExpiresAt = { $gt: new Date() };
    update.$unset = {
      activeTwoFactorChallengeId: 1,
      activeTwoFactorChallengeExpiresAt: 1,
    };
  }

  const result = await User.updateOne(filter, update);

  return result.modifiedCount === 1;
};

const consumeSecondFactor = async (user, token, challengeId) => {
  if (/^\d{6}$/.test(token)) {
    return consumeTotpCode(user._id, user.totpSecret, token, challengeId);
  }
  return consumeRecoveryCode(user, token, challengeId);
};

export const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(8),
  }),
});

const invitationTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export const createInvitationSchema = z.object({
  body: z.object({ email: z.string().trim().email().max(254) }),
});

export const revokeInvitationSchema = z.object({
  params: z.object({ id: z.string().regex(/^[0-9a-fA-F]{24}$/) }),
});

export const listInvitationsSchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    status: z.string().optional(),
    search: z.string().optional(),
  }),
});

export const validateInvitationSchema = z.object({
  query: z.object({ token: invitationTokenSchema }),
});

export const acceptInvitationSchema = z.object({
  body: z.object({
    token: invitationTokenSchema,
    name: z.string().trim().min(2).max(100),
    password: z.string().min(12).max(128),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({ email: z.string().trim().email() }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1),
    password: z.string().min(8).max(128),
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8).max(128),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
});

export const twoFactorLoginSchema = z.object({
  body: z.object({
    challengeToken: z.string().min(1).max(1024),
    code: z.string().trim().min(6).max(32),
  }),
});

export const twoFactorEnableSchema = z.object({
  body: z.object({ token: z.string().regex(/^\d{6}$/) }),
});

export const twoFactorDisableSchema = z.object({
  body: z.object({
    password: z.string().min(1),
    token: z.string().trim().min(6).max(32),
  }),
});

const sendAuth = (res, user) => {
  const csrfToken = crypto.randomBytes(32).toString("hex");
  const token = signToken(user._id, csrfToken);
  const isProduction = process.env.NODE_ENV === "production";
  res.cookie("token", token, {
    httpOnly: true,
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({
    csrfToken,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      isAdmin: isAdminUser(user),
    },
  });
};

export const register = asyncHandler(async (req, res) => {
  throw new AppError("Registration is invitation-only", 403);
});

const hashInvitationToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

export const createInvitation = asyncHandler(async (req, res) => {
  const email = req.validated.body.email.toLowerCase();
  if (await User.exists({ email })) {
    throw new AppError("An account already exists for this email", 409);
  }

  // Check for an existing unexpired pending invitation
  const existingPending = await UserInvitation.findOne({
    email,
    status: "pending",
    expiresAt: { $gt: new Date() },
  });
  if (existingPending) {
    // Revoke any previous unaccepted invitation before issuing a new one
    await UserInvitation.updateMany(
      { email, status: "pending" },
      { $set: { status: "revoked" } }
    );
  }

  const token = crypto.randomBytes(32).toString("base64url");
  // Invitation link expires in 15 minutes
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  const invitation = await UserInvitation.create({
    email,
    tokenHash: hashInvitationToken(token),
    createdBy: req.user._id,
    expiresAt,
    status: "pending",
  });

  const invitationUrl = `${env.clientUrl.replace(/\/$/, "")}/accept-invite?token=${encodeURIComponent(token)}`;

  let emailStatus = { sent: false };
  try {
    emailStatus = await sendInvitationEmail({ to: email, invitationUrl, expiresAt });
  } catch (err) {
    console.error(`Failed to send invitation email to ${email}:`, err);
    emailStatus = { sent: false, error: err.message };
  }

  res.status(201).json({
    _id: invitation._id,
    email,
    invitationUrl,
    expiresAt,
    emailSent: emailStatus.sent,
    emailStatus,
  });
});

export const validateInvitation = asyncHandler(async (req, res) => {
  const invitation = await UserInvitation.findOne({
    tokenHash: hashInvitationToken(req.validated.query.token),
    status: "pending",
    usedAt: null,
    expiresAt: { $gt: new Date() },
  }).select("email expiresAt");

  if (!invitation || await User.exists({ email: invitation.email })) {
    throw new AppError("Invitation is invalid or expired", 404);
  }

  res.json({ email: invitation.email, expiresAt: invitation.expiresAt });
});

export const acceptInvitation = asyncHandler(async (req, res) => {
  const { token, name, password } = req.validated.body;
  const tokenHash = hashInvitationToken(token);
  const invitation = await UserInvitation.findOne({
    tokenHash,
    status: "pending",
    usedAt: null,
    expiresAt: { $gt: new Date() },
  }).select("email expiresAt");

  if (!invitation) throw new AppError("Invitation is invalid or expired", 404);
  if (await User.exists({ email: invitation.email })) {
    throw new AppError("An account already exists for this email", 409);
  }

  const user = await User.create({
    name,
    email: invitation.email,
    passwordHash: await User.hashPassword(password),
  });
  await UserInvitation.updateOne({
    _id: invitation._id,
    tokenHash,
    status: "pending",
    usedAt: null,
    expiresAt: { $gt: new Date() },
  }, { $set: { usedAt: new Date(), status: "accepted" } });

  sendAuth(res, user);
});

export const listInvitations = asyncHandler(async (req, res) => {
  const { page = "1", limit = "15", status, search } = req.validated.query;
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(50, Math.max(1, Number(limit) || 15));
  const skip = (pageNum - 1) * limitNum;

  const now = new Date();

  // Migration/backfill for any legacy invitations in the database that don't have status set yet
  await UserInvitation.updateMany(
    { status: { $exists: false }, usedAt: { $ne: null } },
    { $set: { status: "accepted" } }
  );
  await UserInvitation.updateMany(
    { status: { $exists: false }, usedAt: null, expiresAt: { $gt: now } },
    { $set: { status: "pending" } }
  );
  await UserInvitation.updateMany(
    { status: { $exists: false }, usedAt: null, expiresAt: { $lte: now } },
    { $set: { status: "expired" } }
  );

  // Automatically mark unaccepted, past-expiration invitations as expired
  await UserInvitation.updateMany(
    { status: "pending", expiresAt: { $lte: now } },
    { $set: { status: "expired" } }
  );

  const query = {};
  if (status && ["pending", "accepted", "revoked", "expired"].includes(status)) {
    query.status = status;
  }
  if (search && search.trim()) {
    query.email = { $regex: search.trim().toLowerCase(), $options: "i" };
  }

  const [invitations, totalCount] = await Promise.all([
    UserInvitation.find(query)
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    UserInvitation.countDocuments(query),
  ]);

  res.json({
    invitations: invitations.map((inv) => {
      // Calculate effective status in case any record slipped through without status
      let effectiveStatus = inv.status;
      if (!effectiveStatus) {
        if (inv.usedAt) {
          effectiveStatus = "accepted";
        } else if (new Date(inv.expiresAt) > now) {
          effectiveStatus = "pending";
        } else {
          effectiveStatus = "expired";
        }
      }

      return {
        _id: inv._id,
        email: inv.email,
        status: effectiveStatus,
        expiresAt: inv.expiresAt,
        usedAt: inv.usedAt,
        createdAt: inv.createdAt,
        createdBy: inv.createdBy ? { name: inv.createdBy.name, email: inv.createdBy.email } : null,
      };
    }),
    pagination: {
      page: pageNum,
      limit: limitNum,
      totalCount,
      totalPages: Math.ceil(totalCount / limitNum) || 1,
    },
  });
});

export const revokeInvitation = asyncHandler(async (req, res) => {
  const { id } = req.validated.params;
  const invitation = await UserInvitation.findById(id);

  if (!invitation) {
    throw new AppError("Invitation not found", 404);
  }

  if (invitation.status === "accepted") {
    throw new AppError("Cannot revoke an invitation that has already been accepted", 400);
  }

  if (invitation.status === "revoked") {
    return res.json({ message: "Invitation was already revoked", invitation });
  }

  invitation.status = "revoked";
  await invitation.save();

  res.json({ message: "Invitation revoked successfully", invitation: { _id: invitation._id, status: invitation.status } });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.validated.body;
  const user = await User.findOne({ email }).select("+totpSecret");

  if (!user || !(await user.comparePassword(password))) {
    throw new AppError("Invalid email or password", 401);
  }

  if (user.totpEnabled) {
    const challengeId = crypto.randomUUID();
    const challengeExpiry = new Date(Date.now() + 5 * 60 * 1000);
    const result = await User.updateOne({ _id: user._id, totpEnabled: true }, {
      $set: {
        activeTwoFactorChallengeId: challengeId,
        activeTwoFactorChallengeExpiresAt: challengeExpiry,
      },
    });
    if (result.modifiedCount !== 1) throw invalidCodeError();

    return res.json({
      requiresTwoFactor: true,
      challengeToken: signTwoFactorChallenge(user._id, challengeId),
      expiresIn: 300,
    });
  }

  sendAuth(res, user);
});

export const verifyTwoFactorLogin = asyncHandler(async (req, res) => {
  const { challengeToken, code } = req.validated.body;
  let challenge;
  try {
    challenge = verifyToken(challengeToken);
  } catch {
    throw invalidCodeError();
  }
  if (challenge.purpose !== "two-factor-login" || !challenge.sub || !challenge.jti) {
    throw invalidCodeError();
  }

  const user = await User.findById(challenge.sub)
    .select("+totpSecret +totpRecoveryCodeHashes +activeTwoFactorChallengeId +activeTwoFactorChallengeExpiresAt");
  if (
    !user?.totpEnabled
    || user.activeTwoFactorChallengeId !== challenge.jti
    || user.activeTwoFactorChallengeExpiresAt <= new Date()
    || !(await consumeSecondFactor(user, code.trim(), challenge.jti))
  ) {
    throw invalidCodeError();
  }

  sendAuth(res, user);
});

export const twoFactorStatus = asyncHandler(async (req, res) => {
  res.json({ enabled: req.user.totpEnabled });
});

export const startTwoFactorSetup = asyncHandler(async (req, res) => {
  const secret = generateSecret();
  const encryptedSecret = encryptAuthSecret(secret);
  const result = await User.updateOne({ _id: req.user._id, totpEnabled: false }, {
    $set: {
      pendingTotpSecret: encryptedSecret,
      pendingTotpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });
  if (result.modifiedCount !== 1) {
    throw new AppError("Two-factor authentication is already enabled", 409);
  }

  const uri = generateURI({ issuer, label: req.user.email, secret });
  res.json({ qrCode: await QRCode.toDataURL(uri), expiresIn: 600 });
});

export const enableTwoFactor = asyncHandler(async (req, res) => {
  const { token } = req.validated.body;
  const user = await User.findById(req.user._id)
    .select("+pendingTotpSecret +pendingTotpExpiresAt");
  if (!user?.pendingTotpSecret || user.pendingTotpExpiresAt <= new Date()) {
    throw new AppError("Start two-factor setup again; the setup code expired", 400);
  }

  const secret = decryptAuthSecret(user.pendingTotpSecret);
  const counter = await verifyTotpCode(secret, token);
  if (counter === null) throw invalidCodeError();

  const recoveryCodes = Array.from({ length: recoveryCodeCount }, () =>
    crypto.randomBytes(10).toString("hex").toUpperCase());
  const recoveryHashes = await Promise.all(recoveryCodes.map((code) => User.hashPassword(code)));
  const result = await User.updateOne({
    _id: user._id,
    totpEnabled: false,
    pendingTotpSecret: user.pendingTotpSecret,
    pendingTotpExpiresAt: { $gt: new Date() },
  }, {
    $set: {
      totpEnabled: true,
      totpSecret: user.pendingTotpSecret,
      lastTotpCounter: counter,
      totpRecoveryCodeHashes: recoveryHashes,
    },
    $unset: { pendingTotpSecret: 1, pendingTotpExpiresAt: 1 },
  });
  if (result.modifiedCount !== 1) {
    throw new AppError("Two-factor setup expired; start setup again", 409);
  }

  res.json({ enabled: true, recoveryCodes });
});

export const disableTwoFactor = asyncHandler(async (req, res) => {
  const { password, token } = req.validated.body;
  const user = await User.findById(req.user._id)
    .select("+passwordHash +totpSecret +totpRecoveryCodeHashes");

  if (!user?.totpEnabled) {
    throw new AppError("Two-factor authentication is not enabled", 400);
  }

  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    throw new AppError("Invalid account password", 401);
  }

  const isCodeValid = await consumeSecondFactor(user, token);
  if (!isCodeValid) {
    throw new AppError("Invalid or expired 2FA verification code", 401);
  }

  await User.updateOne({ _id: user._id }, {
    $set: { totpEnabled: false },
    $unset: {
      totpSecret: 1,
      lastTotpCounter: 1,
      totpRecoveryCodeHashes: 1,
      activeTwoFactorChallengeId: 1,
      activeTwoFactorChallengeExpiresAt: 1,
      pendingTotpSecret: 1,
      pendingTotpExpiresAt: 1,
    },
  });
  res.json({ enabled: false });
});

export const requestPasswordReset = asyncHandler(async (req, res) => {
  const email = req.validated.body.email.toLowerCase().trim();
  const user = await User.findOne({ email });

  // For security, always return success even if email doesn't exist (prevents user enumeration)
  if (!user) {
    return res.json({
      message: "If an account exists with that email, a password reset link has been dispatched.",
    });
  }

  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

  user.passwordResetTokenHash = tokenHash;
  user.passwordResetExpiresAt = expiresAt;
  await user.save();

  const resetUrl = `${env.clientUrl.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;

  try {
    await sendPasswordResetEmail({ to: email, resetUrl, expiresAt });
  } catch (err) {
    console.error(`Failed to dispatch password reset email to ${email}:`, err);
  }

  res.json({
    message: "If an account exists with that email, a password reset link has been dispatched.",
    resetUrl: process.env.NODE_ENV !== "production" ? resetUrl : undefined,
  });
});

export const resetPasswordWithToken = asyncHandler(async (req, res) => {
  const { token, password } = req.validated.body;
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const user = await User.findOne({
    passwordResetTokenHash: tokenHash,
    passwordResetExpiresAt: { $gt: new Date() },
  }).select("+passwordResetTokenHash +passwordResetExpiresAt");

  if (!user) {
    throw new AppError("Password reset link is invalid or has expired", 400);
  }

  user.passwordHash = await User.hashPassword(password);
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpiresAt = undefined;
  await user.save();

  res.json({ message: "Password has been reset successfully. You can now log in." });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.validated.body;
  const user = await User.findById(req.user._id).select("+passwordHash");

  if (!(await user.comparePassword(currentPassword))) {
    throw new AppError("Current password is incorrect", 400);
  }

  user.passwordHash = await User.hashPassword(newPassword);
  await user.save();

  res.json({ message: "Password updated successfully" });
});

export const me = asyncHandler(async (req, res) => {
  res.json({
    user: { ...req.user.toObject(), isAdmin: isAdminUser(req.user) },
    csrfToken: req.auth.csrfToken,
  });
});

export const logout = asyncHandler(async (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  res.json({ message: "Logged out" });
});
