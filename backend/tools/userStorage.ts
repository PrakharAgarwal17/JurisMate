import path from "node:path";
import chatModel from "../models/chatModel.js";
import userStorageModel from "../models/userStorageModel.js";
import { analyzeImageBytes, detectFileKind, extractPdfContext } from "./fileContext.js";
import { createTemporaryDownloadUrl, deleteCloudinaryAsset, uploadLocalFile } from "./cloudinaryStorage.js";

export async function uploadUserFile(input: {
  ownerId: string;
  chatId: string;
  path: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
}) {
  const chat = await chatModel.findOne({ _id: input.chatId, ownerId: input.ownerId }).select("_id").lean();
  if (!chat) throw new Error("Chat not found");

  await detectFileKind(input.path, input.mimeType);
  const asset = await uploadLocalFile(input.path, {
    folder: "jurismate/user-storage",
    resource_type: "auto",
    type: "authenticated",
  });
  try {
    return await userStorageModel.create({
      ownerId: input.ownerId,
      chatId: chat._id,
      kind: "file",
      title: path.basename(input.originalName).slice(0, 200),
      fileName: path.basename(input.originalName).slice(0, 255),
      fileUrl: asset.secure_url,
      cloudinaryPublicId: asset.public_id,
      cloudinaryResourceType: asset.resource_type,
      cloudinaryFormat: asset.format,
      cloudinaryDeliveryType: asset.deliveryType,
      fileSize: input.fileSize,
      mimeType: input.mimeType,
      highlights: [],
    });
  } catch (error) {
    await deleteCloudinaryAsset(asset);
    throw error;
  }
}

async function loadOwnedStorageItem(storageId: string, ownerId: string) {
  const item = await userStorageModel.findOne({ _id: storageId, ownerId });
  if (!item) throw new Error("Stored item not found");
  return item;
}

export async function extractStoredFileContext(storageId: string, ownerId: string) {
  const item = await loadOwnedStorageItem(storageId, ownerId);
  if (item.kind !== "file" || !item.fileUrl || !item.mimeType) throw new Error("Stored file not found");
  if (item.contextText) {
    return { storageKey: item.storageKey, context: item.contextText, truncated: item.contextTruncated };
  }
  if (!item.cloudinaryPublicId || !item.cloudinaryResourceType || !item.cloudinaryFormat || !item.cloudinaryDeliveryType) {
    throw new Error("Stored file metadata is incomplete");
  }
  const download = createTemporaryDownloadUrl({
    public_id: item.cloudinaryPublicId,
    resource_type: item.cloudinaryResourceType,
    format: item.cloudinaryFormat,
    deliveryType: item.cloudinaryDeliveryType,
  });

  let context: string;
  let contextTruncated = false;
  if (item.mimeType === "application/pdf") {
    const result = await extractPdfContext(download.url);
    context = result.text;
    contextTruncated = result.truncated;
  } else {
    const response = await fetch(download.url, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error("Could not read image from Cloudinary");
    const analysis = await analyzeImageBytes(Buffer.from(await response.arrayBuffer()));
    item.imageAnalysis = analysis;
    context = analysis;
  }

  item.contextText = context.slice(0, 500_000);
  item.contextTruncated = contextTruncated || context.length > 500_000;
  await item.save();
  return { storageKey: item.storageKey, context: item.contextText, truncated: item.contextTruncated };
}

export async function analyzeStoredImage(storageId: string, ownerId: string) {
  const item = await loadOwnedStorageItem(storageId, ownerId);
  if (item.kind !== "file" || !item.cloudinaryPublicId || !item.mimeType?.startsWith("image/")) {
    throw new Error("Stored image not found");
  }
  if (item.imageAnalysis) return { storageKey: item.storageKey, analysis: item.imageAnalysis };
  if (!item.cloudinaryResourceType || !item.cloudinaryFormat || !item.cloudinaryDeliveryType) {
    throw new Error("Stored image metadata is incomplete");
  }
  const download = createTemporaryDownloadUrl({
    public_id: item.cloudinaryPublicId,
    resource_type: item.cloudinaryResourceType,
    format: item.cloudinaryFormat,
    deliveryType: item.cloudinaryDeliveryType,
  });
  const response = await fetch(download.url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error("Could not read image from Cloudinary");
  const analysis = await analyzeImageBytes(Buffer.from(await response.arrayBuffer()));
  item.imageAnalysis = analysis;
  item.contextText = analysis.slice(0, 500_000);
  item.contextTruncated = analysis.length > 500_000;
  await item.save();
  return { storageKey: item.storageKey, analysis };
}

export async function getStoredFileDownload(storageId: string, ownerId: string) {
  const item = await loadOwnedStorageItem(storageId, ownerId);
  if (
    item.kind !== "file" || !item.cloudinaryPublicId || !item.cloudinaryResourceType
    || !item.cloudinaryFormat || !item.cloudinaryDeliveryType
  ) throw new Error("Stored file not found");
  return {
    storageKey: item.storageKey,
    fileName: item.fileName,
    ...createTemporaryDownloadUrl({
      public_id: item.cloudinaryPublicId,
      resource_type: item.cloudinaryResourceType,
      format: item.cloudinaryFormat,
      deliveryType: item.cloudinaryDeliveryType,
    }),
  };
}

export async function storeImportantInformation(input: {
  ownerId: string;
  chatId: string;
  title: string;
  content: string;
  sourceMessageId?: string;
}) {
  const chat = await chatModel.findOne({ _id: input.chatId, ownerId: input.ownerId }).select("_id").lean();
  if (!chat) throw new Error("Chat not found");
  return userStorageModel.create({
    ownerId: input.ownerId,
    chatId: chat._id,
    kind: "note",
    title: input.title.trim(),
    contextText: input.content.trim(),
    sourceMessageId: input.sourceMessageId,
  });
}

export async function markStoredFileHighlight(input: {
  ownerId: string;
  storageId: string;
  quote: string;
  pageNumber?: number;
  note?: string;
}) {
  const item = await userStorageModel.findOneAndUpdate(
    { _id: input.storageId, ownerId: input.ownerId, kind: "file" },
    { $push: { highlights: { quote: input.quote.trim(), pageNumber: input.pageNumber, note: input.note?.trim() ?? "" } } },
    { new: true },
  );
  if (!item) throw new Error("Stored file not found");
  return item;
}

