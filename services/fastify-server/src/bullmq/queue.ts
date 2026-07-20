import { Queue } from "bullmq";
import { connectRedis, redisConnection } from "./redis/connection";

export const snapshotQueue = new Queue("capture_snapshot", {
  connection: redisConnection,
});

export async function initBullMQ() {
  await connectRedis()
}
