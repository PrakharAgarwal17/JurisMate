import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import userModel from "../models/userModel.js";

export default async function isLoggedIn(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = req.cookies?.accessToken ?? req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    res.status(401).json({ message: "Unauthorized User" });
    return;
  }

  const secret = process.env.ACCESS_SECRET_KEY;
  if (!secret) {
    res.status(500).json({ message: "Authentication is not configured" });
    return;
  }

  let userId: string;
  try {
    const verified = jwt.verify(token, secret, { algorithms: ["HS256"] });
    if (typeof verified === "string" || typeof verified.userId !== "string") {
      res.status(401).json({ message: "Unauthorized User" });
      return;
    }
    userId = verified.userId;
  } catch {
    res.status(401).json({ message: "Unauthorized User" });
    return;
  }

  try {
    const user = await userModel.findById(userId).select("_id");
    if (!user) {
      res.status(401).json({ message: "User not found" });
      return;
    }
    req.userId = user.id;
    next();
  } catch (error) {
    next(error);
  }
}
