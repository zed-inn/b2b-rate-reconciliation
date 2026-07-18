import Fastify from "fastify";
import { connectMongo } from "./db/mongo/connection";
import { env } from "./config/env";

const server = Fastify({
  logger: true,
});

server.get("/health", async () => {
  return { status: "ok", service: "fastify-server" };
});

async function start() {
  try {
    await connectMongo();

    // fastify with strictly validated env config
    await server.listen({ port: env.PORT, host: env.HOST });
    console.log(`Fastify Server listening on http://${env.HOST}:${env.PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

start();
