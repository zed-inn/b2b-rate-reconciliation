import amqplib, { ConfirmChannel } from "amqplib";
import { env } from "@/config/env";

type RabbitConnection = Awaited<ReturnType<typeof amqplib.connect>>;

// global connection and channel to have only single tcp connection
let connection: RabbitConnection | null = null;
let channel: ConfirmChannel | null = null;

export async function connectRabbitMQ() {
  connection = await amqplib.connect(env.RABBITMQ_URL);
  channel = await connection!.createConfirmChannel(); // confirm channel for reliable publishing

  await channel!.assertExchange("auditsys.events", "topic", { durable: true });
  console.log("Connected to RabbitMQ");
}

export async function publishEvent(routingKey: string, payload: any): Promise<void> {
  if (!channel) throw new Error("RabbitMQ channel not initialized");

  return new Promise((resolve, reject) => {
    channel!.publish(
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
