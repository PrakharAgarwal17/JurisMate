import type { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { discordConfig } from "../config/discord.js";
import { slackConfig } from "../config/slack.js";
import switchRoomModel from "../models/switchRoomModel.js";
import { postToSwitchRoom } from "../utils/switchMessaging.js";

const connectRoomSchema = z.object({
  platform: z.enum([discordConfig.platform, slackConfig.platform]),
  switchRoomId: z.string().trim().min(1).max(200),
  name: z.string().trim().min(1).max(100),
});

const messageSchema = z.object({ content: z.string().trim().min(1).max(10_000) });

export async function listRooms(req: Request, res: Response): Promise<void> {
  const rooms = await switchRoomModel.find({ ownerId: req.userId }).sort({ createdAt: -1 }).lean();
  res.json({ rooms });
}

export async function connectRoom(req: Request, res: Response): Promise<void> {
  const parsed = connectRoomSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ msg: "Enter a platform, Switch room ID, and room name" });
    return;
  }

  const room = await switchRoomModel.findOneAndUpdate(
    { ownerId: req.userId, platform: parsed.data.platform, switchRoomId: parsed.data.switchRoomId },
    { $set: { name: parsed.data.name } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );
  res.status(201).json({ room });
}

export async function disconnectRoom(req: Request, res: Response): Promise<void> {
  if (!mongoose.isValidObjectId(req.params.roomId)) {
    res.status(404).json({ msg: "Connected room not found" });
    return;
  }
  const room = await switchRoomModel.findOneAndDelete({ _id: req.params.roomId, ownerId: req.userId });
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
  const room = await switchRoomModel.findOne({ _id: req.params.roomId, ownerId: req.userId }).lean();
  if (!room) {
    res.status(404).json({ msg: "Connected room not found" });
    return;
  }

  try {
    await postToSwitchRoom(room.switchRoomId, parsed.data.content);
    res.status(202).json({ msg: "Message sent to Switch room" });
  } catch (error) {
    console.error("Switch message failed", error);
    res.status(502).json({ msg: "Could not send message to Switch" });
  }
}
