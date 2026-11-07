import { Router, type RequestHandler } from "express";
import mongoose from "mongoose";
import chatModel from "../models/chatModel.js";
import userStorageModel from "../models/userStorageModel.js";
import { rateLimit } from "express-rate-limit";
import * as storage from "../controller/storageController.js";
import isLoggedIn from "../middleware/isLoggedIn.js";
import { uploadStorageFile } from "../middleware/uploadImage.js";

const router = Router();
const uploadLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });

router.use(isLoggedIn);
const roomAccess: RequestHandler = async (req, res, next) => {
  const chatId = req.params.chatId;
  const storageId = req.params.storageId;
  if (typeof chatId !== "string" && typeof storageId !== "string") { res.status(404).json({ msg: "Item not found" }); return; }
  if (!mongoose.isValidObjectId(chatId ?? storageId)) { res.status(404).json({ msg: "Item not found" }); return; }
  const item = storageId ? await userStorageModel.findById(storageId).select("chatId").lean() : null;
  const roomId = chatId ?? item?.chatId;
  if (!roomId) { res.status(404).json({ msg: "Item not found" }); return; }
  const room = await chatModel.findOne({ _id: roomId, $or: [{ ownerId: req.userId }, { collaborators: req.userId }] }).select("ownerId").lean();
  if (!room) { res.status(404).json({ msg: "Item not found" }); return; }
  req.userId = room.ownerId.toString();
  next();
};
router.use(["/chats/:chatId", "/items/:storageId"], roomAccess);
router.get("/chats/:chatId/items", storage.listChatStorage);
router.post("/chats/:chatId/files", uploadLimiter, uploadStorageFile, storage.uploadChatFile);
router.post("/chats/:chatId/import-switch", uploadLimiter, storage.importSwitchFiles);
router.post("/chats/:chatId/important", storage.saveImportantInformation);
router.post("/chats/:chatId/summarize", storage.summarizeChatRoom);
router.get("/items/:storageId/download", storage.getStorageDownload);
router.post("/items/:storageId/context", storage.extractFileContext);
router.post("/items/:storageId/analyze-image", storage.analyzeImage);
router.post("/items/:storageId/highlights", storage.addFileHighlight);

export default router;
