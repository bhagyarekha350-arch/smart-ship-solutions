import { Link } from "@tanstack/react-router";
import { Boxes, ClipboardList, LayoutDashboard, PackageCheck, LineChart, RotateCcw } from "lucide-react";
import { useWarehouse } from "@/lib/warehouse/store";
import { kpis } from "@/lib/warehouse/engine";
import type { ReactNode } from "react";

const nav = [
  { to: "/", label: "Control Tower", icon: LayoutDashboard },
  { to: "/orders", label: "Orders", icon: ClipboardList },
  { to: "/inventory", label: "Inventory", icon: Boxes },
  { to: "/fulfillment", label: "Fulfillment", icon: PackageCheck },
  { to: "/analytics", label: "Analytics", icon: LineChart },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const { state, dispatch } = useWarehouse();
  const k = kpis(state);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded bg-primary font-mono text-sm font-bold text-primary-foreground">WX</span>
            <span className="leading-tight">
              <span className="block text-sm font-semibold tracking-tight">WAREX Control</span>
              <span className="label-xs">DC-07 · North Hub</span>
            </span>
          </Link>

          <nav className="order-3 flex w-full gap-1 overflow-x-auto md:order-none md:w-auto">
            {nav.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact: to === "/" }}
                activeProps={{ className: "bg-secondary text-foreground" }}
                className="flex shrink-0 items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
              >
                <Icon className="size-3.5" /> {label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3 text-xs">
            <span className="hidden items-center gap-1.5 sm:flex">
              <span className="live-dot size-1.5 rounded-full bg-success" />
              <span className="label-xs">shift live</span>
            </span>
            <span className="font-mono text-destructive">{k.breached} breached</span>
            <span className="font-mono text-primary">{k.atRisk} at risk</span>
            <button
              onClick={() => dispatch({ type: "reset" })}
              className="flex items-center gap-1 rounded border border-border px-2 py-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <RotateCcw className="size-3" /> Reset
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] px-4 py-6">{children}</main>
    </div>
  );
}
