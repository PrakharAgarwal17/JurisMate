import type { NextFunction, Request, Response } from "express";

const allowedOrigin = new URL(process.env.CLIENT_URL ?? "http://localhost:5173").origin;

export default function verifyRequestOrigin(req: Request, res: Response, next: NextFunction): void {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    next();
    return;
  }

  const origin = req.get("origin");
  if (origin && origin !== allowedOrigin) {
    res.status(403).json({ msg: "Request origin is not allowed" });
    return;
  }
  next();
}
