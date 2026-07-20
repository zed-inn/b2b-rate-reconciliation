import { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { UploadInvoiceRequestSchema } from "@auditsys/shared/src/schemas/api";
import { BookingInvoicedSchema } from "@auditsys/shared/src/schemas/events";
import { v7 as uuidv7 } from "uuid";
import { db } from "@/db/postgres/connection";
import { bookings } from "@/db/postgres/schema";
import { and, eq } from "drizzle-orm";
import { publishEvent } from "@/rmq/publisher";

const invoiceRoutes: FastifyPluginAsyncZod = async (server) => {
  server.post(
    "/api/invoices",
    { schema: { body: UploadInvoiceRequestSchema } },
    async (request, reply) => {
      const invoices = request.body;

      for (const invoice of invoices) {
        await db
          .update(bookings)
          .set({
            invoicedBaseRate: invoice.invoiced_base_rate,
            invoicedTax: invoice.invoiced_tax,
            invoicedCurrency: invoice.invoiced_currency,
            status: "INVOICED",
          })
          .where(
            and(
              eq(bookings.bookingRef, invoice.booking_ref),
              eq(bookings.supplierCode, invoice.supplier_code)
            )
          );

        const eventPayload = BookingInvoicedSchema.parse({
          event_id: uuidv7(),
          timestamp: new Date(),
          booking_ref: invoice.booking_ref,
          supplier_code: invoice.supplier_code,
          invoiced_base_rate: invoice.invoiced_base_rate,
          invoiced_tax: invoice.invoiced_tax,
          invoiced_currency: invoice.invoiced_currency,
        });
        await publishEvent("booking.invoiced", eventPayload);
      }

      return reply.code(200).send({ status: "INVOICED_PROCESSED", count: invoices.length });
    }
  );
};

export default invoiceRoutes;
