import userStorageModel from "../models/userStorageModel.js";

/** Find relevant notes and extracted file context inside one user's chat storage. */
export async function searchStoredContext(input: {
  ownerId: string;
  chatId: string;
  query: string;
}) {
  const query = input.query.trim();
  if (query.length < 2) throw new Error("Search query must contain at least 2 characters");

  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return userStorageModel
    .find({
      ownerId: input.ownerId,
      chatId: input.chatId,
      contextText: { $regex: escapedQuery, $options: "i" },
    })
    .select("storageKey kind contextText fileName createdAt")
    .limit(10)
    .lean();
}
