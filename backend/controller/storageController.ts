import type { Request, Response } from "express";
import { unlink } from "node:fs/promises";
import { mkdtemp, writeFile, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { readSwitchRoom } from "../utils/switchMessaging.js";
import { switchAgentConfig } from "../config/switchAgent.js";
import mongoose from "mongoose";
import { z } from "zod";
import chatModel from "../models/chatModel.js";
import userStorageModel from "../models/userStorageModel.js";
import { summarizeChat } from "../tools/chatSummary.js";
import {
  analyzeStoredImage,
  extractStoredFileContext,
  getStoredFileDownload,
  markStoredFileHighlight,
  storeImportantInformation,
  uploadUserFile,
} from "../tools/userStorage.js";

const noteSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(100_000),
  sourceMessageId: z.string().max(200).optional(),
});

const highlightSchema = z.object({
  quote: z.string().trim().min(1).max(10_000),
  pageNumber: z.number().int().positive().optional(),
  note: z.string().trim().max(1_000).optional(),
});

const notFound = (res: Response): void => { res.status(404).json({ msg: "Chat or stored item not found" }); };
const routeParam = (req: Request, key: "chatId" | "storageId"): string | undefined => {
  const value = req.params[key];
  return typeof value === "string" ? value : undefined;
};

export async function listChatStorage(req: Request, res: Response): Promise<void> {
  const chatId = routeParam(req, "chatId");
  if (!chatId || !mongoose.isValidObjectId(chatId)) return notFound(res);
  const chat = await chatModel.findOne({ _id: chatId, ownerId: req.userId }).select("_id").lean();
  if (!chat) return notFound(res);
  const items = await userStorageModel.find({ chatId: chat._id, ownerId: req.userId })
    .select("storageKey chatId kind title fileName mimeType fileSize contextText sourceMessageId highlights createdAt updatedAt")
    .sort({ createdAt: -1 }).lean();
  res.json({ items: items.map(({ contextText, ...item }) => ({
    ...item,
    hasContext: Boolean(contextText),
    ...(item.kind === "note" ? { content: contextText } : {}),
  })) });
}

export async function importSwitchFiles(req: Request, res: Response): Promise<void> {
  const chatId = routeParam(req, "chatId");
  const chat = chatId && mongoose.isValidObjectId(chatId) ? await chatModel.findOne({ _id: chatId, ownerId: req.userId, switchVerified: true, connected: true }).lean() : null;
  if (!chat) return notFound(res);
  const history = await readSwitchRoom(chat.switchRoomId) as { threads?: Array<{ root?: { attachments?: Array<{ mxc?: string; filename?: string; mimetype?: string; size?: number }> }; replies?: Array<{ attachments?: Array<{ mxc?: string; filename?: string; mimetype?: string; size?: number }> }> }> };
  const attachments = (history.threads ?? []).flatMap(thread => [thread.root, ...(thread.replies ?? [])]).flatMap(entry => entry?.attachments ?? []);
  let imported = 0, skipped = 0;
  for (const file of attachments) {
    if (!file.mxc?.match(/^switch-media:\/\/[a-f0-9]+$/) || !file.filename || !["application/pdf", "image/png", "image/jpeg", "image/webp"].includes(file.mimetype ?? "") || !file.size || file.size > 20_000_000) { skipped++; continue; }
    if (await userStorageModel.exists({ chatId: chat._id, ownerId: req.userId, sourceMediaUri: file.mxc })) continue;
    const { bridgeUrl, agentId, apiKey } = switchAgentConfig;
    if (!bridgeUrl || !agentId || !apiKey) throw new Error("Switch integration is not configured");
    const url = new URL(`${bridgeUrl.replace(/\/$/, "")}/agents/${encodeURIComponent(agentId)}/rooms/${encodeURIComponent(chat.switchRoomId)}/media`);
    url.searchParams.set("mxc", file.mxc);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(30_000) });
    if (!response.ok) { skipped++; continue; }
    const reader = response.body?.getReader();
    if (!reader) { skipped++; continue; }
    const chunks: Buffer[] = [];
    let length = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.byteLength;
      if (length > 20_000_000) { await reader.cancel(); break; }
      chunks.push(Buffer.from(part.value));
    }
    if (length > 20_000_000 || length !== file.size) { skipped++; continue; }
    const bytes = Buffer.concat(chunks);
    const directory = await mkdtemp(path.join(tmpdir(), "jurismate-import-"));
    const location = path.join(directory, "upload");
    try {
      await writeFile(location, bytes);
      const item = await uploadUserFile({ ownerId: req.userId!, chatId: chat._id.toString(), path: location, originalName: file.filename, mimeType: file.mimetype!, fileSize: bytes.length });
      item.sourceMediaUri = file.mxc;
      await item.save();
      imported++;
    } finally { await unlink(location).catch(() => undefined); await rmdir(directory).catch(() => undefined); }
  }
  res.json({ imported, skipped });
}

export async function getStorageDownload(req: Request, res: Response): Promise<void> {
  const storageId = routeParam(req, "storageId");
  if (!storageId || !mongoose.isValidObjectId(storageId)) return notFound(res);
  try {
    res.json(await getStoredFileDownload(storageId, req.userId!));
  } catch (error) {
    if (error instanceof Error && /not found/i.test(error.message)) return notFound(res);
    throw error;
  }
}

export async function uploadChatFile(req: Request, res: Response): Promise<void> {
  if (!req.file) {
    res.status(400).json({ msg: "Choose a PDF or image to upload" });
    return;
  }
  try {
    const chatId = routeParam(req, "chatId");
    if (!chatId || !mongoose.isValidObjectId(chatId)) return notFound(res);
    const item = await uploadUserFile({
      ownerId: req.userId!,
      chatId,
      path: req.file.path,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
    });
    const savedItem = item.toObject();
    delete savedItem.fileUrl;
    delete savedItem.cloudinaryPublicId;
    delete savedItem.cloudinaryResourceType;
    delete savedItem.cloudinaryFormat;
    delete savedItem.cloudinaryDeliveryType;
    res.status(201).json({ item: savedItem });
  } catch (error) {
    if (error instanceof Error && error.message === "Chat not found") return notFound(res);
    if (error instanceof Error && error.message.startsWith("File content")) {
      res.status(415).json({ msg: error.message });
      return;
    }
    throw error;
  } finally {
    await unlink(req.file.path).catch(() => undefined);
  }
}

export async function saveImportantInformation(req: Request, res: Response): Promise<void> {
  const chatId = routeParam(req, "chatId");
  if (!chatId || !mongoose.isValidObjectId(chatId)) return notFound(res);
  const parsed = noteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ msg: "Enter a title and information to store" });
    return;
  }
  try {
    const item = await storeImportantInformation({ ownerId: req.userId!, chatId, ...parsed.data });
    res.status(201).json({ item });
  } catch (error) {
    if (error instanceof Error && error.message === "Chat not found") return notFound(res);
    throw error;
  }
}

export async function summarizeChatRoom(req: Request, res: Response): Promise<void> {
  const chatId = routeParam(req, "chatId");
  if (!chatId || !mongoose.isValidObjectId(chatId)) return notFound(res);
  try {
    res.json(await summarizeChat(chatId, req.userId!));
  } catch (error) {
    if (error instanceof Error && error.message === "Chat not found") return notFound(res);
    throw error;
  }
}

export async function extractFileContext(req: Request, res: Response): Promise<void> {
  const storageId = routeParam(req, "storageId");
  if (!storageId || !mongoose.isValidObjectId(storageId)) return notFound(res);
  try {
    res.json(await extractStoredFileContext(storageId, req.userId!));
  } catch (error) {
    if (error instanceof Error && /not found/i.test(error.message)) return notFound(res);
    throw error;
  }
}

export async function analyzeImage(req: Request, res: Response): Promise<void> {
  const storageId = routeParam(req, "storageId");
  if (!storageId || !mongoose.isValidObjectId(storageId)) return notFound(res);
  try {
    res.json(await analyzeStoredImage(storageId, req.userId!));
  } catch (error) {
    if (error instanceof Error && /not found/i.test(error.message)) return notFound(res);
    throw error;
  }
}

export async function addFileHighlight(req: Request, res: Response): Promise<void> {
  const storageId = routeParam(req, "storageId");
  if (!storageId || !mongoose.isValidObjectId(storageId)) return notFound(res);
  const parsed = highlightSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ msg: "Enter the text to highlight and an optional note/page" });
    return;
  }
  try {
    const item = await markStoredFileHighlight({
      ownerId: req.userId!,
      storageId,
      ...parsed.data,
    });
    res.json({ item });
  } catch (error) {
    if (error instanceof Error && /not found/i.test(error.message)) return notFound(res);
    throw error;
  }
}
