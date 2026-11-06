import mongoose, { type InferSchemaType } from "mongoose";

const switchRoomSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    platform: { type: String, enum: ["discord", "slack"], required: true },
    switchRoomId: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
  },
  { timestamps: true },
);

switchRoomSchema.index({ ownerId: 1, platform: 1, switchRoomId: 1 }, { unique: true });

export type SwitchRoom = InferSchemaType<typeof switchRoomSchema>;

const switchRoomModel = mongoose.models.SwitchRoom ?? mongoose.model("SwitchRoom", switchRoomSchema);
export default switchRoomModel;
