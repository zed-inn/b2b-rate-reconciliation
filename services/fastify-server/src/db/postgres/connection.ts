import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { env } from "../../config/env";

// disable prefetch to avoid issues if we add PgBouncer later
const queryClient = postgres(env.DATABASE_URL, { max: 10 });
export const db = drizzle(queryClient, { schema });
