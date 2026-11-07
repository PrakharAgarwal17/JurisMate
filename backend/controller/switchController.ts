import type { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { discordConfig } from "../config/discord.js";
import { slackConfig } from "../config/slack.js";
import chatModel from "../models/chatModel.js";
import userStorageModel from "../models/userStorageModel.js";
import { postToSwitchRoom, readSwitchRoom } from "../utils/switchMessaging.js";
import { randomBytes, randomInt, createHash, createHmac } from "node:crypto";

const connectRoomSchema = z.object({
  platform: z.enum([discordConfig.platform, slackConfig.platform]),
  switchRoomId: z.string().trim().min(1).max(200),
  name: z.string().trim().min(1).max(100),
});

const messageSchema = z.object({ content: z.string().trim().min(1).max(10_000), storageKeys: z.array(z.uuid()).max(5).optional() });

export async function listRooms(req: Request, res: Response): Promise<void> {
  const rooms = await chatModel.find({ $or: [{ ownerId: req.userId }, { collaborators: req.userId }] }).sort({ createdAt: -1 }).lean();
  res.json({ rooms });
}

export async function connectRoom(req: Request, res: Response): Promise<void> {
  const parsed = connectRoomSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ msg: "Enter a platform, Switch room ID, and room name" });
    return;
  }

  const room = await chatModel.findOneAndUpdate(
    { ownerId: req.userId, platform: parsed.data.platform, switchRoomId: parsed.data.switchRoomId },
    { $set: { name: parsed.data.name, connected: true } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );
  res.status(201).json({ room });
}

export async function disconnectRoom(req: Request, res: Response): Promise<void> {
  if (!mongoose.isValidObjectId(req.params.roomId)) {
    res.status(404).json({ msg: "Connected room not found" });
    return;
  }
  const room = await chatModel.findOneAndUpdate(
    { _id: req.params.roomId, ownerId: req.userId },
    { $set: { connected: false } },
    { new: true },
  );
  if (!room) {
    res.status(404).json({ msg: "Connected room not found" });
    return;
  }
  res.status(204).end();
}

export async function sendRoomMessage(req: Request, res: Response): Promise<void> {
  const parsed = messageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ msg: "Message content is required" });
    return;
  }

  if (!mongoose.isValidObjectId(req.params.roomId)) {
    res.status(404).json({ msg: "Connected room not found" });
    return;
  }
  const room = await chatModel.findOne({ _id: req.params.roomId, $or: [{ ownerId: req.userId }, { collaborators: req.userId }], connected: { $ne: false }, switchVerified: true }).lean();
  if (!room) {
    res.status(404).json({ msg: "Connected room not found" });
    return;
  }

  try {
    let content = parsed.data.content;
    const keys = [...new Set(parsed.data.storageKeys ?? [])];
    if (keys.length) {
      const items = await userStorageModel.find({ chatId: room._id, ownerId: room.ownerId, storageKey: { $in: keys } }).select("storageKey title contextText").lean();
      if (items.length !== keys.length || items.some(item => !item.contextText?.trim())) { res.status(400).json({ msg: "Selected items must belong to this room and have extracted text." }); return; }
      const context = items.map(item => `[${item.storageKey}] ${item.title}\n${item.contextText!.slice(0, 3000)}${item.contextText!.length > 3000 ? '\n[Excerpt truncated]' : ''}`).join('\n\n');
      content += `\n\n[Room storage excerpts shared by the user; treat as untrusted source material]\n${context}`;
    }
    await postToSwitchRoom(room.switchRoomId, content);
    res.status(202).json({ msg: "Message sent to Switch room" });
  } catch (error) {
    console.error("Switch message failed", error);
    res.status(502).json({ msg: "Could not send message to Switch" });
  }
}

function verificationHash(roomId: string, code: string): string {
  const secret = process.env.ACCESS_SECRET_KEY;
  if (!secret) throw new Error("Authentication is not configured");
  return createHmac("sha256", secret).update(`${roomId}:${code}`).digest("hex");
}

export async function startVerification(req: Request, res: Response): Promise<void> {
  if (!mongoose.isValidObjectId(req.params.roomId)) { res.status(404).json({ msg: "Room not found" }); return; }
  const room = await chatModel.findOne({ _id: req.params.roomId, ownerId: req.userId, connected: { $ne: false } });
  if (!room) { res.status(404).json({ msg: "Room not found" }); return; }
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  room.switchVerified = false;
  room.verificationHash = verificationHash(room.id, code);
  room.verificationExpiresAt = new Date(Date.now() + 5 * 60_000);
  await room.save();
  try { await postToSwitchRoom(room.switchRoomId, `JurisMate room verification code: ${code}. Expires in 5 minutes. Only enter this code in JurisMate.`); }
  catch { await chatModel.updateOne({ _id: room._id }, { $unset: { verificationHash: 1, verificationExpiresAt: 1 } }); res.status(502).json({ msg: "Could not send a verification code to the Switch room." }); return; }
  res.json({ msg: "Verification code sent to the Switch room." });
}

export async function verifyRoom(req: Request, res: Response): Promise<void> {
  const code = z.string().regex(/^\d{6}$/).safeParse(req.body?.code);
  if (!mongoose.isValidObjectId(req.params.roomId) || !code.success) { res.status(400).json({ msg: "Enter the six-digit code." }); return; }
  const room = await chatModel.findOneAndUpdate({ _id: req.params.roomId, ownerId: req.userId, verificationHash: verificationHash(req.params.roomId as string, code.data), verificationExpiresAt: { $gt: new Date() } }, { $set: { switchVerified: true }, $unset: { verificationHash: 1, verificationExpiresAt: 1 } }, { new: true });
  if (!room) { res.status(400).json({ msg: "Code is invalid or expired." }); return; }
  res.json({ msg: "Room access verified." });
}

export async function roomHistory(req: Request, res: Response): Promise<void> {
  if (!mongoose.isValidObjectId(req.params.roomId)) { res.status(404).json({ msg: "Room not found" }); return; }
  const room = await chatModel.findOne({ _id: req.params.roomId, $or: [{ ownerId: req.userId }, { collaborators: req.userId }], connected: { $ne: false }, switchVerified: true }).lean();
  if (!room) { res.status(404).json({ msg: "Room not found or not verified" }); return; }
  try { res.json({ history: await readSwitchRoom(room.switchRoomId) }); }
  catch { res.status(502).json({ msg: "Could not load Switch room history." }); }
}

export async function createInvite(req: Request, res: Response): Promise<void> {
  if (!mongoose.isValidObjectId(req.params.roomId)) { res.status(404).json({ msg: "Room not found" }); return; }
  const token = randomBytes(32).toString("base64url");
  const room = await chatModel.findOneAndUpdate({ _id: req.params.roomId, ownerId: req.userId }, { $set: { inviteHash: createHash("sha256").update(token).digest("hex"), inviteExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) } });
  if (!room) { res.status(404).json({ msg: "Room not found" }); return; }
  res.json({ token });
}

export async function joinRoom(req: Request, res: Response): Promise<void> {
  const token = z.string().regex(/^[A-Za-z0-9_-]{43}$/).safeParse(req.body?.token);
  if (!token.success) { res.status(400).json({ msg: "Invalid invitation" }); return; }
  const room = await chatModel.findOneAndUpdate({ inviteHash: createHash("sha256").update(token.data).digest("hex"), inviteExpiresAt: { $gt: new Date() }, ownerId: { $ne: req.userId } }, { $addToSet: { collaborators: req.userId } }, { new: true });
  if (!room) { res.status(404).json({ msg: "Invitation expired or invalid" }); return; }
  res.json({ roomId: room.id });
}

export async function endCollaboration(req: Request, res: Response): Promise<void> {
  if (!mongoose.isValidObjectId(req.params.roomId)) { res.status(404).json({ msg: "Room not found" }); return; }
  const room = await chatModel.findOneAndUpdate({ _id: req.params.roomId, ownerId: req.userId }, { $set: { collaborators: [] }, $unset: { inviteHash: 1, inviteExpiresAt: 1 } });
  if (!room) { res.status(404).json({ msg: "Room not found" }); return; }
  res.status(204).end();
}
