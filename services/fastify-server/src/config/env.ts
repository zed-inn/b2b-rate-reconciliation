import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const EnvSchema = z.object({
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default("0.0.0.0"),
  NODE_ENV: z.enum(["dev", "prod"]).default("dev"),
  DATABASE_URL: z.string().min(1, "Postgres connection string is required"),
  MONGO_URI: z.string().min(1, "Mongo connection string is required"),
  RABBITMQ_URL: z.string().min(1, "RabbitMQ connection string is required").default("amqp://rabbitmq:5672"),
  REDIS_URL: z.string().min(1, "Redis connection string is required").default("redis://redis:6379"),
});

const _env = EnvSchema.safeParse(process.env);

if (!_env.success) {
  console.error("Invalid environment variables:\n", _env.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = _env.data;
