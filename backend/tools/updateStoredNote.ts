import userStorageModel from "../models/userStorageModel.js";

/** Edit a saved note in a user's chat storage. Uploaded source files stay unchanged. */
export async function updateStoredNote(input: {
  ownerId: string;
  storageId: string;
  content: string;
}) {
  const content = input.content.trim();
  if (!content) throw new Error("Note content is required");

  const note = await userStorageModel.findOneAndUpdate(
    { _id: input.storageId, ownerId: input.ownerId, kind: "note" },
    { $set: { contextText: content } },
    { new: true, runValidators: true },
  );
  if (!note) throw new Error("Stored note not found");
  return note;
}
