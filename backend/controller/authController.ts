import { randomInt } from "node:crypto";
import type { Request, Response } from "express";
import { unlink } from "node:fs/promises";
import bcrypt from "bcrypt";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { z } from "zod";
import userModel from "../models/userModel.js";
import { clearAuthCookies, hashToken, issueAuthTokens, tokenHashMatches } from "../utils/authTokens.js";
import { sendSignupOtp } from "../utils/mailer.js";
import { detectFileKind } from "../tools/fileContext.js";
import { uploadLocalFile } from "../tools/cloudinaryStorage.js";

const emailSchema = z.string().trim().toLowerCase().pipe(z.email());
const passwordSchema = z.string().min(8, "Password must be at least 8 characters")
  .max(50, "Password must be at most 50 characters")
  .regex(/[a-z]/, "At least one lowercase letter required")
  .regex(/[A-Z]/, "At least one uppercase letter required")
  .regex(/[0-9]/, "At least one digit required")
  .regex(/[^a-zA-Z0-9]/, "At least one special character required")
  .refine((password) => Buffer.byteLength(password, "utf8") <= 72, "Password is too long");
const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).refine((password) => Buffer.byteLength(password, "utf8") <= 72),
});
const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});
const verifyOtpSchema = z.object({ email: emailSchema, otp: z.string().length(6).regex(/^\d+$/) });

// shortcut: OTP state stays on this server; use shared TTL storage if the backend runs on multiple instances.
const otpStorage = new Map<string, { otpHash: string; passwordHash: string; expiresAt: number }>();

interface AuthPayload extends JwtPayload {
  userId: string;
}

const invalidData = (res: Response) => res.status(400).json({ msg: "Invalid data entered" });
const invalidCredentials = (res: Response) =>
  res.status(401).json({ msg: "Email or password is incorrect" });

export async function signUp(req: Request, res: Response): Promise<Response> {
  const parsed = signUpSchema.safeParse(req.body);
  if (!parsed.success) return invalidData(res);

  try {
    const { email, password } = parsed.data;
    const existingUser = await userModel.findOne({ email }).select("+password");
    if (existingUser?.password) return res.status(409).json({ msg: "Email already exists" });

    for (const [storedEmail, pending] of otpStorage) {
      if (pending.expiresAt <= Date.now()) otpStorage.delete(storedEmail);
    }

    const otp = String(randomInt(100000, 1000000));
    const [otpHash, passwordHash] = await Promise.all([
      bcrypt.hash(otp, 10),
      bcrypt.hash(password, 10),
    ]);
    const pendingSignup = { otpHash, passwordHash, expiresAt: Date.now() + 5 * 60 * 1000 };
    otpStorage.set(email, pendingSignup);
    try {
      await sendSignupOtp(email, otp);
    } catch (error) {
      if (otpStorage.get(email) === pendingSignup) otpStorage.delete(email);
      throw error;
    }

    return res.status(202).json({ msg: "Verification code sent" });
  } catch (error) {
    console.error("Sign-up failed", error);
    return res.status(500).json({ msg: "Could not start sign-up" });
  }
}

export async function verifyOtp(req: Request, res: Response): Promise<Response> {
  const parsed = verifyOtpSchema.safeParse(req.body);
  if (!parsed.success) return invalidData(res);

  try {
    const { email, otp } = parsed.data;
    const pending = otpStorage.get(email);
    if (!pending) {
      return res.status(400).json({ msg: "Incorrect or expired verification code" });
    }
    if (pending.expiresAt <= Date.now()) {
      otpStorage.delete(email);
      return res.status(400).json({ msg: "Verification code expired" });
    }
    if (!(await bcrypt.compare(otp, pending.otpHash))) {
      return res.status(400).json({ msg: "Incorrect or expired verification code" });
    }

    let user = await userModel.findOne({ email }).select("+password");
    if (user?.password) {
      otpStorage.delete(email);
      return res.status(409).json({ msg: "Email already has a password account" });
    }
    if (user) {
      user.password = pending.passwordHash;
      user.isVerified = true;
      await user.save();
    } else {
      user = await userModel.create({ email, password: pending.passwordHash, isVerified: true });
    }
    otpStorage.delete(email);
    await issueAuthTokens(user.id, res);
    return res.status(201).json({ msg: "Email verified and account ready" });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      otpStorage.delete(parsed.data.email);
      return res.status(409).json({ msg: "Email already exists" });
    }
    console.error("OTP verification failed", error);
    return res.status(500).json({ msg: "Could not verify account" });
  }
}

export async function signIn(req: Request, res: Response): Promise<Response> {
  const parsed = signInSchema.safeParse(req.body);
  if (!parsed.success) return invalidData(res);

  try {
    const user = await userModel.findOne({ email: parsed.data.email, isVerified: true }).select("+password");
    if (!user?.password || !(await bcrypt.compare(parsed.data.password, user.password))) {
      return invalidCredentials(res);
    }
    await issueAuthTokens(user.id, res);
    return res.status(200).json({ msg: "Successfully authorized" });
  } catch (error) {
    console.error("Sign-in failed", error);
    return res.status(500).json({ msg: "Could not sign in" });
  }
}

export async function refreshAccessToken(req: Request, res: Response): Promise<Response> {
  const secret = process.env.REFRESH_SECRET_KEY;
  const token = req.cookies?.refreshToken;
  if (!secret || !token) return res.status(401).json({ msg: "Sign in again" });

  try {
    const payload = jwt.verify(token, secret, { algorithms: ["HS256"] });
    if (typeof payload === "string" || typeof payload.userId !== "string") {
      clearAuthCookies(res);
      return res.status(401).json({ msg: "Sign in again" });
    }
    const user = await userModel.findById(payload.userId).select("+refreshTokenHash");
    if (!user?.refreshTokenHash || !tokenHashMatches(token, user.refreshTokenHash)) {
      clearAuthCookies(res);
      return res.status(401).json({ msg: "Sign in again" });
    }
    await issueAuthTokens(user.id, res);
    return res.status(200).json({ msg: "Access token refreshed" });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      clearAuthCookies(res);
      return res.status(401).json({ msg: "Sign in again" });
    }
    console.error("Token refresh failed", error);
    return res.status(500).json({ msg: "Could not refresh access token" });
  }
}

export async function signOut(_req: Request, res: Response): Promise<Response> {
  const token = _req.cookies?.refreshToken;
  const secret = process.env.REFRESH_SECRET_KEY;
  if (token && secret) {
    try {
      const payload = jwt.verify(token, secret, { algorithms: ["HS256"] }) as AuthPayload;
      if (typeof payload.userId === "string") {
        const user = await userModel.findById(payload.userId).select("+refreshTokenHash");
        if (user?.refreshTokenHash && tokenHashMatches(token, user.refreshTokenHash)) {
          user.refreshTokenHash = undefined;
          await user.save();
        }
      }
    } catch (error) {
      if (!(error instanceof jwt.JsonWebTokenError)) console.error("Sign-out revocation failed", error);
    }
  }
  clearAuthCookies(res);
  return res.status(200).json({ msg: "Signed out" });
}

export async function googleSuccess(req: Request, res: Response): Promise<Response | void> {
  try {
    const user = req.user as { id: string } | undefined;
    if (!user) return res.status(401).json({ msg: "Google authentication failed" });
    await issueAuthTokens(user.id, res);
    return res.redirect(`${process.env.CLIENT_URL ?? "http://localhost:5173"}/oauth/callback`);
  } catch (error) {
    console.error("Google sign-in failed", error);
    return res.status(500).json({ msg: "Could not complete Google sign-in" });
  }
}

export function googleFailure(_req: Request, res: Response): Response {
  return res.status(401).json({ msg: "Google authentication failed" });
}

export async function uploadProfileImage(req: Request, res: Response): Promise<Response> {
  if (!req.file) return res.status(400).json({ msg: "Choose an image to upload" });

  try {
    await detectFileKind(req.file.path, req.file.mimetype);
    const result = await uploadLocalFile(req.file.path, {
      folder: "jurismate/profile-images",
      public_id: req.userId,
      overwrite: true,
      resource_type: "image",
    });
    const user = await userModel.findByIdAndUpdate(
      req.userId,
      { profileImage: result.secure_url },
      { new: true, select: "_id profileImage" },
    );
    if (!user) return res.status(404).json({ msg: "User not found" });
    return res.status(200).json({ profileImage: user.profileImage });
  } catch (error) {
    console.error("Profile image upload failed", error);
    return res.status(500).json({ msg: "Could not upload profile image" });
  } finally {
    await unlink(req.file.path).catch(() => undefined);
  }
}
