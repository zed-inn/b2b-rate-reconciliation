import { env } from "@/config/env";
import { z } from "zod";

const SupplierEnvSchema = z.object({
  WEBBEDS_API_URL: z.url().optional(),
  TBO_API_URL: z.url().optional(),
  MOCK_API_URL: z.url().default("http://localhost:4000"),
});
const supplierEnv = SupplierEnvSchema.parse(process.env);

export const SUPPLIER_CONFIG: Record<string, { baseUrl: string }> = {
  WEBBEDS: { baseUrl: env.DEMO_MODE ? supplierEnv.MOCK_API_URL : supplierEnv.WEBBEDS_API_URL! },
  TBO: { baseUrl: env.DEMO_MODE ? supplierEnv.MOCK_API_URL : supplierEnv.TBO_API_URL! },
};
