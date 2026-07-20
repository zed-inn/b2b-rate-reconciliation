import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { connectMongo } from "@/db/mongo/connection";
import { connectRabbitMQ } from "@/rmq/publisher";
import { initBullMQ } from "@/bullmq/queue";
import { env } from "@/config/env";
import bookingRoutes from "@/routes/bookings";
import invoiceRoutes from "@/routes/invoices";
import evidenceRoutes from "@/routes/evidence";

const server = Fastify({
  logger: true,
});

server.setValidatorCompiler(validatorCompiler);
server.setSerializerCompiler(serializerCompiler);

server.get("/health", async () => {
  return { status: "ok", service: "fastify-server" };
});

server.register(bookingRoutes);
server.register(invoiceRoutes);
server.register(evidenceRoutes);

async function start() {
  try {
    await connectMongo();
    await connectRabbitMQ();
    await initBullMQ();

    // fastify with strictly validated env config
    await server.listen({ port: env.PORT, host: env.HOST });
    console.log(`Fastify Server listening on http://${env.HOST}:${env.PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

start();
