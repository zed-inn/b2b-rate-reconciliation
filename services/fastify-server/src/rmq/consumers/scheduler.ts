import { channel } from "@/rmq/connection";
import { env } from "@/config/env";
import { BookingCreatedSchema } from "@auditsys/shared/src/schemas/events";
import { TakeSnapshotJobSchema } from "@auditsys/shared/src/schemas/jobs";
import { snapshotQueue } from "@/bullmq/queue";

const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

function calculateDelay(checkInDate: Date): number {
  if (env.DEMO_MODE) {
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
  console.log("Scheduler Consumer listening on fastify.scheduler.queue");

  channel.consume(q.queue, async (msg) => {
    if (!msg) return;

    try {
      const rawPayload = JSON.parse(msg.content.toString());
      const event = BookingCreatedSchema.parse(rawPayload);

      const delayMs = calculateDelay(event.check_in_date);

      const jobPayload = TakeSnapshotJobSchema.parse({
        booking_ref: event.booking_ref,
        supplier_code: event.supplier_code,
      });

      await snapshotQueue.add("capture", jobPayload, {
        delay: delayMs,
        jobId: `snapshot-${event.booking_ref}`, // idempotency key
      });

      console.log(`[RMQ Consumer] Scheduled snapshot for ${event.booking_ref} in ${delayMs}ms`);
      channel!.ack(msg);
    } catch (err) {
      console.error("[RMQ Consumer] Error processing message:", err);
      channel!.nack(msg, false, false); // nack and drop to avoid infinite retry loops
    }
  });
}
