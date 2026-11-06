import { createHash, timingSafeEqual } from "node:crypto";
import type { CookieOptions, Response } from "express";
import jwt from "jsonwebtoken";
import userModel from "../models/userModel.js";

const cookieOptions = (maxAge: number): CookieOptions => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.COOKIE_SAME_SITE === "none" ? "none" : "lax",
  maxAge,
  path: "/",
});

export const hashToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

export const tokenHashMatches = (token: string, storedHash: string): boolean => {
  const actual = Buffer.from(hashToken(token), "hex");
  const expected = Buffer.from(storedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};

// shortcut: one active refresh-token session per user; use a sessions collection for multi-device login.
export async function issueAuthTokens(userId: string, res: Response): Promise<void> {
  const accessSecret = process.env.ACCESS_SECRET_KEY;
  const refreshSecret = process.env.REFRESH_SECRET_KEY;
  if (!accessSecret || !refreshSecret) throw new Error("JWT secrets are missing");

  const accessToken = jwt.sign({ userId }, accessSecret, { expiresIn: "15m", algorithm: "HS256" });
  const refreshToken = jwt.sign({ userId }, refreshSecret, { expiresIn: "7d", algorithm: "HS256" });
  const updated = await userModel.findByIdAndUpdate(userId, { refreshTokenHash: hashToken(refreshToken) });
  if (!updated) throw new Error("User no longer exists");

  res.cookie("accessToken", accessToken, cookieOptions(15 * 60 * 1000));
  res.cookie("refreshToken", refreshToken, cookieOptions(7 * 24 * 60 * 60 * 1000));
}

export function clearAuthCookies(res: Response): void {
  const options = cookieOptions(0);
  res.clearCookie("accessToken", options);
  res.clearCookie("refreshToken", options);
}
