import { pgTable, uuid, varchar, integer, timestamp } from "drizzle-orm/pg-core";

export const bookings = pgTable("bookings", {
  id: uuid("id").primaryKey(),
  bookingRef: varchar("booking_ref", { length: 50 }).notNull().unique(),
  supplierCode: varchar("supplier_code", { length: 20 }).notNull(),

  // Quoted values at booking
  quotedBaseRate: integer("quoted_base_rate").notNull(),
  quotedTax: integer("quoted_tax").notNull(),
  quotedCurrency: varchar("quoted_currency", { length: 3 }).notNull(),

  // Invoiced values at checkout (nullable initially)
  invoicedBaseRate: integer("invoiced_base_rate"),
  invoicedTax: integer("invoiced_tax"),
  invoicedCurrency: varchar("invoiced_currency", { length: 3 }),

  checkInDate: timestamp("check_in_date", { withTimezone: true, mode: "date" }).notNull(),
  checkOutDate: timestamp("check_out_date", { withTimezone: true, mode: "date" }).notNull(),

  status: varchar("status", { length: 30 }).default("CREATED").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow(),
});
