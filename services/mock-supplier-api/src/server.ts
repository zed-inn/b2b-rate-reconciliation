import Fastify from "fastify";
import { SupplierRateResponseSchema } from "@auditsys/shared/src/schemas/supplier";
import { env } from "./config/env";

const server = Fastify();

function generateMockRates() {
  let netRate = "170.00";
  let taxAmount = "15.00";

  if (Math.random() > 0.85) {
    const anomalyType = Math.floor(Math.random() * 3);
    if (anomalyType === 0) netRate = "190.00";
    else if (anomalyType === 1) taxAmount = "20.00";
    else {
      netRate = "190.00";
      taxAmount = "20.00";
    }
  }
  return { netRate, taxAmount };
}

server.get("/api/rates/:booking_ref", async (request, reply) => {
  const { netRate, taxAmount } = generateMockRates();

  const responseData = {
    rooms: [{
      rates: [{
        net: netRate,
        taxes: {
          taxes: [{ amount: taxAmount, currency: "INR" }]
        }
      }]
    }]
  };

  return SupplierRateResponseSchema.parse(responseData);
});

server.listen({ port: env.PORT, host: env.HOST }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Mock Supplier API listening on ${address}`);
});
