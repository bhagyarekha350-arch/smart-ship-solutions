import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useWarehouse } from "@/lib/warehouse/store";
import { planFor, priority } from "@/lib/warehouse/engine";
import { Panel, PanelHead, Pill, relTime } from "@/components/wh/ui";

export const Route = createFileRoute("/orders")({
  head: () => ({
    meta: [
      { title: "Order Queue & Prioritisation — WAREX" },
      { name: "description", content: "Transparent priority scoring across SLA, customer tier, order value and ageing, with per-order allocation rationale." },
      { property: "og:title", content: "Order Queue & Prioritisation — WAREX" },
      { property: "og:description", content: "See exactly why each order is ranked where it is, then act on it." },
    ],
  }),
  component: Orders,
});

const filters = ["all", "created", "backorder", "picking", "packing", "qc", "dispatched", "exception"] as const;

function Orders() {
  const { state, dispatch } = useWarehouse();
  const [filter, setFilter] = useState<(typeof filters)[number]>("all");
  const [selected, setSelected] = useState<string | null>("ORD-4821");

  const rows = useMemo(
    () =>
      state.orders
        .filter((o) => filter === "all" || o.stage === filter)
        .map((o) => ({ order: o, p: priority(o, state.now) }))
        .sort((a, b) => b.p.score - a.p.score),
    [state, filter],
  );

  const active = state.orders.find((o) => o.id === selected);
  const activePlan = active ? planFor(state, active.id) : undefined;
  const activeP = active ? priority(active, state.now) : undefined;

  return (
    <div className="space-y-5">
      <div>
        <p className="label-xs">Ranked by weighted priority engine</p>
        <h1 className="text-2xl font-semibold tracking-tight">Order Queue</h1>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded border px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors ${filter === f ? "border-primary/50 bg-primary/15 text-primary" : "border-border text-muted-foreground hover:bg-secondary"}`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Panel className="overflow-hidden">
          <PanelHead title={`${rows.length} orders`} sub="Highest score is picked first." />
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="label-xs border-b border-border">
                <tr>
                  <th className="px-4 py-2 font-normal">Order</th>
                  <th className="px-3 py-2 font-normal">Customer</th>
                  <th className="px-3 py-2 font-normal">Stage</th>
                  <th className="px-3 py-2 font-normal">SLA</th>
                  <th className="px-3 py-2 text-right font-normal">Score</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ order, p }) => (
                  <tr
                    key={order.id}
                    onClick={() => setSelected(order.id)}
                    className={`cursor-pointer border-b border-border/60 transition-colors hover:bg-secondary/50 ${selected === order.id ? "bg-secondary/70" : ""}`}
                  >
                    <td className="px-4 py-2.5 font-mono">{order.id}</td>
                    <td className="px-3 py-2.5">
                      {order.customer}
                      <span className="ml-1.5 text-[10px] uppercase text-muted-foreground">{order.tier}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <Pill tone={order.stage === "exception" || order.stage === "backorder" ? "critical" : order.stage === "dispatched" ? "success" : "neutral"}>
                        {order.stage}
                      </Pill>
                    </td>
                    <td className={`px-3 py-2.5 font-mono ${p.hoursToSla < 0 ? "text-destructive" : p.hoursToSla < 4 ? "text-primary" : "text-muted-foreground"}`}>
                      {relTime(order.slaAt - state.now)}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Pill tone={p.band === "critical" ? "critical" : p.band === "high" ? "high" : p.band === "normal" ? "normal" : "low"}>{p.score}</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        {active && activeP && (
          <Panel className="h-fit">
            <PanelHead title={`${active.id} · ${active.customer}`} sub={`${active.service} · $${active.value.toLocaleString()} · placed ${relTime(state.now - active.placedAt)} ago`} />
            <div className="space-y-4 p-4">
              <div>
                <p className="label-xs">Why this rank</p>
                <ul className="mt-1.5 space-y-1">
                  {activeP.reasons.map((r) => (
                    <li key={r} className="flex justify-between gap-3 border-b border-border/50 pb-1 text-xs text-muted-foreground">
                      <span>{r}</span>
                    </li>
                  ))}
                  <li className="flex justify-between pt-1 text-xs font-semibold">
                    <span>Total priority score</span>
                    <span className="font-mono text-primary">{activeP.score}</span>
                  </li>
                </ul>
              </div>

              <div>
                <p className="label-xs">Lines</p>
                <div className="mt-1.5 space-y-1">
                  {active.lines.map((l) => (
                    <div key={l.sku} className="flex items-center justify-between rounded border border-border bg-secondary/40 px-2.5 py-1.5 text-xs">
                      <span className="font-mono">{l.sku}</span>
                      <span className="font-mono">
                        {l.allocated}/{l.qty} allocated
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {activePlan && (
                <div className="rounded border border-primary/30 bg-primary/5 p-3">
                  <p className="label-xs text-primary">System recommendation</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{activePlan.rationale}</p>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {activePlan && (
                  <button
                    onClick={() => {
                      dispatch({ type: "allocate", orderId: active.id, mode: activePlan.fullyAllocatable ? "full" : "partial" });
                      toast.success(`${active.id}: ${activePlan.decision}`);
                    }}
                    className="rounded bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
                  >
                    Apply recommendation
                  </button>
                )}
                <button
                  onClick={() => {
                    dispatch({ type: "advance", orderId: active.id });
                    toast.success(`${active.id} advanced`);
                  }}
                  className="rounded border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-secondary"
                >
                  Advance stage
                </button>
                <button
                  onClick={() => {
                    dispatch({ type: "flag-exception", orderId: active.id, note: "Item missing at pick face — investigation raised" });
                    toast.error(`${active.id} flagged as exception`);
                  }}
                  className="rounded border border-destructive/40 px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
                >
                  Raise exception
                </button>
              </div>
              {active.note && <p className="text-xs text-muted-foreground">Note: {active.note}</p>}
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
