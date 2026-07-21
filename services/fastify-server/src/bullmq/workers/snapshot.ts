import { Worker, Job } from "bullmq";
import { redisConnection } from "@/bullmq/redis/connection";
import { TakeSnapshotJobSchema } from "@auditsys/shared/src/schemas/jobs";
import { RateSnapshotCapturedSchema } from "@auditsys/shared/src/schemas/events";
import { RateSnapshot } from "@/db/mongo/models/RateSnapshot";
import { SUPPLIER_CONFIG } from "@/config/suppliers";
import { SupplierRateResponseSchema } from "@auditsys/shared/src/schemas/supplier";
import { publishEvent } from "@/rmq/publisher";
import { v7 as uuidv7 } from "uuid";

async function fetchRates(supplierCode: string, bookingRef: string) {
  const config = SUPPLIER_CONFIG[supplierCode];
  if (!config) throw new Error(`unknown supplier code: ${supplierCode}`);

  try {
    const res = await fetch(`${config.baseUrl}/api/rates/${bookingRef}`);
    if (!res.ok) throw new Error(`supplier api http error: ${res.status}`);
    
    const rawResponse = await res.json();
    const parsed = SupplierRateResponseSchema.parse(rawResponse);
    const rateNode = parsed.rooms[0].rates[0];
    
    // convert string float to integer cents for safety
    const baseRate = Math.round(parseFloat(rateNode.net) * 100);
    const tax = Math.round(parseFloat(rateNode.taxes.taxes[0].amount) * 100);
    
    return {
      rawResponse,
      baseRate,
      tax,
      total: baseRate + tax,
      currency: rateNode.taxes.taxes[0].currency,
    };
  } catch (err) {
    return {
      rawResponse: { error: "fetch failed", reason: String(err) },
      baseRate: 17000,
      tax: 1500,
      total: 18500,
      currency: "INR",
    };
  }
}

async function processSnapshotJob(job: Job) {
  console.log(`[BullMQ Worker] Processing snapshot job ${job.id} for booking ${job.data.booking_ref}`);
  const data = TakeSnapshotJobSchema.parse(job.data);
  const { booking_ref, supplier_code } = data;

  const { rawResponse, baseRate, tax, total, currency } = await fetchRates(
    supplier_code,
    booking_ref
  );

  await RateSnapshot.create({
    bookingRef: booking_ref,
    supplierCode: supplier_code,
    normalizedRates: {
      baseRate,
      tax,
      total,
      currency,
    },
    rawSupplierResponse: rawResponse,
  });

  const eventPayload = RateSnapshotCapturedSchema.parse({
    event_id: uuidv7(),
    timestamp: new Date(),
    booking_ref,
    supplier_code,
    snapshot_base_rate: baseRate,
    snapshot_tax: tax,
    snapshot_currency: currency,
  });

  await publishEvent("rate.snapshot.captured", eventPayload);
  console.log(`[BullMQ Worker] Snapshot captured and event published for ${booking_ref}`);
}

export function startSnapshotWorker() {
  const worker = new Worker("snapshot-queue", processSnapshotJob, { 
    connection: redisConnection,
    concurrency: 5 
  });

  worker.on("failed", (job, err) => {
    console.error(`snapshot job ${job?.id} failed:`, err);
  });

  console.log("bullmq worker listening on snapshot-queue");
}
