import type { Order, OrderStage, Product, WarehouseState } from "./types";

export const available = (p: Product) => Math.max(0, p.onHand - p.reserved - p.damaged);

export const daysOfCover = (p: Product) =>
  p.dailyVelocity > 0 ? (p.onHand - p.damaged) / p.dailyVelocity : 99;

export type StockStatus = "out" | "critical" | "low" | "healthy" | "overstock";

export function stockStatus(p: Product): StockStatus {
  const av = available(p);
  if (av <= 0) return "out";
  if (daysOfCover(p) < p.leadTimeDays * 0.6) return "critical";
  if (p.onHand - p.damaged <= p.reorderPoint) return "low";
  if (daysOfCover(p) > 45) return "overstock";
  return "healthy";
}

const serviceWeight = { "same-day": 40, express: 26, standard: 12, economy: 4 } as const;
const tierWeight = { platinum: 22, gold: 12, standard: 4 } as const;

export interface PriorityResult {
  score: number;
  band: "critical" | "high" | "normal" | "low";
  hoursToSla: number;
  reasons: string[];
}

export function priority(order: Order, now: number): PriorityResult {
  const hoursToSla = (order.slaAt - now) / 3600_000;
  const reasons: string[] = [];

  let score = serviceWeight[order.service] + tierWeight[order.tier];
  reasons.push(`${order.service} service (+${serviceWeight[order.service]})`);
  reasons.push(`${order.tier} customer (+${tierWeight[order.tier]})`);

  let urgency = 0;
  if (hoursToSla <= 0) {
    urgency = 45;
    reasons.push("SLA already breached (+45)");
  } else if (hoursToSla < 4) {
    urgency = 34;
    reasons.push("under 4h to SLA (+34)");
  } else if (hoursToSla < 12) {
    urgency = 20;
    reasons.push("under 12h to SLA (+20)");
  } else if (hoursToSla < 24) {
    urgency = 10;
    reasons.push("under 24h to SLA (+10)");
  }
  score += urgency;

  const valueBonus = Math.min(18, Math.round(order.value / 350));
  score += valueBonus;
  reasons.push(`order value $${order.value.toLocaleString()} (+${valueBonus})`);

  const ageH = (now - order.placedAt) / 3600_000;
  if (ageH > 24) {
    score += 8;
    reasons.push("ageing >24h, anti-starvation boost (+8)");
  }

  const band: PriorityResult["band"] =
    score >= 85 ? "critical" : score >= 62 ? "high" : score >= 40 ? "normal" : "low";
  return { score, band, hoursToSla, reasons };
}

export interface LinePlan {
  sku: string;
  requested: number;
  grantable: number;
  short: number;
}

export interface AllocationPlan {
  orderId: string;
  lines: LinePlan[];
  fullyAllocatable: boolean;
  decision: "allocate-full" | "allocate-partial" | "backorder";
  rationale: string;
  contested: { sku: string; competingOrders: string[] }[];
}

/** Rank orders that still need stock, highest priority first. */
export function allocationQueue(state: WarehouseState): Order[] {
  return state.orders
    .filter((o) => o.stage === "created" || o.stage === "backorder")
    .sort((a, b) => priority(b, state.now).score - priority(a, state.now).score);
}

/** Simulate allocating the whole queue in priority order to expose contention. */
export function planAll(state: WarehouseState): AllocationPlan[] {
  const pool = new Map(state.products.map((p) => [p.sku, available(p)]));
  const queue = allocationQueue(state);
  const demand = new Map<string, string[]>();
  for (const o of queue)
    for (const l of o.lines) demand.set(l.sku, [...(demand.get(l.sku) ?? []), o.id]);

  return queue.map((o) => {
    const lines: LinePlan[] = o.lines.map((l) => {
      const need = l.qty - l.allocated;
      const have = pool.get(l.sku) ?? 0;
      const grantable = Math.max(0, Math.min(need, have));
      pool.set(l.sku, have - grantable);
      return { sku: l.sku, requested: need, grantable, short: need - grantable };
    });

    const totalShort = lines.reduce((s, l) => s + l.short, 0);
    const totalGrant = lines.reduce((s, l) => s + l.grantable, 0);
    const p = priority(o, state.now);
    const contested = lines
      .filter((l) => (demand.get(l.sku)?.length ?? 0) > 1)
      .map((l) => ({ sku: l.sku, competingOrders: (demand.get(l.sku) ?? []).filter((id) => id !== o.id) }));

    let decision: AllocationPlan["decision"];
    let rationale: string;
    if (totalShort === 0) {
      decision = "allocate-full";
      rationale = `Full stock available. Reserved ahead of ${contested.length ? contested[0]!.competingOrders.join(", ") : "no competing orders"} on priority score ${p.score}.`;
    } else if (totalGrant > 0 && (p.band === "critical" || p.band === "high")) {
      decision = "allocate-partial";
      rationale = `Split shipment recommended: reserve ${totalGrant} units now to protect the ${p.band === "critical" ? "breaching" : "tight"} SLA, backorder ${totalShort} units against the next inbound receipt.`;
    } else {
      decision = "backorder";
      rationale = `Hold ${totalShort} short units. Lower priority (score ${p.score}) — stock is better spent on higher-ranked orders competing for the same SKUs.`;
    }

    return { orderId: o.id, lines, fullyAllocatable: totalShort === 0, decision, rationale, contested };
  });
}

export function planFor(state: WarehouseState, orderId: string) {
  return planAll(state).find((p) => p.orderId === orderId);
}

export interface Reorder {
  sku: string;
  name: string;
  suggestedQty: number;
  urgency: "now" | "this-week" | "monitor";
  reason: string;
  cost: number;
}

export function reorderRecommendations(state: WarehouseState): Reorder[] {
  const openDemand = new Map<string, number>();
  for (const o of state.orders) {
    if (o.stage === "dispatched") continue;
    for (const l of o.lines) openDemand.set(l.sku, (openDemand.get(l.sku) ?? 0) + (l.qty - l.allocated));
  }

  return state.products
    .map((p) => {
      const cover = daysOfCover(p);
      const backlog = openDemand.get(p.sku) ?? 0;
      const deficit = Math.max(0, backlog - available(p));
      const status = stockStatus(p);
      if (status === "healthy" || status === "overstock") return null;
      const qty = Math.max(p.reorderQty, Math.ceil(deficit + p.dailyVelocity * p.leadTimeDays * 1.3));
      const urgency: Reorder["urgency"] = status === "out" || cover < p.leadTimeDays * 0.4 ? "now" : status === "critical" ? "this-week" : "monitor";
      const reason =
        status === "out"
          ? `Zero sellable stock with ${backlog} units of open demand. Every day late costs ~${p.dailyVelocity.toFixed(1)} units of throughput.`
          : `${cover.toFixed(1)} days of cover against a ${p.leadTimeDays}-day lead time${deficit ? `, ${deficit} units short of committed demand` : ""}.`;
      return { sku: p.sku, name: p.name, suggestedQty: qty, urgency, reason, cost: qty * p.unitCost };
    })
    .filter((r): r is Reorder => r !== null)
    .sort((a, b) => (a.urgency === b.urgency ? b.cost - a.cost : a.urgency === "now" ? -1 : b.urgency === "now" ? 1 : a.urgency === "this-week" ? -1 : 1));
}

/** Zone-serpentine pick route: minimise travel across zones and bin aisles. */
export function pickRoute(state: WarehouseState, order: Order) {
  const stops = order.lines.map((l) => {
    const p = state.products.find((x) => x.sku === l.sku)!;
    return { sku: l.sku, name: p.name, zone: p.zone, bin: p.bin, qty: l.allocated || l.qty };
  });
  stops.sort((a, b) => (a.zone === b.zone ? a.bin.localeCompare(b.bin) : a.zone.localeCompare(b.zone)));
  const zones = new Set(stops.map((s) => s.zone));
  const walkMeters = 30 + zones.size * 45 + stops.length * 12;
  return { stops, zones: [...zones], walkMeters, estMinutes: Math.round(walkMeters / 60 + stops.length * 0.8) };
}

export const STAGE_FLOW: OrderStage[] = ["created", "allocated", "picking", "packing", "qc", "dispatched"];

export function nextStage(stage: OrderStage): OrderStage | null {
  const i = STAGE_FLOW.indexOf(stage);
  if (i < 0 || i === STAGE_FLOW.length - 1) return null;
  return STAGE_FLOW[i + 1] ?? null;
}

export interface Bottleneck {
  stage: OrderStage;
  count: number;
  atRisk: number;
  label: string;
}

export function bottlenecks(state: WarehouseState): Bottleneck[] {
  return STAGE_FLOW.filter((s) => s !== "dispatched").map((stage) => {
    const inStage = state.orders.filter((o) => o.stage === stage);
    const atRisk = inStage.filter((o) => priority(o, state.now).hoursToSla < 4).length;
    return {
      stage,
      count: inStage.length,
      atRisk,
      label: stage === "created" ? "Awaiting allocation" : stage[0]!.toUpperCase() + stage.slice(1),
    };
  });
}

export function kpis(state: WarehouseState) {
  const open = state.orders.filter((o) => o.stage !== "dispatched");
  const breached = open.filter((o) => o.slaAt < state.now).length;
  const atRisk = open.filter((o) => o.slaAt >= state.now && o.slaAt - state.now < 4 * 3600_000).length;
  const fillable = state.orders.filter((o) => o.lines.every((l) => l.allocated >= l.qty)).length;
  const stockValue = state.products.reduce((s, p) => s + (p.onHand - p.damaged) * p.unitCost, 0);
  const damagedUnits = state.products.reduce((s, p) => s + p.damaged, 0);
  return {
    openOrders: open.length,
    breached,
    atRisk,
    fillRate: Math.round((fillable / state.orders.length) * 100),
    stockValue,
    damagedUnits,
    outOfStock: state.products.filter((p) => available(p) <= 0).length,
    lowStock: state.products.filter((p) => ["low", "critical"].includes(stockStatus(p))).length,
  };
}