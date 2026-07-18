import { z } from "zod";

const AmountSchema = z.int().nonnegative();
const CurrencySchema = z.enum(["USD", "INR"]);

export const BookingCreatedSchema = z.object({
  event_id: z.uuidv7(),
  timestamp: z.coerce.date(),
  booking_ref: z.string().max(50),
  supplier_code: z.string().max(20),
  quoted_base_rate: AmountSchema,
  quoted_tax: AmountSchema,
  quoted_currency: CurrencySchema,
  check_in_date: z.coerce.date(),
  check_out_date: z.coerce.date(),
});

export const RateSnapshotCapturedSchema = z.object({
  event_id: z.uuidv7(),
  timestamp: z.coerce.date(),
  booking_ref: z.string().max(50),
  supplier_code: z.string().max(20),
  snapshot_base_rate: AmountSchema,
  snapshot_tax: AmountSchema,
  snapshot_currency: CurrencySchema,
});

export const BookingInvoicedSchema = z.object({
  event_id: z.uuidv7(),
  timestamp: z.coerce.date(),
  booking_ref: z.string().max(50),
  supplier_code: z.string().max(20),
  invoiced_base_rate: AmountSchema,
  invoiced_tax: AmountSchema,
  invoiced_currency: CurrencySchema,
});

export type BookingCreatedEvent = z.infer<typeof BookingCreatedSchema>;
export type RateSnapshotCapturedEvent = z.infer<typeof RateSnapshotCapturedSchema>;
export type BookingInvoicedEvent = z.infer<typeof BookingInvoicedSchema>;
