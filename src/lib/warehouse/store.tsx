import { createContext, useContext, useMemo, useReducer, type ReactNode } from "react";
import { initialState } from "./data";
import { available, nextStage, planFor } from "./engine";
import type { EventLog, Order, WarehouseState } from "./types";

type Action =
  | { type: "allocate"; orderId: string; mode: "full" | "partial" | "backorder" }
  | { type: "allocate-all" }
  | { type: "advance"; orderId: string }
  | { type: "assign"; orderId: string; picker: string }
  | { type: "flag-exception"; orderId: string; note: string }
  | { type: "report-damage"; sku: string; qty: number }
  | { type: "receive"; sku: string; qty: number }
  | { type: "cycle-count"; sku: string; counted: number }
  | { type: "reset" };

let seq = 0;
const logEvent = (s: WarehouseState, e: Omit<EventLog, "id" | "at">): EventLog[] => [
  { id: `ev-${++seq}`, at: s.now, ...e },
  ...s.events,
];

function applyAllocation(state: WarehouseState, orderId: string, mode: "full" | "partial" | "backorder"): WarehouseState {
  const plan = planFor(state, orderId);
  const order = state.orders.find((o) => o.id === orderId);
  if (!plan || !order) return state;

  if (mode === "backorder") {
    return {
      ...state,
      orders: state.orders.map((o) => (o.id === orderId ? { ...o, stage: "backorder", note: "Held — stock reserved for higher-priority demand" } : o)),
      events: logEvent(state, { kind: "decision", orderId, message: `${orderId} placed on backorder; stock protected for higher-priority orders.` }),
    };
  }

  const products = state.products.map((p) => {
    const line = plan.lines.find((l) => l.sku === p.sku);
    if (!line) return p;
    const grant = mode === "full" ? Math.min(line.requested, available(p)) : line.grantable;
    return { ...p, reserved: p.reserved + grant };
  });

  const orders = state.orders.map((o) => {
    if (o.id !== orderId) return o;
    const lines = o.lines.map((l) => {
      const line = plan.lines.find((x) => x.sku === l.sku);
      return line ? { ...l, allocated: l.allocated + line.grantable } : l;
    });
    const complete = lines.every((l) => l.allocated >= l.qty);
    return {
      ...o,
      lines,
      stage: complete ? ("allocated" as const) : ("allocated" as const),
      note: complete ? undefined : "Partial allocation — split shipment, remainder backordered",
    };
  });

  const shorted = plan.lines.reduce((s, l) => s + l.short, 0);
  return {
    ...state,
    products,
    orders,
    events: logEvent(state, {
      kind: shorted ? "decision" : "success",
      orderId,
      message: shorted
        ? `${orderId} partially allocated — ${plan.lines.reduce((s, l) => s + l.grantable, 0)} units reserved, ${shorted} backordered.`
        : `${orderId} fully allocated and released to picking queue.`,
    }),
  };
}

function reducer(state: WarehouseState, action: Action): WarehouseState {
  switch (action.type) {
    case "allocate":
      return applyAllocation(state, action.orderId, action.mode);

    case "allocate-all": {
      let next = state;
      const queue = state.orders.filter((o) => o.stage === "created" || o.stage === "backorder");
      for (const o of queue) {
        const plan = planFor(next, o.id);
        if (!plan) continue;
        next = applyAllocation(next, o.id, plan.decision === "backorder" ? "backorder" : "partial");
      }
      return { ...next, events: logEvent(next, { kind: "decision", message: `Auto-allocation run complete across ${queue.length} orders using priority-weighted fair share.` }) };
    }

    case "advance": {
      const order = state.orders.find((o) => o.id === action.orderId);
      if (!order) return state;
      const ns = nextStage(order.stage === "backorder" || order.stage === "exception" ? "created" : order.stage);
      if (!ns) return state;

      let products = state.products;
      if (ns === "dispatched") {
        products = state.products.map((p) => {
          const line = order.lines.find((l) => l.sku === p.sku);
          if (!line) return p;
          return { ...p, onHand: p.onHand - line.allocated, reserved: Math.max(0, p.reserved - line.allocated) };
        });
      }
      return {
        ...state,
        products,
        orders: state.orders.map((o) => (o.id === action.orderId ? { ...o, stage: ns } : o)),
        events: logEvent(state, {
          kind: ns === "dispatched" ? "success" : "info",
          orderId: action.orderId,
          message: ns === "dispatched" ? `${action.orderId} dispatched — on-hand inventory decremented.` : `${action.orderId} moved to ${ns}.`,
        }),
      };
    }

    case "assign":
      return {
        ...state,
        orders: state.orders.map((o) => (o.id === action.orderId ? { ...o, picker: action.picker } : o)),
        events: logEvent(state, { kind: "info", orderId: action.orderId, message: `${action.picker} assigned to ${action.orderId}.` }),
      };

    case "flag-exception":
      return {
        ...state,
        orders: state.orders.map((o) => (o.id === action.orderId ? { ...o, stage: "exception", note: action.note } : o)),
        events: logEvent(state, { kind: "exception", orderId: action.orderId, message: `${action.orderId}: ${action.note}` }),
      };

    case "report-damage":
      return {
        ...state,
        products: state.products.map((p) => (p.sku === action.sku ? { ...p, damaged: p.damaged + action.qty } : p)),
        events: logEvent(state, { kind: "exception", sku: action.sku, message: `${action.qty} units of ${action.sku} quarantined as damaged/missing.` }),
      };

    case "receive":
      return {
        ...state,
        products: state.products.map((p) => (p.sku === action.sku ? { ...p, onHand: p.onHand + action.qty } : p)),
        events: logEvent(state, { kind: "success", sku: action.sku, message: `Goods-in: ${action.qty} units of ${action.sku} received and put away.` }),
      };

    case "cycle-count":
      return {
        ...state,
        products: state.products.map((p) => (p.sku === action.sku ? { ...p, onHand: action.counted } : p)),
        events: logEvent(state, { kind: "info", sku: action.sku, message: `Cycle count adjusted ${action.sku} to ${action.counted} units.` }),
      };

    case "reset":
      return { ...initialState, orders: initialState.orders.map((o) => ({ ...o, lines: o.lines.map((l) => ({ ...l })) })), products: initialState.products.map((p) => ({ ...p })) };
  }
}

interface Ctx {
  state: WarehouseState;
  dispatch: React.Dispatch<Action>;
  orderById: (id: string) => Order | undefined;
}

const WarehouseCtx = createContext<Ctx | null>(null);

export function WarehouseProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const value = useMemo<Ctx>(
    () => ({ state, dispatch, orderById: (id) => state.orders.find((o) => o.id === id) }),
    [state],
  );
  return <WarehouseCtx.Provider value={value}>{children}</WarehouseCtx.Provider>;
}

export function useWarehouse() {
  const ctx = useContext(WarehouseCtx);
  if (!ctx) throw new Error("useWarehouse must be used inside WarehouseProvider");
  return ctx;
}