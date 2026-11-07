import { randomUUID } from "node:crypto";
import mongoose, { type InferSchemaType } from "mongoose";

const highlightSchema = new mongoose.Schema({
  quote: { type: String, required: true },
  pageNumber: { type: Number },
  note: { type: String, default: "" },
  markedAt: { type: Date, default: Date.now },
});

const userStorageSchema = new mongoose.Schema(
  {
    storageKey: { type: String, required: true, unique: true, default: randomUUID },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    chatId: { type: mongoose.Schema.Types.ObjectId, ref: "Chat", required: true },
    kind: { type: String, enum: ["file", "note"], required: true },
    title: { type: String, required: true, trim: true },
    fileUrl: { type: String },
    cloudinaryPublicId: { type: String },
    cloudinaryResourceType: { type: String, enum: ["image", "raw", "video"] },
    cloudinaryFormat: { type: String },
    cloudinaryDeliveryType: { type: String, enum: ["upload", "authenticated"] },
    fileName: { type: String },
    mimeType: { type: String },
    fileSize: { type: Number },
    contextText: { type: String },
    contextTruncated: { type: Boolean, default: false },
    imageAnalysis: { type: String },
    sourceMessageId: { type: String },
    sourceMediaUri: { type: String, select: false },
    highlights: { type: [highlightSchema], default: [] },
  },
  { timestamps: true, collection: "userstorage" },
);

userStorageSchema.index({ ownerId: 1, chatId: 1, createdAt: -1 });

export type UserStorage = InferSchemaType<typeof userStorageSchema>;

const userStorageModel = mongoose.models.UserStorage ?? mongoose.model("UserStorage", userStorageSchema);
export default userStorageModel;
