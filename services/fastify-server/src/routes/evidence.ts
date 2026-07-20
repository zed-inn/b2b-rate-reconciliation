import { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { RateSnapshot } from "@/db/mongo/models/RateSnapshot";

const evidenceRoutes: FastifyPluginAsyncZod = async (server) => {
  server.get(
    "/api/snapshots/:bookingRef",
    {
      schema: {
        params: z.object({ bookingRef: z.string() }),
      },
    },
    async (request, reply) => {
      const { bookingRef } = request.params;
      const snapshot = await RateSnapshot.findOne({ bookingRef });

      if (!snapshot) {
        return reply.code(404).send({ error: "Evidence not found" });
      }

      return reply.code(200).send(snapshot);
    }
  );
};

export default evidenceRoutes;
