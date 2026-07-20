import { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { CreateBookingRequestSchema } from "@auditsys/shared/src/schemas/api";
import { BookingCreatedSchema } from "@auditsys/shared/src/schemas/events";
import { v7 as uuidv7 } from "uuid";
import { db } from "@/db/postgres/connection";
import { bookings } from "@/db/postgres/schema";
import { publishEvent } from "@/rmq/publisher";

const bookingRoutes: FastifyPluginAsyncZod = async (server) => {
  server.post(
    "/api/bookings",
    { schema: { body: CreateBookingRequestSchema } },
    async (request, reply) => {
      const data = request.body;
      const id = uuidv7();

      await db.insert(bookings).values({
        id,
        bookingRef: data.booking_ref,
        supplierCode: data.supplier_code,
        quotedBaseRate: data.quoted_base_rate,
        quotedTax: data.quoted_tax,
        quotedCurrency: data.quoted_currency,
        checkInDate: data.check_in_date,
        checkOutDate: data.check_out_date,
        status: "CREATED",
      });

      const eventPayload = BookingCreatedSchema.parse({
        event_id: uuidv7(),
        timestamp: new Date(),
        booking_ref: data.booking_ref,
        supplier_code: data.supplier_code,
        quoted_base_rate: data.quoted_base_rate,
        quoted_tax: data.quoted_tax,
        quoted_currency: data.quoted_currency,
        check_in_date: data.check_in_date,
        check_out_date: data.check_out_date,
      });
      await publishEvent("booking.created", eventPayload);

      return reply.code(201).send({ id, status: "CREATED" });
    }
  );
};

export default bookingRoutes;
