import { describe, it, expect } from "vitest";
import { CreateBookingRequestSchema, UploadInvoiceRequestSchema } from "../api";

describe("CreateBookingRequestSchema", () => {
  const validPayload = {
    booking_ref: "BKG-001",
    supplier_code: "WEBBEDS",
    quoted_base_rate: 17000,
    quoted_tax: 1500,
    quoted_currency: "INR",
    check_in_date: "2026-08-15",
    check_out_date: "2026-08-20",
  };

  it("accepts a valid booking payload", () => {
    const result = CreateBookingRequestSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("rejects negative quoted_base_rate", () => {
    const result = CreateBookingRequestSchema.safeParse({
      ...validPayload,
      quoted_base_rate: -100,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-INR currency", () => {
    const result = CreateBookingRequestSchema.safeParse({
      ...validPayload,
      quoted_currency: "USD",
    });
    expect(result.success).toBe(false);
  });

  it("rejects floating point rates (must be integer cents)", () => {
    const result = CreateBookingRequestSchema.safeParse({
      ...validPayload,
      quoted_base_rate: 170.50,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing required fields", () => {
    const result = CreateBookingRequestSchema.safeParse({
      booking_ref: "BKG-001",
    });
    expect(result.success).toBe(false);
  });
});

describe("UploadInvoiceRequestSchema", () => {
  it("accepts an array of invoice items", () => {
    const result = UploadInvoiceRequestSchema.safeParse([{
      booking_ref: "BKG-001",
      supplier_code: "WEBBEDS",
      invoiced_base_rate: 17000,
      invoiced_tax: 1500,
      invoiced_currency: "INR",
      invoice_date: "2026-08-22",
    }]);
    expect(result.success).toBe(true);
  });

  it("rejects a single object (must be array)", () => {
    const result = UploadInvoiceRequestSchema.safeParse({
      booking_ref: "BKG-001",
      supplier_code: "WEBBEDS",
      invoiced_base_rate: 17000,
      invoiced_tax: 1500,
      invoiced_currency: "INR",
      invoice_date: "2026-08-22",
    });
    expect(result.success).toBe(false);
  });
});
