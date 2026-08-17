import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Footprints, Timer, UserRound } from "lucide-react";
import { useWarehouse } from "@/lib/warehouse/store";
import { STAGE_FLOW, pickRoute, priority } from "@/lib/warehouse/engine";
import { Panel, PanelHead, Pill, relTime } from "@/components/wh/ui";

export const Route = createFileRoute("/fulfillment")({
  head: () => ({
    meta: [
      { title: "Picking, Packing & Dispatch — WAREX" },
      { name: "description", content: "Stage-by-stage fulfillment board with optimised serpentine pick routes, picker assignment and exception handling." },
      { property: "og:title", content: "Picking, Packing & Dispatch — WAREX" },
      { property: "og:description", content: "Optimised pick routes and a live board from allocation through dispatch." },
    ],
  }),
  component: Fulfillment,
});

const PICKERS = ["R. Mehta", "L. Osei", "A. Duarte", "S. Kaur"];

function Fulfillment() {
  const { state, dispatch } = useWarehouse();
  const [route, setRoute] = useState<string | null>(null);
  const active = state.orders.find((o) => o.id === route);
  const rp = active ? pickRoute(state, active) : null;

  return (
    <div className="space-y-5">
      <div>
        <p className="label-xs">Allocation → picking → packing → QC → dispatch</p>
        <h1 className="text-2xl font-semibold tracking-tight">Fulfillment Floor</h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-6">
        {STAGE_FLOW.map((stage) => {
          const orders = state.orders.filter((o) => o.stage === stage);
          return (
            <div key={stage} className="panel flex flex-col">
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <span className="label-xs">{stage}</span>
                <span className="font-mono text-xs">{orders.length}</span>
              </div>
              <div className="flex-1 space-y-2 p-2">
                {orders.map((o) => {
                  const p = priority(o, state.now);
                  return (
                    <button
                      key={o.id}
                      onClick={() => setRoute(o.id)}
                      className={`w-full rounded border p-2 text-left transition-colors hover:border-primary/50 ${route === o.id ? "border-primary/60 bg-primary/10" : "border-border bg-secondary/40"}`}
                    >
                      <span className="block font-mono text-xs font-semibold">{o.id}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">{o.customer}</span>
                      <span className={`mt-1 block font-mono text-[10px] ${p.hoursToSla < 0 ? "text-destructive" : p.hoursToSla < 4 ? "text-primary" : "text-muted-foreground"}`}>
                        {relTime(o.slaAt - state.now)}
                      </span>
                      {o.picker && (
                        <span className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                          <UserRound className="size-2.5" /> {o.picker}
                        </span>
                      )}
                    </button>
                  );
                })}
                {orders.length === 0 && <p className="px-1 py-3 text-center text-[11px] text-muted-foreground">empty</p>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <PanelHead
            title={active ? `Pick route · ${active.id}` : "Pick route optimiser"}
            sub={rp ? `Serpentine path across zones ${rp.zones.join(", ")} · ${rp.walkMeters}m · ~${rp.estMinutes} min` : "Select an order from the board."}
            right={active ? <Pill tone="high">{active.stage}</Pill> : undefined}
          />
          {active && rp ? (
            <div className="space-y-3 p-4">
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Footprints className="size-3.5 text-accent" /> {rp.walkMeters} m</span>
                <span className="flex items-center gap-1"><Timer className="size-3.5 text-accent" /> {rp.estMinutes} min</span>
              </div>
              <ol className="space-y-2">
                {rp.stops.map((s, i) => (
                  <li key={s.sku} className="flex items-center gap-3 rounded border border-border bg-secondary/40 px-3 py-2 text-xs">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary font-mono text-[10px] font-bold text-primary-foreground">{i + 1}</span>
                    <span className="flex-1">
                      <span className="block font-medium">{s.name}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">{s.sku} · bin {s.bin}</span>
                    </span>
                    <span className="font-mono">×{s.qty}</span>
                  </li>
                ))}
              </ol>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  onClick={() => { dispatch({ type: "advance", orderId: active.id }); toast.success(`${active.id} advanced`); }}
                  className="rounded bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
                >
                  Complete stage
                </button>
                <button
                  onClick={() => { dispatch({ type: "flag-exception", orderId: active.id, note: "Short pick — quantity not found in bin" }); toast.error("Short pick recorded"); }}
                  className="rounded border border-destructive/40 px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
                >
                  Report short pick
                </button>
              </div>
            </div>
          ) : (
            <p className="p-6 text-sm text-muted-foreground">Pick a card above to generate an optimised route.</p>
          )}
        </Panel>

        <Panel>
          <PanelHead title="Labour assignment" sub="Balance workload across the pick team." />
          <div className="divide-y divide-border">
            {PICKERS.map((picker) => {
              const load = state.orders.filter((o) => o.picker === picker && !["dispatched"].includes(o.stage));
              return (
                <div key={picker} className="flex items-center justify-between px-4 py-3 text-xs">
                  <span className="flex items-center gap-2">
                    <UserRound className="size-4 text-accent" /> {picker}
                  </span>
                  <span className="font-mono text-muted-foreground">{load.length} open</span>
                  <button
                    disabled={!active}
                    onClick={() => { if (active) { dispatch({ type: "assign", orderId: active.id, picker }); toast.success(`${picker} assigned to ${active.id}`); } }}
                    className="rounded border border-border px-2 py-1 text-[11px] hover:bg-secondary disabled:opacity-40"
                  >
                    Assign selected
                  </button>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
}
