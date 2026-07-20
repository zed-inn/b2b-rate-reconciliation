import { confirmChannel } from "@/rmq/connection";

export async function publishEvent(routingKey: string, payload: any): Promise<void> {
  if (!confirmChannel) throw new Error("RabbitMQ channel not initialized");

  return new Promise((resolve, reject) => {
    confirmChannel!.publish(
      "auditsys.events",
      routingKey,
      Buffer.from(JSON.stringify(payload)),
      { persistent: true },
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}
