import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("panel", className)}>{children}</section>;
}

export function PanelHead({ title, sub, right }: { title: string; sub?: string | undefined; right?: ReactNode | undefined }) {
  return (
    <header className="flex items-start justify-between gap-4 border-b border-border px-4 py-3">
      <div>
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </div>
      {right}
    </header>
  );
}

const toneMap = {
  critical: "bg-destructive/15 text-destructive border-destructive/40",
  high: "bg-primary/15 text-primary border-primary/40",
  normal: "bg-accent/15 text-accent border-accent/40",
  low: "bg-muted text-muted-foreground border-border",
  success: "bg-success/15 text-success border-success/40",
  neutral: "bg-secondary text-secondary-foreground border-border",
} as const;

export type Tone = keyof typeof toneMap;

export function Pill({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider", toneMap[tone], className)}>
      {children}
    </span>
  );
}

export function Stat({ label, value, sub, tone = "neutral" }: { label: string; value: ReactNode; sub?: string; tone?: Tone }) {
  return (
    <div className="panel relative overflow-hidden px-4 py-3">
      <div className={cn("absolute inset-x-0 top-0 h-px scanline", tone === "critical" && "opacity-100")} />
      <p className="label-xs">{label}</p>
      <p className={cn("mt-1 font-mono text-2xl font-semibold", tone === "critical" && "text-destructive", tone === "high" && "text-primary", tone === "success" && "text-success")}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function Bar({ value, tone = "normal" }: { value: number; tone?: Tone }) {
  const color = tone === "critical" ? "bg-destructive" : tone === "high" ? "bg-primary" : tone === "success" ? "bg-success" : "bg-accent";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
      <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${Math.min(100, Math.max(2, value))}%` }} />
    </div>
  );
}

export function relTime(ms: number) {
  const abs = Math.abs(ms);
  const h = Math.floor(abs / 3600_000);
  const m = Math.round((abs % 3600_000) / 60000);
  const s = h > 0 ? `${h}h ${m}m` : `${m}m`;
  return ms < 0 ? `${s} overdue` : s;
}
