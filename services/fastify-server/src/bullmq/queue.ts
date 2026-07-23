import { Queue } from "bullmq";
import { connectRedis, redisConnection } from "./redis/connection";
import { logger } from "@/utils/logger";

export const snapshotQueue = new Queue("snapshot-queue", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
});

export async function initBullMQ() {
  await connectRedis()
}

export async function closeBullMQ() {
  await snapshotQueue.close();
  logger.info("BullMQ queue closed.");
}
