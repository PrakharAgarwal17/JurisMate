import { randomUUID } from "node:crypto";
import userStorageModel from "../models/userStorageModel.js";

/** Save a user-selected fact in the storage room attached to a chat. */
export async function storeImportantInfo(input: {
  ownerId: string;
  chatId: string;
  title: string;
  content: string;
}) {
  const title = input.title.trim();
  const content = input.content.trim();
  if (!title || !content) throw new Error("Title and content are required");

  return userStorageModel.create({
    storageKey: randomUUID(),
    ownerId: input.ownerId,
    chatId: input.chatId,
    kind: "note",
    contextText: content,
  });
}
