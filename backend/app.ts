import "dotenv/config";

import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import passport from "passport";
import authRoutes from "./routes/authRoutes.js";
import switchRoutes from "./routes/switchRoutes.js";
import verifyRequestOrigin from "./middleware/verifyRequestOrigin.js";

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL ?? "http://localhost:5173", credentials: true }));
app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(cookieParser());
app.use(passport.initialize());
app.use("/api/auth", verifyRequestOrigin, authRoutes);
app.use("/api/switch", verifyRequestOrigin, switchRoutes);

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled request error", error);
  res.status(500).json({ msg: "Something went wrong" });
});

export default app;
