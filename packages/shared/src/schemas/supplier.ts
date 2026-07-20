import { z } from "zod";

export const SupplierRateResponseSchema = z.object({
  rooms: z.array(
    z.object({
      rates: z.array(
        z.object({
          net: z.string(),
          taxes: z.object({
            taxes: z.array(
              z.object({
                amount: z.string(),
                currency: z.string(),
              })
            ).min(1),
          }),
        })
      ).min(1),
    })
  ).min(1),
});
