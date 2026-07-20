import Redis from "ioredis";
import { env } from "@/config/env";

export const redisConnection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

export async function connectRedis() {
  await redisConnection.ping();
  console.log("Redis connected");
}
