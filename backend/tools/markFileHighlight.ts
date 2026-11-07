import userStorageModel from "../models/userStorageModel.js";

/** Store a user-requested passage marker without changing the source file. */
export async function markFileHighlight(input: {
  ownerId: string;
  storageId: string;
  text: string;
  instruction?: string;
  page?: number;
}) {
  const text = input.text.trim();
  if (!text) throw new Error("Text to highlight is required");
  if (input.page !== undefined && (!Number.isInteger(input.page) || input.page < 1)) {
    throw new Error("Page must be a positive integer");
  }

  const item = await userStorageModel.findOneAndUpdate(
    { _id: input.storageId, ownerId: input.ownerId, kind: "file" },
    {
      $push: {
        highlights: {
          text,
          instruction: input.instruction?.trim(),
          page: input.page,
          createdAt: new Date(),
        },
      },
    },
    { new: true },
  );
  if (!item) throw new Error("Stored file not found");
  return item;
}
