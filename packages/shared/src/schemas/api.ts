import { z } from "zod";

const AmountSchema = z.int().nonnegative();
const CurrencySchema = z.literal("INR");

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

export const AuditLedgerItemSchema = z.object({
  id: z.number().int(),
  booking_ref: z.string(),
  supplier_code: z.string(),
  status: z.string(),
  leakage_amount: z.number().int(),
  created_at: z.coerce.date(),
});

export const AuditLedgerResponseSchema = z.object({
  next: z.string().nullable().optional(),
  previous: z.string().nullable().optional(),
  results: z.array(AuditLedgerItemSchema),
});

export const DiscrepancyBreakdownSchema = z.object({
  quoted: z.number().int(),
  invoiced: z.number().int().optional(),
  snapshot: z.number().int().optional(),
  difference: z.number().int(),
  currency: z.string(),
  stage: z.enum(['invoice', 'snapshot']),
});

export const AuditDetailedResponseSchema = z.object({
  id: z.number().int(),
  booking_ref: z.string(),
  supplier_code: z.string(),
  quoted_base: z.number().int(),
  quoted_tax: z.number().int(),
  quoted_currency: z.string(),
  snapshot_base: z.number().int().nullable(),
  snapshot_tax: z.number().int().nullable(),
  snapshot_currency: z.string().nullable(),
  invoiced_base: z.number().int().nullable(),
  invoiced_tax: z.number().int().nullable(),
  invoiced_currency: z.string().nullable(),
  check_in_date: z.coerce.date(),
  check_out_date: z.coerce.date(),
  status: z.string(),
  leakage_amount: z.number().int(),
  discrepancy_breakdown: DiscrepancyBreakdownSchema.nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export const SupplierRiskItemSchema = z.object({
  id: z.number().int(),
  supplier_code: z.string(),
  total_audits: z.number().int().nonnegative(),
  failed_audits: z.number().int().nonnegative(),
  risk_score: z.number(),
  last_calculated: z.coerce.date().nullable(),
});

export const SupplierRiskResponseSchema = z.array(SupplierRiskItemSchema);

export type AuditLedgerItem = z.infer<typeof AuditLedgerItemSchema>;
export type AuditLedgerResponse = z.infer<typeof AuditLedgerResponseSchema>;
export type AuditDetailedResponse = z.infer<typeof AuditDetailedResponseSchema>;
export type SupplierRiskItem = z.infer<typeof SupplierRiskItemSchema>;
export type SupplierRiskResponse = z.infer<typeof SupplierRiskResponseSchema>;
