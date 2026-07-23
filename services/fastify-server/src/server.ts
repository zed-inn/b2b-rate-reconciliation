import { logger } from "./utils/logger";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { connectMongo } from "@/db/mongo/connection";
import { connectRabbitMQ } from "@/rmq/connection";
import { startSchedulerConsumer } from "@/rmq/consumers/scheduler";
import { initBullMQ } from "@/bullmq/queue";
import { startSnapshotWorker } from "@/bullmq/workers/snapshot";
import { env } from "@/config/env";
import bookingRoutes from "@/routes/bookings";
import invoiceRoutes from "@/routes/invoices";
import evidenceRoutes from "@/routes/evidence";
import metricsPlugin from 'fastify-metrics';

const server = Fastify({
  logger: true,
});

server.setValidatorCompiler(validatorCompiler);
server.setSerializerCompiler(serializerCompiler);

server.register(swagger, {
  openapi: {
    info: { title: "Reconciliation Ingestion API", version: "1.0.0" },
  },
});
server.register(swaggerUi, { routePrefix: "/docs" });

server.get("/health", async () => {
  return { status: "ok", service: "fastify-server" };
});

server.register(bookingRoutes);
server.register(invoiceRoutes);
server.register(evidenceRoutes);

server.register(metricsPlugin, {
  endpoint: '/metrics'
});

async function start() {
  try {
    await connectMongo();
    await connectRabbitMQ();
    await startSchedulerConsumer();
    await initBullMQ();
    startSnapshotWorker();

    // fastify with strictly validated env config
    await server.listen({ port: env.PORT, host: env.HOST });
    logger.info(`Fastify Server listening on http://${env.HOST}:${env.PORT}`);
  } catch (err) {
    logger.error({ err }, "Error starting server");
    process.exit(1);
  }
}

start();
