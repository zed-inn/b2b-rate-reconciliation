import { z } from "zod";

export const TakeSnapshotJobSchema = z.object({
  booking_ref: z.string().max(50),
  supplier_code: z.string().max(20),
});

export type TakeSnapshotJob = z.infer<typeof TakeSnapshotJobSchema>;
