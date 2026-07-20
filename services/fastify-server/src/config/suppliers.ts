import { env } from "@/config/env";

export const SUPPLIER_CONFIG: Record<string, { baseUrl: string }> = {
  WEBBEDS: { baseUrl: env.DEMO_MODE ? "http://mock-supplier-api:4000" : process.env.WEBBEDS_API_URL! },
  TBO: { baseUrl: env.DEMO_MODE ? "http://mock-supplier-api:4000" : process.env.TBO_API_URL! },
};
