import { CheckCircle2, AlertTriangle, XCircle, HelpCircle, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Panel({ title, children, className, accent, action }: { title?: ReactNode; children: ReactNode; className?: string; accent?: "primary" | "gold"; action?: ReactNode }) {
  return (
    <section className={cn("rounded-lg border bg-card p-4 md:p-6", accent === "gold" && "border-t-4 border-t-gold", accent === "primary" && "border-t-4 border-t-primary", className)}>
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-base font-bold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, desc, action }: { title: string; desc?: string | undefined; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {desc && <p className="mt-1 text-sm text-muted-foreground">{desc}</p>}
      </div>
      {action}
    </div>
  );
}

const TONE: Record<string, { cls: string; Icon: typeof CheckCircle2 }> = {
  good: { cls: "text-success border-success/40 bg-success/10", Icon: CheckCircle2 },
  warn: { cls: "text-warning border-warning/40 bg-warning/10", Icon: AlertTriangle },
  bad: { cls: "text-destructive border-destructive/40 bg-destructive/10", Icon: XCircle },
  info: { cls: "text-muted-foreground border-border bg-muted", Icon: HelpCircle },
  busy: { cls: "text-foreground border-border bg-muted", Icon: Loader2 },
};

export function toneOf(label: string | null | undefined): keyof typeof TONE {
  switch (label) {
    case "충족": case "우선 검토": case "진행": case "예": case "done": case "ok": case "공식 평가기준 확보":
      return "good";
    case "보완 필요": case "추가 확인": case "확인 필요": case "검토 중": case "보류":
      return "warn";
    case "미충족": case "누락": case "failed": case "미진행": case "아니오":
      return "bad";
    case "running": case "pending":
      return "busy";
    default:
      return "info";
  }
}

export function StatusBadge({ label, tone }: { label: string; tone?: keyof typeof TONE }) {
  const t = TONE[tone ?? toneOf(label)]!;
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold", t.cls)}>
      <t.Icon className={cn("size-3.5", tone === "busy" || label === "running" ? "animate-spin" : "")} aria-hidden />
      {label}
    </span>
  );
}

export const kst = (d: string | Date) =>
  new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" }).format(new Date(d));
export const kstDate = (d: string | Date) =>
  new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium" }).format(new Date(d));
export function todayKst() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}
