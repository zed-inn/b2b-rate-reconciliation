import { z } from "zod";

const AmountSchema = z.int().nonnegative();
const CurrencySchema = z.enum(["USD", "INR"]);

export const CreateBookingRequestSchema = z.object({
  booking_ref: z.string().max(50),
  supplier_code: z.string().max(20),
  quoted_base_rate: AmountSchema,
  quoted_tax: AmountSchema,
  quoted_currency: CurrencySchema,
  check_in_date: z.coerce.date(),
  check_out_date: z.coerce.date(),
});

export const InvoiceItemSchema = z.object({
  booking_ref: z.string().max(50),
  supplier_code: z.string().max(20),
  invoiced_base_rate: AmountSchema,
  invoiced_tax: AmountSchema,
  invoiced_currency: CurrencySchema,
  invoice_date: z.coerce.date(),
});

export const UploadInvoiceRequestSchema = z.array(InvoiceItemSchema);

export type CreateBookingRequest = z.infer<typeof CreateBookingRequestSchema>;
export type InvoiceItem = z.infer<typeof InvoiceItemSchema>;
export type UploadInvoiceRequest = z.infer<typeof UploadInvoiceRequestSchema>;
