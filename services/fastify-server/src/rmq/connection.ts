import { logger } from "@/utils/logger";
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
      logger.info("Connected to RabbitMQ");
      return;
    } catch (err) {
      logger.error(`RabbitMQ connection failed, retrying in ${delay}ms... (${i + 1}/${retries})`);
      await new Promise((res) => setTimeout(res, delay));
    }
  }
  throw new Error("Failed to connect to RabbitMQ after multiple retries");
}

export async function closeRabbitMQ() {
  try {
    if (connection) {
      await connection.close();
      logger.info("RabbitMQ connection closed.");
    }
  } catch (err) {
    logger.error({ err }, "Error closing RabbitMQ connection");
  }
}

