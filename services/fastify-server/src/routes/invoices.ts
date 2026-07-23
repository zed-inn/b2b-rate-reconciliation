import { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { UploadInvoiceRequestSchema } from "@auditsys/shared/src/schemas/api";
import { BookingInvoicedSchema } from "@auditsys/shared/src/schemas/events";
import { v7 as uuidv7 } from "uuid";
import { db } from "@/db/postgres/connection";
import { bookings } from "@/db/postgres/schema";
import { and, eq } from "drizzle-orm";
import { publishEvent } from "@/rmq/publisher";
import { z } from "zod";

const invoiceRoutes: FastifyPluginAsyncZod = async (server) => {
  server.post(
    "/api/invoices",
    { schema: { body: UploadInvoiceRequestSchema } },
    async (request, reply) => {
      const invoices = request.body;
      const eventsToPublish: z.infer<typeof BookingInvoicedSchema>[] = [];

      // execute atomic DB transaction using Promise.all
      await db.transaction(async (tx) => {
        await Promise.all(
          invoices.map((invoice) =>
            tx
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
              )
          )
        );
      });

      // parse and Publish events only after DB transaction fully commits
      let publishedCount = 0;
      let failedPublishCount = 0;

      for (const invoice of invoices) {
        try {
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
          publishedCount++;
        } catch (err) {
          request.log.error({ err, booking_ref: invoice.booking_ref }, "Failed to publish invoice event to RMQ");
          failedPublishCount++;
        }
      }

      if (failedPublishCount > 0) {
        return reply.code(207).send({ 
          status: "PARTIAL_SUCCESS", 
          db_updated: invoices.length,
          events_published: publishedCount,
          events_failed: failedPublishCount
        });
      }

      return reply.code(200).send({ status: "INVOICED_PROCESSED", count: invoices.length });
    }
  );
};

export default invoiceRoutes;
