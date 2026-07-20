import amqplib, { Channel, ConfirmChannel } from "amqplib";
import { env } from "@/config/env";

type RabbitConnection = Awaited<ReturnType<typeof amqplib.connect>>;

// global connection and channels to have only single tcp connection
export let connection: RabbitConnection | null = null;
export let channel: Channel | null = null;
export let confirmChannel: ConfirmChannel | null = null;

export async function connectRabbitMQ() {
  connection = await amqplib.connect(env.RABBITMQ_URL);

  channel = await connection.createChannel();
  confirmChannel = await connection.createConfirmChannel(); // confirm channel for reliable publishing

  await confirmChannel.assertExchange("auditsys.events", "topic", { durable: true });
  console.log("Connected to RabbitMQ");
}
