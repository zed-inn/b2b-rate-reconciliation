import { describe, it, expect } from "vitest";
import {
  BookingCreatedSchema,
  RateSnapshotCapturedSchema,
  BookingInvoicedSchema,
} from "../events";

describe("BookingCreatedSchema", () => {
  it("accepts a valid event with coerced date strings", () => {
    const result = BookingCreatedSchema.safeParse({
      event_id: "019577a0-0000-7000-8000-000000000000",
      timestamp: "2026-07-23T10:00:00Z",
      booking_ref: "BKG-001",
      supplier_code: "WEBBEDS",
      quoted_base_rate: 17000,
      quoted_tax: 1500,
      quoted_currency: "INR",
      check_in_date: "2026-08-15",
      check_out_date: "2026-08-20",
    });
    expect(result.success).toBe(true);
  });

  it("rejects event with non-UUIDv7 event_id", () => {
    const result = BookingCreatedSchema.safeParse({
      event_id: "not-a-uuid",
      timestamp: "2026-07-23T10:00:00Z",
      booking_ref: "BKG-001",
      supplier_code: "WEBBEDS",
      quoted_base_rate: 17000,
      quoted_tax: 1500,
      quoted_currency: "INR",
      check_in_date: "2026-08-15",
      check_out_date: "2026-08-20",
    });
    expect(result.success).toBe(false);
  });
});

describe("RateSnapshotCapturedSchema", () => {
  it("accepts a valid snapshot event", () => {
    const result = RateSnapshotCapturedSchema.safeParse({
      event_id: "019577a0-0000-7000-8000-000000000000",
      timestamp: new Date().toISOString(),
      booking_ref: "BKG-001",
      supplier_code: "TBO",
      snapshot_base_rate: 19000,
      snapshot_tax: 2000,
      snapshot_currency: "INR",
    });
    expect(result.success).toBe(true);
  });
});

describe("BookingInvoicedSchema", () => {
  it("accepts a valid invoice event", () => {
    const result = BookingInvoicedSchema.safeParse({
      event_id: "019577a0-0000-7000-8000-000000000000",
      timestamp: new Date().toISOString(),
      booking_ref: "BKG-001",
      supplier_code: "WEBBEDS",
      invoiced_base_rate: 17000,
      invoiced_tax: 1500,
      invoiced_currency: "INR",
    });
    expect(result.success).toBe(true);
  });
});
