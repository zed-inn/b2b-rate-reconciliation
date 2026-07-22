import amqplib, { Channel, ConfirmChannel } from "amqplib";
import { env } from "@/config/env";

type RabbitConnection = Awaited<ReturnType<typeof amqplib.connect>>;

// global connection and channels to have only single tcp connection
export let connection: RabbitConnection | null = null;
export let channel: Channel | null = null;
export let confirmChannel: ConfirmChannel | null = null;

export async function connectRabbitMQ(retries = 10, delay = 5000) {
  for (let i = 0; i < retries; i++) {
    try {
      connection = await amqplib.connect(env.RABBITMQ_URL);
      channel = await connection.createChannel();
      confirmChannel = await connection.createConfirmChannel();
      await confirmChannel.assertExchange("auditsys.events", "topic", { durable: true });
      console.log("Connected to RabbitMQ");
      return;
    } catch (err) {
      console.error(`RabbitMQ connection failed, retrying in ${delay}ms... (${i + 1}/${retries})`);
      await new Promise((res) => setTimeout(res, delay));
    }
  }
  throw new Error("Failed to connect to RabbitMQ after multiple retries");
}

