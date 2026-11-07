import type { Request, Response } from "express";
import { unlink } from "node:fs/promises";
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
