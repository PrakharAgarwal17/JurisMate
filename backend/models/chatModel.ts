import mongoose, { type InferSchemaType } from "mongoose";

const summarySchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    messageCount: { type: Number, required: true },
    truncated: { type: Boolean, default: false },
    updatedAt: { type: Date, required: true },
  },
  { _id: false },
);

const courtBriefSchema = new mongoose.Schema({
  fingerprint: { type: String, required: true },
  summary: { type: String, required: true },
  notes: { type: String, required: true },
  createdAt: { type: Date, required: true },
}, { _id: false });

const chatSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    collaborators: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], default: [] },
    inviteHash: { type: String, select: false },
    inviteExpiresAt: { type: Date, select: false },
    platform: { type: String, enum: ["discord", "slack"], required: true },
    switchRoomId: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    connected: { type: Boolean, default: true },
    switchVerified: { type: Boolean, default: false },
    verificationHash: { type: String, select: false },
    verificationExpiresAt: { type: Date, select: false },
    summary: { type: summarySchema },
    courtroom: { type: [{ role: { type: String, enum: ["user", "claimant", "respondent", "judge"], required: true }, text: { type: String, required: true }, phase: { type: String, enum: ["question", "answer"] } }], default: [] },
    courtContext: { type: String, default: "", maxlength: 4000 },
    courtStorageKeys: { type: [String], default: [] },
    courtBrief: { type: courtBriefSchema },
    courtSession: { endsAt: Date, nextAt: Date, turn: { type: Number, default: 0 }, lockedUntil: Date, active: { type: Boolean, default: false } },
  },
  // Keep existing room records when upgrading the old SwitchRoom model.
  { timestamps: true, collection: "switchrooms" },
);

chatSchema.index({ ownerId: 1, platform: 1, switchRoomId: 1 }, { unique: true });

export type Chat = InferSchemaType<typeof chatSchema>;

const chatModel = mongoose.models.Chat ?? mongoose.model("Chat", chatSchema);
export default chatModel;
