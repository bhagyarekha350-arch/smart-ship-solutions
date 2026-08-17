import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, Split, ShieldAlert, Zap, PackagePlus } from "lucide-react";
import { useWarehouse } from "@/lib/warehouse/store";
import { bottlenecks, kpis, planAll, priority, reorderRecommendations } from "@/lib/warehouse/engine";
import { Bar, Panel, PanelHead, Pill, Stat, relTime } from "@/components/wh/ui";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Control Tower — WAREX Smart Warehouse Operations" },
      { name: "description", content: "Live warehouse control tower: SLA risk, allocation conflicts, reorder advice and exception resolution in one screen." },
      { property: "og:title", content: "Control Tower — WAREX" },
      { property: "og:description", content: "Live SLA risk, allocation conflicts and reorder advice for the whole distribution centre." },
    ],
  }),
  component: ControlTower,
});

function ControlTower() {
  const { state, dispatch } = useWarehouse();
  const k = kpis(state);
  const plans = planAll(state);
  const conflicts = plans.filter((p) => !p.fullyAllocatable);
  const recs = reorderRecommendations(state);
  const flow = bottlenecks(state);
  const worst = [...flow].sort((a, b) => b.atRisk * 10 + b.count - (a.atRisk * 10 + a.count))[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-xs">Shift 2 · Live operations</p>
          <h1 className="text-2xl font-semibold tracking-tight">Control Tower</h1>
        </div>
        <button
          onClick={() => {
            dispatch({ type: "allocate-all" });
            toast.success("Auto-allocation run complete", { description: "Stock reserved by priority score with fair-share splitting." });
          }}
          className="flex items-center gap-2 rounded bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Zap className="size-4" /> Run auto-allocation
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Open orders" value={k.openOrders} sub={`${k.fillRate}% fully allocated`} />
        <Stat label="SLA breached" value={k.breached} sub={`${k.atRisk} within 4 hours`} tone={k.breached ? "critical" : "success"} />
        <Stat label="Stock exceptions" value={k.outOfStock + k.lowStock} sub={`${k.outOfStock} out, ${k.lowStock} low`} tone="high" />
        <Stat label="Inventory value" value={`$${Math.round(k.stockValue / 1000)}k`} sub={`${k.damagedUnits} units quarantined`} />
      </div>

      <Panel>
        <PanelHead
          title="Bottleneck map"
          sub={worst ? `Deepest queue: ${worst.label} (${worst.count} orders, ${worst.atRisk} at risk)` : undefined}
        />
        <div className="grid gap-3 p-4 sm:grid-cols-3 lg:grid-cols-5">
          {flow.map((b) => (
            <div key={b.stage} className="rounded border border-border bg-secondary/40 p-3">
              <p className="label-xs">{b.label}</p>
              <p className="mt-1 font-mono text-xl">{b.count}</p>
              <div className="mt-2">
                <Bar value={(b.count / Math.max(1, state.orders.length)) * 100} tone={b.atRisk ? "critical" : "normal"} />
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">{b.atRisk} at SLA risk</p>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <Panel>
          <PanelHead
            title="Allocation decisions required"
            sub="Contested stock resolved by priority score, not by arrival order."
            right={<Pill tone={conflicts.length ? "critical" : "success"}>{conflicts.length} conflicts</Pill>}
          />
          <div className="divide-y divide-border">
            {plans.slice(0, 6).map((plan) => {
              const order = state.orders.find((o) => o.id === plan.orderId)!;
              const p = priority(order, state.now);
              return (
                <article key={plan.orderId} className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to="/orders" className="font-mono text-sm font-semibold hover:text-primary">
                      {order.id}
                    </Link>
                    <span className="text-sm text-muted-foreground">{order.customer}</span>
                    <Pill tone={p.band === "critical" ? "critical" : p.band === "high" ? "high" : "normal"}>
                      {p.band} · {p.score}
                    </Pill>
                    <span className="ml-auto font-mono text-xs text-muted-foreground">
                      SLA {relTime(order.slaAt - state.now)}
                    </span>
                  </div>

                  <div className="mt-3 space-y-1.5">
                    {plan.lines.map((l) => (
                      <div key={l.sku} className="flex items-center gap-3 text-xs">
                        <span className="w-24 font-mono text-muted-foreground">{l.sku}</span>
                        <div className="flex-1">
                          <Bar value={(l.grantable / Math.max(1, l.requested)) * 100} tone={l.short ? "critical" : "success"} />
                        </div>
                        <span className="font-mono">
                          {l.grantable}/{l.requested}
                        </span>
                        {l.short > 0 && <Pill tone="critical">-{l.short}</Pill>}
                      </div>
                    ))}
                  </div>

                  <p className="mt-3 rounded border border-border bg-secondary/40 p-2.5 text-xs leading-relaxed text-muted-foreground">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-primary">Recommendation · </span>
                    {plan.rationale}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {plan.lines.reduce((s, l) => s + l.grantable, 0) > 0 && <button
                      onClick={() => {
                        dispatch({ type: "allocate", orderId: order.id, mode: plan.fullyAllocatable ? "full" : "partial" });
                        toast.success(`Applied: ${plan.decision}`, { description: plan.rationale });
                      }}
                      className="flex items-center gap-1.5 rounded bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
                    >
                      {plan.fullyAllocatable ? <ArrowRight className="size-3.5" /> : <Split className="size-3.5" />}
                      {plan.fullyAllocatable ? "Allocate in full" : `Split: reserve ${plan.lines.reduce((s, l) => s + l.grantable, 0)}`}
                    </button>}
                    <button
                      onClick={() => {
                        dispatch({ type: "allocate", orderId: order.id, mode: "backorder" });
                        toast("Order held on backorder", { description: "Stock protected for higher-priority demand." });
                      }}
                      className="rounded border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
                    >
                      Hold / backorder
                    </button>
                    {plan.contested.length > 0 && (
                      <span className="flex items-center gap-1 self-center text-[11px] text-muted-foreground">
                        <AlertTriangle className="size-3 text-primary" />
                        competing with {plan.contested[0]!.competingOrders.slice(0, 2).join(", ")}
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
            {plans.length === 0 && <p className="p-6 text-sm text-muted-foreground">No orders waiting on stock. Queue is clear.</p>}
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel>
            <PanelHead title="Replenishment advice" sub="Cover vs lead time, weighted by committed demand." />
            <div className="divide-y divide-border">
              {recs.slice(0, 4).map((r) => (
                <div key={r.sku} className="p-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{r.name}</span>
                    <Pill tone={r.urgency === "now" ? "critical" : r.urgency === "this-week" ? "high" : "low"}>{r.urgency}</Pill>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{r.reason}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="font-mono text-xs">
                      Raise PO · {r.suggestedQty} units · ${r.cost.toLocaleString()}
                    </span>
                    <button
                      onClick={() => {
                        dispatch({ type: "receive", sku: r.sku, qty: r.suggestedQty });
                        toast.success(`PO received for ${r.sku}`, { description: `${r.suggestedQty} units put away.` });
                      }}
                      className="flex items-center gap-1 rounded border border-primary/40 px-2 py-1 text-[11px] font-semibold text-primary hover:bg-primary/10"
                    >
                      <PackagePlus className="size-3" /> Receive
                    </button>
                  </div>
                </div>
              ))}
              {recs.length === 0 && <p className="p-6 text-sm text-muted-foreground">All SKUs above reorder point.</p>}
            </div>
          </Panel>

          <Panel>
            <PanelHead title="Exception & decision log" right={<Pill tone="high">live</Pill>} />
            <ul className="max-h-80 divide-y divide-border overflow-y-auto">
              {state.events.slice(0, 14).map((e) => (
                <li key={e.id} className="flex gap-2.5 px-4 py-2.5 text-xs">
                  <ShieldAlert
                    className={`mt-0.5 size-3.5 shrink-0 ${e.kind === "exception" ? "text-destructive" : e.kind === "success" ? "text-success" : e.kind === "decision" ? "text-primary" : "text-muted-foreground"}`}
                  />
                  <span className="leading-relaxed text-muted-foreground">{e.message}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
