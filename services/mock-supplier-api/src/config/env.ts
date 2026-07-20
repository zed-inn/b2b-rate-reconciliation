import { z } from "zod";

const EnvSchema = z.object({
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default("0.0.0.0"),
});

export const env = EnvSchema.parse(process.env);
