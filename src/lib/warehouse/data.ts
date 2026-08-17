import type { Order, Product, WarehouseState } from "./types";

// Fixed clock so SSR and client render identically.
export const BASE_NOW = 1755435600000; // shift start
const H = 3600_000;

export const products: Product[] = [
  { sku: "SKU-1001", name: "Cordless Drill 18V", category: "Power Tools", zone: "A", bin: "A-04-12", onHand: 42, reserved: 12, damaged: 1, reorderPoint: 30, reorderQty: 80, leadTimeDays: 5, dailyVelocity: 9.4, unitCost: 62 },
  { sku: "SKU-1002", name: "Impact Driver Kit", category: "Power Tools", zone: "A", bin: "A-05-03", onHand: 7, reserved: 6, damaged: 0, reorderPoint: 20, reorderQty: 60, leadTimeDays: 5, dailyVelocity: 6.1, unitCost: 88 },
  { sku: "SKU-1003", name: "Safety Helmet XL", category: "Safety", zone: "B", bin: "B-01-08", onHand: 0, reserved: 0, damaged: 3, reorderPoint: 40, reorderQty: 150, leadTimeDays: 3, dailyVelocity: 12.7, unitCost: 14 },
  { sku: "SKU-1004", name: "Hi-Vis Vest (10pk)", category: "Safety", zone: "B", bin: "B-02-01", onHand: 118, reserved: 24, damaged: 0, reorderPoint: 50, reorderQty: 100, leadTimeDays: 3, dailyVelocity: 8.2, unitCost: 29 },
  { sku: "SKU-1005", name: "Steel Shelving Unit", category: "Storage", zone: "D", bin: "D-08-02", onHand: 26, reserved: 4, damaged: 2, reorderPoint: 15, reorderQty: 30, leadTimeDays: 12, dailyVelocity: 1.8, unitCost: 143 },
  { sku: "SKU-1006", name: "Pallet Wrap Roll", category: "Packaging", zone: "C", bin: "C-03-05", onHand: 260, reserved: 40, damaged: 0, reorderPoint: 120, reorderQty: 300, leadTimeDays: 2, dailyVelocity: 31.5, unitCost: 6 },
  { sku: "SKU-1007", name: "Thermal Label 4x6", category: "Packaging", zone: "C", bin: "C-01-11", onHand: 54, reserved: 30, damaged: 0, reorderPoint: 80, reorderQty: 200, leadTimeDays: 2, dailyVelocity: 22.3, unitCost: 11 },
  { sku: "SKU-1008", name: "Torque Wrench Set", category: "Hand Tools", zone: "A", bin: "A-09-07", onHand: 15, reserved: 11, damaged: 1, reorderPoint: 18, reorderQty: 40, leadTimeDays: 7, dailyVelocity: 3.9, unitCost: 74 },
  { sku: "SKU-1009", name: "LED Work Light", category: "Lighting", zone: "B", bin: "B-06-04", onHand: 88, reserved: 9, damaged: 0, reorderPoint: 35, reorderQty: 90, leadTimeDays: 6, dailyVelocity: 5.4, unitCost: 38 },
  { sku: "SKU-1010", name: "Nitrile Gloves (100)", category: "Safety", zone: "B", bin: "B-03-09", onHand: 31, reserved: 26, damaged: 0, reorderPoint: 60, reorderQty: 240, leadTimeDays: 4, dailyVelocity: 18.9, unitCost: 9 },
  { sku: "SKU-1011", name: "Heavy Duty Castor", category: "Storage", zone: "D", bin: "D-02-06", onHand: 410, reserved: 60, damaged: 5, reorderPoint: 150, reorderQty: 400, leadTimeDays: 9, dailyVelocity: 26.0, unitCost: 4 },
  { sku: "SKU-1012", name: "Digital Multimeter", category: "Instruments", zone: "A", bin: "A-11-02", onHand: 12, reserved: 2, damaged: 0, reorderPoint: 14, reorderQty: 35, leadTimeDays: 8, dailyVelocity: 2.6, unitCost: 57 },
];

export const orders: Order[] = [
  { id: "ORD-4821", customer: "Northgate Industrial", tier: "platinum", service: "same-day", placedAt: BASE_NOW - 1.5 * H, slaAt: BASE_NOW + 2 * H, value: 4210, stage: "created", lines: [ { sku: "SKU-1002", qty: 10, allocated: 0 }, { sku: "SKU-1007", qty: 6, allocated: 0 } ] },
  { id: "ORD-4822", customer: "Bellweather Ltd", tier: "standard", service: "standard", placedAt: BASE_NOW - 6 * H, slaAt: BASE_NOW + 26 * H, value: 640, stage: "created", lines: [ { sku: "SKU-1002", qty: 5, allocated: 0 } ] },
  { id: "ORD-4823", customer: "Halcyon Build Co", tier: "gold", service: "express", placedAt: BASE_NOW - 3 * H, slaAt: BASE_NOW + 5 * H, value: 1880, stage: "created", lines: [ { sku: "SKU-1010", qty: 12, allocated: 0 }, { sku: "SKU-1004", qty: 4, allocated: 0 } ] },
  { id: "ORD-4824", customer: "Sierra Facilities", tier: "standard", service: "economy", placedAt: BASE_NOW - 20 * H, slaAt: BASE_NOW + 50 * H, value: 320, stage: "created", lines: [ { sku: "SKU-1003", qty: 8, allocated: 0 } ] },
  { id: "ORD-4825", customer: "Kestrel Logistics", tier: "gold", service: "express", placedAt: BASE_NOW - 0.6 * H, slaAt: BASE_NOW + 7 * H, value: 2960, stage: "created", lines: [ { sku: "SKU-1006", qty: 40, allocated: 0 }, { sku: "SKU-1011", qty: 60, allocated: 0 } ] },
  { id: "ORD-4826", customer: "Orion Maintenance", tier: "platinum", service: "express", placedAt: BASE_NOW - 4.2 * H, slaAt: BASE_NOW + 1 * H, value: 1520, stage: "picking", picker: "R. Mehta", lines: [ { sku: "SKU-1008", qty: 6, allocated: 6 }, { sku: "SKU-1012", qty: 2, allocated: 2 } ] },
  { id: "ORD-4827", customer: "Vantage Retail", tier: "standard", service: "standard", placedAt: BASE_NOW - 9 * H, slaAt: BASE_NOW + 15 * H, value: 890, stage: "packing", picker: "L. Osei", lines: [ { sku: "SKU-1009", qty: 9, allocated: 9 } ] },
  { id: "ORD-4828", customer: "Pinewood Group", tier: "gold", service: "standard", placedAt: BASE_NOW - 12 * H, slaAt: BASE_NOW + 9 * H, value: 1130, stage: "qc", picker: "A. Duarte", lines: [ { sku: "SKU-1004", qty: 20, allocated: 20 }, { sku: "SKU-1006", qty: 10, allocated: 10 } ] },
  { id: "ORD-4829", customer: "Meridian Works", tier: "standard", service: "standard", placedAt: BASE_NOW - 30 * H, slaAt: BASE_NOW - 2 * H, value: 470, stage: "picking", picker: "R. Mehta", note: "Bin B-03-09 short by 4 units", lines: [ { sku: "SKU-1010", qty: 14, allocated: 14 } ] },
  { id: "ORD-4830", customer: "Cobalt Energy", tier: "platinum", service: "same-day", placedAt: BASE_NOW - 0.2 * H, slaAt: BASE_NOW + 3 * H, value: 5400, stage: "created", lines: [ { sku: "SKU-1001", qty: 12, allocated: 0 }, { sku: "SKU-1007", qty: 24, allocated: 0 } ] },
  { id: "ORD-4831", customer: "Ashford Depot", tier: "standard", service: "economy", placedAt: BASE_NOW - 44 * H, slaAt: BASE_NOW + 70 * H, value: 210, stage: "created", lines: [ { sku: "SKU-1011", qty: 30, allocated: 0 } ] },
  { id: "ORD-4832", customer: "Lumen Fitout", tier: "gold", service: "standard", placedAt: BASE_NOW - 26 * H, slaAt: BASE_NOW - 30 * 60000, value: 1740, stage: "dispatched", picker: "L. Osei", lines: [ { sku: "SKU-1009", qty: 14, allocated: 14 } ] },
];

export const initialState: WarehouseState = {
  products: products.map((p) => ({ ...p })),
  orders: orders.map((o) => ({ ...o, lines: o.lines.map((l) => ({ ...l })) })),
  now: BASE_NOW,
  events: [
    { id: "e1", at: BASE_NOW - 2 * H, kind: "exception", orderId: "ORD-4829", message: "Pick shortage reported at bin B-03-09 — 4 units missing." },
    { id: "e2", at: BASE_NOW - 5 * H, kind: "info", sku: "SKU-1003", message: "SKU-1003 hit zero on-hand. 3 units quarantined as damaged." },
    { id: "e3", at: BASE_NOW - 7 * H, kind: "success", orderId: "ORD-4832", message: "ORD-4832 dispatched via Kestrel route 14." },
  ],
};