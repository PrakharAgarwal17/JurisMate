import mongoose from "mongoose";

const connectDb = async (): Promise<void> => {
  const mongoUrl = process.env.MONGO_URL;
  if (!mongoUrl) throw new Error("MONGO_URL is not configured");

  try {
    await mongoose.connect(mongoUrl, { dbName: "jurismate" });
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB failed to connect", error);
    throw error;
  }
};

export default connectDb;
