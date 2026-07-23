import { logger } from "@/utils/logger";
import mongoose from "mongoose";
import { env } from "@/config/env";

export async function connectMongo() {
  await mongoose.connect(env.MONGO_URI);
  logger.info("Connected to MongoDB");
}

export async function disconnectMongo() {
  await mongoose.connection.close();
  logger.info("MongoDB disconnected.");
}
