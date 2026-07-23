import { channel } from "@/rmq/connection";
import { env } from "@/config/env";
import { logger } from "@/utils/logger";
import { BookingCreatedSchema } from "@auditsys/shared/src/schemas/events";
import { TakeSnapshotJobSchema } from "@auditsys/shared/src/schemas/jobs";
import { snapshotQueue } from "@/bullmq/queue";

const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

let consumerTag: string | null = null;

export function calculateDelay(checkInDate: Date, demoMode: boolean = env.DEMO_MODE): number {
  if (demoMode) {
    return 10000; // 10 seconds in demo mode
  }
  const checkIn = new Date(checkInDate).getTime();
  const delayMs = checkIn - FORTY_EIGHT_HOURS_MS - Date.now();
  return delayMs < 0 ? 0 : delayMs; // snapshot immediate if check within 48 hrs
}

export async function startSchedulerConsumer() {
  if (!channel) throw new Error("RabbitMQ channel not initialized");

  // persistent queue for fastify workers
  const q = await channel.assertQueue("fastify.scheduler.queue", { durable: true });

  // bind queue for booking creation events
  await channel.bindQueue(q.queue, "auditsys.events", "booking.created");
  logger.info("Scheduler Consumer listening on fastify.scheduler.queue");

  const res = await channel.consume(q.queue, async (msg) => {
    if (!msg) return;

    try {
      logger.info(`[RMQ Consumer] Received message: ${msg.content.toString()}`);
      const rawPayload = JSON.parse(msg.content.toString());
      const event = BookingCreatedSchema.parse(rawPayload);
      logger.info(`[RMQ Consumer] Parsed event for ${event.booking_ref}`);

      const delayMs = calculateDelay(event.check_in_date);

      const jobPayload = TakeSnapshotJobSchema.parse({
        booking_ref: event.booking_ref,
        supplier_code: event.supplier_code,
      });

      await snapshotQueue.add("capture", jobPayload, {
        delay: delayMs,
        jobId: `snapshot-${event.booking_ref}`, // idempotency key
      });

      logger.info(`[RMQ Consumer] Scheduled snapshot for ${event.booking_ref} in ${delayMs}ms`);
      channel!.ack(msg);
    } catch (err) {
      logger.error({ err }, "[RMQ Consumer] Error processing message");
      channel!.nack(msg, false, false); // nack and drop to avoid infinite retry loops
    }
  });

  consumerTag = res.consumerTag;
}

export async function stopSchedulerConsumer() {
  if (channel && consumerTag) {
    logger.info("Cancelling Scheduler Consumer ingress...");
    await channel.cancel(consumerTag);
  }
}
