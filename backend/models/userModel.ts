import mongoose, { type InferSchemaType } from "mongoose";

const oauthIdentitySchema = new mongoose.Schema(
  {
    provider: { type: String, required: true },
    providerId: { type: String, required: true },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, select: false },
    oauthIdentities: { type: [oauthIdentitySchema], default: [] },
    profileImage: { type: String },
    refreshTokenHash: { type: String, select: false },
    isVerified: { type: Boolean, default: false },
  },
  { timestamps: true },
);

userSchema.index(
  { "oauthIdentities.provider": 1, "oauthIdentities.providerId": 1 },
  { unique: true, sparse: true },
);

export type User = InferSchemaType<typeof userSchema>;

const userModel = mongoose.models.User ?? mongoose.model("User", userSchema);
export default userModel;
