import { createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useWarehouse } from "@/lib/warehouse/store";
import { bottlenecks, daysOfCover, kpis, priority, stockStatus } from "@/lib/warehouse/engine";
import { Panel, PanelHead, Stat } from "@/components/wh/ui";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Operational Analytics & Bottlenecks — WAREX" },
      { name: "description", content: "Throughput, SLA performance, stage bottlenecks and stock-risk analytics for warehouse operations teams." },
      { property: "og:title", content: "Operational Analytics & Bottlenecks — WAREX" },
      { property: "og:description", content: "Find the constraint before it becomes a late shipment." },
    ],
  }),
  component: Analytics,
});

const throughput = [
  { h: "06:00", picked: 22, dispatched: 12 },
  { h: "08:00", picked: 41, dispatched: 28 },
  { h: "10:00", picked: 55, dispatched: 39 },
  { h: "12:00", picked: 34, dispatched: 44 },
  { h: "14:00", picked: 61, dispatched: 47 },
  { h: "16:00", picked: 49, dispatched: 52 },
  { h: "18:00", picked: 38, dispatched: 40 },
];

function Analytics() {
  const { state } = useWarehouse();
  const k = kpis(state);
  const flow = bottlenecks(state).map((b) => ({ name: b.label, count: b.count, atRisk: b.atRisk }));
  const risk = state.products
    .map((p) => ({ sku: p.sku, cover: Number(daysOfCover(p).toFixed(1)), status: stockStatus(p) }))
    .sort((a, b) => a.cover - b.cover)
    .slice(0, 8);
  const worst = [...flow].sort((a, b) => b.atRisk * 10 + b.count - (a.atRisk * 10 + a.count))[0];
  const urgent = state.orders.filter((o) => o.stage !== "dispatched" && priority(o, state.now).band === "critical").length;

  return (
    <div className="space-y-5">
      <div>
        <p className="label-xs">Shift analytics · rolling 12h</p>
        <h1 className="text-2xl font-semibold tracking-tight">Operations Analytics</h1>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Fill rate" value={`${k.fillRate}%`} sub="orders fully allocated" tone="success" />
        <Stat label="Critical priority" value={urgent} sub="orders needing intervention" tone="critical" />
        <Stat label="Constraint stage" value={worst?.name ?? "—"} sub={worst ? `${worst.count} queued, ${worst.atRisk} at risk` : ""} tone="high" />
        <Stat label="Damaged units" value={k.damagedUnits} sub="pending disposition" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <PanelHead title="Throughput vs dispatch" sub="Picking outpaced dispatch at 14:00 — packing is the constraint." />
          <div className="h-64 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={throughput}>
                <CartesianGrid stroke="var(--grid-line)" vertical={false} />
                <XAxis dataKey="h" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }} />
                <Line type="monotone" dataKey="picked" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="dispatched" stroke="var(--chart-2)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel>
          <PanelHead title="Work-in-progress by stage" sub="Tall bars downstream mean shipments are stalling." />
          <div className="h-64 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={flow}>
                <CartesianGrid stroke="var(--grid-line)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip cursor={{ fill: "var(--grid-line)" }} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }} />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                  {flow.map((f) => (
                    <Cell key={f.name} fill={f.atRisk ? "var(--chart-4)" : "var(--chart-1)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelHead title="Stock risk — lowest days of cover" sub="Anything under its lead time will stock out before replenishment lands." />
        <div className="h-64 p-3">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={risk} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid stroke="var(--grid-line)" horizontal={false} />
              <XAxis type="number" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="sku" stroke="var(--muted-foreground)" fontSize={10} width={70} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: "var(--grid-line)" }} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }} />
              <Bar dataKey="cover" radius={[0, 3, 3, 0]}>
                {risk.map((r) => (
                  <Cell key={r.sku} fill={r.status === "out" || r.status === "critical" ? "var(--chart-4)" : r.status === "low" ? "var(--chart-1)" : "var(--chart-3)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </div>
  );
}
