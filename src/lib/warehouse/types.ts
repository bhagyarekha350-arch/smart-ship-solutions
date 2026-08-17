export type Zone = "A" | "B" | "C" | "D";

export interface Product {
  sku: string;
  name: string;
  category: string;
  zone: Zone;
  bin: string;
  onHand: number;
  reserved: number;
  damaged: number;
  reorderPoint: number;
  reorderQty: number;
  leadTimeDays: number;
  dailyVelocity: number;
  unitCost: number;
}

export type OrderStage =
  | "created"
  | "allocated"
  | "picking"
  | "packing"
  | "qc"
  | "dispatched"
  | "backorder"
  | "exception";

export type ServiceLevel = "same-day" | "express" | "standard" | "economy";

export interface OrderLine {
  sku: string;
  qty: number;
  allocated: number;
}

export interface Order {
  id: string;
  customer: string;
  tier: "platinum" | "gold" | "standard";
  service: ServiceLevel;
  placedAt: number;
  slaAt: number;
  value: number;
  lines: OrderLine[];
  stage: OrderStage;
  note?: string | undefined;
  picker?: string | undefined;
}

export interface EventLog {
  id: string;
  at: number;
  orderId?: string;
  sku?: string;
  kind: "info" | "decision" | "exception" | "success";
  message: string;
}

export interface WarehouseState {
  products: Product[];
  orders: Order[];
  events: EventLog[];
  now: number;
}