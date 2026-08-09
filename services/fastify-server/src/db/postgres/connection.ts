import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { env } from "@/config/env";
import { logger } from "@/utils/logger";

const queryClient = postgres(env.DATABASE_URL, { max: 10 });
export const db = drizzle(queryClient, { schema });

export async function disconnectPostgres() {
  await queryClient.end();
  logger.info("Postgres disconnected.");
}
