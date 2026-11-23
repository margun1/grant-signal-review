import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, MessageSquare, Package, Users, ListChecks, FileSearch } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { C, RangePicker, fetchAll, presetRange, type Range } from "@/components/app/data";
import { cnt, recommendOrder, summarizeProfit, won } from "@/lib/biz";
import { lastUpload, loadCosts, loadSales } from "@/lib/biz-queries";
import { YouTubeIntro } from "@/components/app/YouTubeIntro";
import { PageHeader, Panel, StatusBadge, kstDate, todayKst } from "@/components/app/ui";
import { WeatherCard } from "@/components/app/WeatherCard";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "경영현황 · 주식회사 에너인프라의 경영비서" }, { name: "description", content: "남양주시 날씨, 오늘 처리할 일과 에너인프라 경영 실적" }, { property: "og:title", content: "경영현황 · 에너인프라 경영비서" }, { property: "og:description", content: "남양주시 날씨와 오늘의 업무·경영 실적" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Dashboard,
});

function addDays(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function Dashboard() {
  const today = todayKst();
  const { data: due = [] } = useQuery({
    queryKey: ["due", today],
    queryFn: async () => {
      const { data } = await supabase.from("announcements").select("id,title,url,deadline,status,fit_level")
        .gte("deadline", today).lte("deadline", addDays(today, 14)).in("status", ["검토 중", "진행"]).order("deadline");
      return data ?? [];
    },
  });
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="경영현황" desc={`오늘 ${kstDate(new Date())} (한국 시간)`} />
      <WeatherCard />
      <YouTubeIntro />
      <Panel title="오늘 처리할 일" accent="primary">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-md border p-4 lg:col-span-1">
            <div className="mb-2 flex items-center gap-2 font-semibold"><CalendarClock className="size-4 text-taupe" aria-hidden />마감 임박 지원사업 (14일 이내)</div>
            {due.length === 0 ? <p className="text-sm text-muted-foreground">마감 임박 공고가 없습니다.</p> : (
              <ul className="space-y-2">
                {due.map((a) => (
                  <li key={a.id}>
                    <Link to="/announcements/$id" params={{ id: a.id }} className="flex items-center justify-between gap-2 text-sm hover:underline">
                      <span className="truncate">{a.title ?? a.url}</span>
                      <span className="shrink-0 tabular-nums">{a.deadline}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/announcements" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold underline"><FileSearch className="size-3.5" aria-hidden />공고 목록</Link>
          </div>
          <ShortageCard />
          <TodayCards today={today} />
        </div>
      </Panel>
      <Panel title="경영 실적" accent="gold">
        <Performance />
      </Panel>
    </div>
  );
}

function ShortageCard() {
  const q = useQuery({ queryKey: ["dash-shortage"], queryFn: async () => {
    const [snaps, { data: items }, { data: orders }] = await Promise.all([
      fetchAll<{ item: string; quantity: number; as_of: string }>((a, b) => supabase.from("inventory_snapshots").select("item,quantity,as_of").order("as_of").range(a, b)),
      supabase.from("inventory_items").select("name,min_stock,target_stock"), supabase.from("purchase_orders").select("item,quantity,status")]);
    const latest = new Map<string, { quantity: number; as_of: string }>(); for (const s of snaps) latest.set(s.item, s);
    return (items ?? []).flatMap((it) => { const s = latest.get(it.name); if (!s || Number(s.quantity) >= Number(it.min_stock)) return [];
      const pend = (orders ?? []).filter((o) => o.item === it.name && o.status === "발주 완료").reduce((a, o) => a + Number(o.quantity), 0);
      return [{ name: it.name, cur: Number(s.quantity), asOf: s.as_of, rec: recommendOrder(Number(it.target_stock), Number(s.quantity), pend) }]; });
  } });
  const list = q.data ?? [];
  return (
    <div className="rounded-md border p-4">
      <div className="mb-2 flex items-center gap-2 font-semibold"><Package className="size-4 text-taupe" aria-hidden />부족 재고</div>
      {list.length === 0 ? <p className="text-sm text-muted-foreground">최소 재고보다 부족한 품목이 없습니다.</p> :
        <ul className="space-y-1 text-sm">{list.slice(0, 5).map((x) => <li key={x.name} className="flex justify-between gap-2"><span className="truncate">{x.name}</span><span className="shrink-0">{cnt(x.cur)} · 권장 {cnt(x.rec)}</span></li>)}</ul>}
      {list[0] && <p className="mt-1 text-xs text-muted-foreground">재고 기준일 {list[0].asOf}</p>}
      <Link to="/inventory" className="mt-3 inline-flex text-sm font-semibold underline">재고·발주</Link>
    </div>
  );
}

function Performance() {
  const [range, setRange] = useState<Range>(presetRange(7));
  const sales = useQuery({ queryKey: ["sales", range], queryFn: () => loadSales(range) });
  const costs = useQuery({ queryKey: ["costs"], queryFn: loadCosts });
  const up = useQuery({ queryKey: ["last-upload", "sales"], queryFn: () => lastUpload("sales") });
  const s = sales.data ?? [];
  const sum = useMemo(() => summarizeProfit(s, costs.data ?? []), [s, costs.data]);
  const series = useMemo(() => { const m = new Map<string, number>(); for (const x of s) m.set(x.sale_date, (m.get(x.sale_date) ?? 0) + Number(x.amount)); return [...m].map(([k, v]) => ({ k, 매출액: v })); }, [s]);
  const prods = useMemo(() => { const m = new Map<string, number>(); for (const x of s) m.set(x.product, (m.get(x.product) ?? 0) + Number(x.quantity)); return [...m].sort((a, b) => b[1] - a[1]).slice(0, 5); }, [s]);
  return (
    <div className="space-y-4">
      <RangePicker value={range} onChange={setRange} presets={[[1, "최근 1일"], [3, "최근 3일"], [7, "최근 7일"]]} />
      <p className="text-xs text-muted-foreground">자료 기준: {up.data ? `매출 엑셀 ${up.data.period_start} ~ ${up.data.period_end}` : "매출 엑셀 없음 [확인 필요]"}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Link to="/sales" className="rounded-md border p-3 hover:bg-accent"><p className="text-sm text-muted-foreground">매출</p><p className="text-xl font-bold">{won(sum.revenue)}</p></Link>
        <Link to="/profit" className="rounded-md border border-t-4 border-t-gold p-3 hover:bg-accent"><p className="text-sm text-muted-foreground">매출총이익</p><p className="text-xl font-bold">{won(sum.gross)}</p>{sum.missingCount > 0 && <p className="text-xs text-warning">원가 확인 필요 {sum.missingCount}건 제외</p>}</Link>
        <Link to="/sales" className="rounded-md border p-3 hover:bg-accent"><p className="text-sm text-muted-foreground">상품별 판매량</p>{prods.length === 0 ? <p className="text-sm">-</p> : <ul className="text-sm">{prods.map(([n, q]) => <li key={n} className="flex justify-between"><span className="truncate">{n}</span><span>{cnt(q)}</span></li>)}</ul>}</Link>
      </div>
      {series.length > 0 && <div className="h-56"><ResponsiveContainer><LineChart data={series}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="k" /><YAxis tickFormatter={(v) => `${(v / 10000).toLocaleString()}만`} /><Tooltip formatter={(v: number) => won(v)} /><Legend /><Line dataKey="매출액" name="매출액(원)" stroke={C.orange} strokeWidth={2} dot={{ r: 4 }} label={series.length === 1 ? { position: "top" } : false} /></LineChart></ResponsiveContainer></div>}
    </div>
  );
}

function TodayCards({ today }: { today: string }) {
  const q = useQuery({ queryKey: ["dash-today", today], queryFn: async () => {
    await supabase.rpc("generate_checklist", { _date: today });
    const [inq, meet, tasks, events] = await Promise.all([
      supabase.from("inquiries").select("id", { count: "exact", head: true }).eq("status", "미답변"),
      supabase.from("meetings").select("id", { count: "exact", head: true }).eq("status", "확인 대기"),
      supabase.from("tasks").select("id,title,done").eq("due_date", today).order("done"),
      supabase.from("meetings").select("id,kind,title,org,name,start_at").eq("status", "확정").gte("start_at", new Date(`${today}T00:00:00+09:00`).toISOString()).lt("start_at", new Date(`${today}T23:59:59+09:00`).toISOString()).order("start_at"),
    ]);
    return { inq: inq.count ?? 0, meet: meet.count ?? 0, tasks: tasks.data ?? [], events: events.data ?? [] };
  } });
  const d = q.data;
  const hm = (iso: string) => new Date(iso).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" });
  return (
    <>
      <Link to="/inquiries" className="rounded-md border p-4 hover:bg-accent"><div className="mb-2 flex items-center gap-2 font-semibold"><MessageSquare className="size-4 text-taupe" aria-hidden />미답변 고객문의</div><p className="text-2xl font-bold">{d?.inq ?? "-"}건</p></Link>
      <Link to="/meetings" className="rounded-md border p-4 hover:bg-accent"><div className="mb-2 flex items-center gap-2 font-semibold"><Users className="size-4 text-taupe" aria-hidden />미확정 미팅 요청</div><p className="text-2xl font-bold">{d?.meet ?? "-"}건</p></Link>
      <div className="rounded-md border p-4"><div className="mb-2 flex items-center gap-2 font-semibold"><ListChecks className="size-4 text-taupe" aria-hidden />오늘 일정·체크리스트</div>
        <ul className="space-y-1 text-sm">{(d?.events ?? []).map((e) => <li key={e.id}>{hm(e.start_at)} {e.kind === "외부 미팅" ? `미팅 ${e.org ?? e.name ?? ""}` : e.title}</li>)}
          {(d?.tasks ?? []).slice(0, 5).map((t) => <li key={t.id} className={t.done ? "text-muted-foreground line-through" : ""}>☐ {t.title}</li>)}
          {d && d.events.length + d.tasks.length === 0 && <li className="text-muted-foreground">오늘 일정과 체크리스트가 없습니다.</li>}</ul>
        <div className="mt-2 flex gap-3 text-sm font-semibold underline"><Link to="/meetings">일정</Link><Link to="/checklist">체크리스트</Link></div></div>
    </>
  );
}
