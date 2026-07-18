import mongoose from "mongoose";

const SnapshotSchema = new mongoose.Schema({
  bookingRef: { type: String, required: true, index: true },
  supplierCode: { type: String, required: true },
  capturedAt: { type: Date, default: Date.now, index: { expires: '90d' } },
  normalizedRates: {
    baseRate: { type: Number, required: true },
    tax: { type: Number, required: true },
    total: { type: Number, required: true },
    currency: { type: String, required: true },
  },
  rawSupplierResponse: { type: mongoose.Schema.Types.Mixed, required: true },
});

export const RateSnapshot = mongoose.model("RateSnapshot", SnapshotSchema);
