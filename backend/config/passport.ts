import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { z } from "zod";
import userModel from "../models/userModel.js";

const clientID = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const callbackURL = process.env.GOOGLE_CALLBACK_URL;

export const googleOAuthConfigured = Boolean(clientID && clientSecret && callbackURL);

if (clientID && clientSecret && callbackURL) {
  passport.use("google", new GoogleStrategy(
    { clientID, clientSecret, callbackURL },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const email = z.email().safeParse(profile.emails?.[0]?.value);
        const isVerified = profile._json.email_verified === true || profile.emails?.[0]?.verified === true;
        if (!email.success || !isVerified) return done(null, false);

        const normalizedEmail = email.data.toLowerCase();
        let user = await userModel.findOne({
          oauthIdentities: { $elemMatch: { provider: "google", providerId: profile.id } },
        });
        if (user) return done(null, user);

        user = await userModel.findOne({ email: normalizedEmail });
        if (user) {
          if (!user.isVerified) {
            user.isVerified = true;
          }
          user.oauthIdentities.push({ provider: "google", providerId: profile.id });
          await user.save();
          return done(null, user);
        }

        user = await userModel.create({
          email: normalizedEmail,
          isVerified: true,
          oauthIdentities: [{ provider: "google", providerId: profile.id }],
        });
        return done(null, user);
      } catch (error) {
        return done(error as Error);
      }
    },
  ));
}

export default passport;
