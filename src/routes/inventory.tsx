import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useWarehouse } from "@/lib/warehouse/store";
import { available, daysOfCover, stockStatus } from "@/lib/warehouse/engine";
import { Bar, Panel, PanelHead, Pill, Stat } from "@/components/wh/ui";

export const Route = createFileRoute("/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory & Stock Health — WAREX" },
      { name: "description", content: "Bin-level stock visibility with days-of-cover, damage quarantine, cycle counts and goods-in receipts." },
      { property: "og:title", content: "Inventory & Stock Health — WAREX" },
      { property: "og:description", content: "Days-of-cover, quarantine and cycle counting across every zone." },
    ],
  }),
  component: Inventory,
});

const tone = { out: "critical", critical: "critical", low: "high", healthy: "success", overstock: "normal" } as const;

function Inventory() {
  const { state, dispatch } = useWarehouse();
  const [zone, setZone] = useState<string>("all");
  const products = state.products.filter((p) => zone === "all" || p.zone === zone);

  return (
    <div className="space-y-5">
      <div>
        <p className="label-xs">Bin-level visibility · 4 zones</p>
        <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="SKUs tracked" value={state.products.length} />
        <Stat label="Out of stock" value={state.products.filter((p) => available(p) <= 0).length} tone="critical" />
        <Stat label="Below reorder point" value={state.products.filter((p) => stockStatus(p) === "low" || stockStatus(p) === "critical").length} tone="high" />
        <Stat label="Quarantined units" value={state.products.reduce((s, p) => s + p.damaged, 0)} />
      </div>

      <div className="flex gap-1.5">
        {["all", "A", "B", "C", "D"].map((z) => (
          <button
            key={z}
            onClick={() => setZone(z)}
            className={`rounded border px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider ${zone === z ? "border-primary/50 bg-primary/15 text-primary" : "border-border text-muted-foreground hover:bg-secondary"}`}
          >
            {z === "all" ? "all zones" : `zone ${z}`}
          </button>
        ))}
      </div>

      <Panel className="overflow-hidden">
        <PanelHead title="Stock ledger" sub="Sellable = on hand − reserved − quarantined." />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="label-xs border-b border-border">
              <tr>
                <th className="px-4 py-2 font-normal">SKU / item</th>
                <th className="px-3 py-2 font-normal">Bin</th>
                <th className="px-3 py-2 text-right font-normal">On hand</th>
                <th className="px-3 py-2 text-right font-normal">Reserved</th>
                <th className="px-3 py-2 text-right font-normal">Sellable</th>
                <th className="px-3 py-2 font-normal">Cover</th>
                <th className="px-3 py-2 font-normal">Status</th>
                <th className="px-3 py-2 text-right font-normal">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const st = stockStatus(p);
                const cover = daysOfCover(p);
                return (
                  <tr key={p.sku} className="border-b border-border/60 hover:bg-secondary/40">
                    <td className="px-4 py-2.5">
                      <span className="block font-medium">{p.name}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">{p.sku} · {p.category}</span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-muted-foreground">{p.bin}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{p.onHand}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">{p.reserved}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold">{available(p)}</td>
                    <td className="w-32 px-3 py-2.5">
                      <Bar value={(cover / 30) * 100} tone={cover < p.leadTimeDays ? "critical" : "normal"} />
                      <span className="mt-1 block font-mono text-[10px] text-muted-foreground">{cover.toFixed(1)}d vs {p.leadTimeDays}d lead</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <Pill tone={tone[st]}>{st}</Pill>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => { dispatch({ type: "receive", sku: p.sku, qty: p.reorderQty }); toast.success(`Received ${p.reorderQty} × ${p.sku}`); }}
                          className="rounded border border-border px-2 py-1 text-[10px] hover:bg-secondary"
                        >
                          Receive
                        </button>
                        <button
                          onClick={() => { dispatch({ type: "report-damage", sku: p.sku, qty: 1 }); toast.error(`1 unit of ${p.sku} quarantined`); }}
                          className="rounded border border-destructive/40 px-2 py-1 text-[10px] text-destructive hover:bg-destructive/10"
                        >
                          Damage
                        </button>
                        <button
                          onClick={() => { dispatch({ type: "cycle-count", sku: p.sku, counted: Math.max(0, p.onHand - 2) }); toast(`Cycle count logged for ${p.sku}`); }}
                          className="rounded border border-border px-2 py-1 text-[10px] hover:bg-secondary"
                        >
                          Count
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
