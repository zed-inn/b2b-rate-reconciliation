import { Queue } from "bullmq";
import { connectRedis, redisConnection } from "./redis/connection";

export const snapshotQueue = new Queue("snapshot-queue", {
  connection: redisConnection,
});

export async function initBullMQ() {
  await connectRedis()
}
