import { randomBytes } from "node:crypto";
import { Router, type RequestHandler } from "express";
import passport from "passport";
import { rateLimit } from "express-rate-limit";
import * as auth from "../controller/authController.js";
import { googleOAuthConfigured } from "../config/passport.js";
import isLoggedIn from "../middleware/isLoggedIn.js";
import uploadImage from "../middleware/uploadImage.js";
import userModel from "../models/userModel.js";

const router = Router();
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});
const requireGoogleConfig: RequestHandler = (_req, res, next) => {
  if (!googleOAuthConfigured) {
    res.status(503).json({ msg: "Google sign-in is not configured" });
    return;
  }
  next();
};
const startGoogleOAuth: RequestHandler = (req, res, next) => {
  const state = randomBytes(32).toString("base64url");
  res.cookie("googleOAuthState", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.COOKIE_SAME_SITE === "none" ? "none" : "lax",
    maxAge: 10 * 60 * 1000,
    path: "/",
  });
  passport.authenticate("google", { scope: ["email", "profile"], session: false, state })(req, res, next);
};
const verifyGoogleOAuthState: RequestHandler = (req, res, next) => {
  const state = req.cookies?.googleOAuthState;
  const returnedState = req.query.state;
  res.clearCookie("googleOAuthState", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.COOKIE_SAME_SITE === "none" ? "none" : "lax",
    path: "/",
  });
  if (!state || typeof returnedState !== "string" || state !== returnedState) {
    res.status(401).json({ msg: "Google sign-in state check failed" });
    return;
  }
  next();
};

router.use(authLimiter);
router.post("/signup", auth.signUp);
router.post("/verify-otp", auth.verifyOtp);
router.post("/signin", auth.signIn);
router.post("/refresh", auth.refreshAccessToken);
router.post("/signout", auth.signOut);
router.get("/me", isLoggedIn, async (req, res) => {
  const user = await userModel.findById(req.userId).select("displayName email").lean();
  if (!user) { res.status(401).json({ msg: "User not found" }); return; }
  res.json({ user: { id: user._id, displayName: user.displayName || null, email: user.email } });
});
router.get("/google", requireGoogleConfig, startGoogleOAuth);
router.get("/google/callback", requireGoogleConfig, verifyGoogleOAuthState, passport.authenticate("google", {
  session: false,
  failureRedirect: "/api/auth/google/failure",
}), auth.googleSuccess);
router.get("/google/failure", auth.googleFailure);
router.post("/profile/image", isLoggedIn, uploadImage, auth.uploadProfileImage);

export default router;
