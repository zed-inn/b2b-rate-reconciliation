import mongoose from "mongoose";
import { env } from "../../config/env";

export async function connectMongo() {
  await mongoose.connect(env.MONGO_URI);
  console.log("Connected to MongoDB");
}
