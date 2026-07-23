import { logger } from "./utils/logger";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import { connectMongo, disconnectMongo } from "@/db/mongo/connection";
import { connectRabbitMQ, closeRabbitMQ } from "@/rmq/connection";
import { startSchedulerConsumer, stopSchedulerConsumer } from "@/rmq/consumers/scheduler";
import { initBullMQ, closeBullMQ } from "@/bullmq/queue";
import { disconnectRedis } from "@/bullmq/redis/connection";
import { startSnapshotWorker, closeSnapshotWorker } from "@/bullmq/workers/snapshot";
import { env } from "@/config/env";
import bookingRoutes from "@/routes/bookings";
import invoiceRoutes from "@/routes/invoices";
import evidenceRoutes from "@/routes/evidence";
import metricsPlugin from 'fastify-metrics';
import { disconnectPostgres } from "@/db/postgres/connection";

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

    let isShuttingDown = false;
    const gracefulShutdown = async (signal: string) => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      logger.info(`Received ${signal}, shutting down gracefully...`);
      
      // prevent infinite hang
      setTimeout(() => {
        logger.error("Graceful shutdown timed out after 10s. Forcing exit.");
        process.exit(1);
      }, 10000).unref();

      // decouple teardown
      await server.close().catch(e => logger.error({ err: e }, "Error closing Fastify")); 
      await stopSchedulerConsumer().catch(e => logger.error({ err: e }, "Error stopping RMQ ingress"));
      await closeSnapshotWorker().catch(e => logger.error({ err: e }, "Error closing Snapshot Worker")); 
      await closeBullMQ().catch(e => logger.error({ err: e }, "Error closing BullMQ"));
      await closeRabbitMQ().catch(e => logger.error({ err: e }, "Error closing RMQ connection")); 
      await disconnectMongo().catch(e => logger.error({ err: e }, "Error closing MongoDB")); 
      await disconnectPostgres().catch(e => logger.error({ err: e }, "Error closing Postgres"));
      await disconnectRedis().catch(e => logger.error({ err: e }, "Error closing Redis"));
      
      logger.info("Graceful shutdown complete.");
      process.exit(0);
    };

    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

    // fastify with strictly validated env config
    await server.listen({ port: env.PORT, host: env.HOST });
    logger.info(`Fastify Server listening on http://${env.HOST}:${env.PORT}`);
  } catch (err) {
    logger.error({ err }, "Error starting server");
    process.exit(1);
  }
}

start();
