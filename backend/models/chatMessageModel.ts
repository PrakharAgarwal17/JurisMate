import mongoose, { type InferSchemaType } from "mongoose";

const chatMessageSchema = new mongoose.Schema(
  {
    chatId: { type: mongoose.Schema.Types.ObjectId, ref: "Chat", required: true },
    switchMessageId: { type: String, required: true },
    senderId: { type: String, required: true },
    senderName: { type: String, required: true },
    body: { type: String, required: true },
    sentAt: { type: Date, required: true },
    threadId: { type: String },
  },
  { timestamps: true, collection: "chatmessages" },
);

chatMessageSchema.index({ chatId: 1, switchMessageId: 1 }, { unique: true });
chatMessageSchema.index({ chatId: 1, sentAt: -1 });

export type ChatMessage = InferSchemaType<typeof chatMessageSchema>;

const chatMessageModel = mongoose.models.ChatMessage ?? mongoose.model("ChatMessage", chatMessageSchema);
export default chatMessageModel;
