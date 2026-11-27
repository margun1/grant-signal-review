import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, Panel, StatusBadge, todayKst } from "@/components/app/ui";
import { C, UploadPanel, exportXlsx, fetchAll } from "@/components/app/data";
import { sampleInventoryItems, sampleInventorySnaps, samplePurchaseOrders } from "@/lib/sample-inventory";
import { cnt, parseInventory, recommendOrder } from "@/lib/biz";

export const Route = createFileRoute("/_authenticated/inventory")({
  head: () => ({ meta: [{ title: "재고·발주 · 주식회사 에너인프라의 경영비서" }, { name: "description", content: "재고 엑셀 업로드, 부족 재고, 권장 발주량, 발주 기록" }] }),
  component: InventoryPage,
});

type Snap = { item: string; kind: string; quantity: number; as_of: string };
type Item = { name: string; kind: string; min_stock: number; target_stock: number };
type Order = { id: string; item: string; quantity: number; status: string; ordered_at: string | null; received_at: string | null; memo: string | null; created_at: string };
const STATUSES = ["발주 전", "발주 완료", "입고 완료"] as const;

function InventoryPage() {
  const qc = useQueryClient();
  const snaps = useQuery({ queryKey: ["inv-snaps"], queryFn: () => fetchAll<Snap>((a, b) => supabase.from("inventory_snapshots").select("item,kind,quantity,as_of").order("as_of").order("id").range(a, b)) });
  const items = useQuery({ queryKey: ["inv-items"], queryFn: async () => ((await supabase.from("inventory_items").select("*").order("kind").order("name")).data ?? []) as Item[] });
  const orders = useQuery({ queryKey: ["orders"], queryFn: async () => ((await supabase.from("purchase_orders").select("*").order("created_at", { ascending: false })).data ?? []) as Order[] });

  const [view, setView] = useState<"real" | "sample" | null>(null);
  const emptyInventory = snaps.isSuccess && items.isSuccess && orders.isSuccess &&
    !snaps.data.length && !items.data.length && !orders.data.length;
  const showSample = view === "sample" || (view === null && emptyInventory);
  const displayedSnaps = showSample ? sampleInventorySnaps : snaps.data;
  const displayedItems = showSample ? sampleInventoryItems : items.data;
  const displayedOrders = showSample ? samplePurchaseOrders : orders.data;

  const table = useMemo(() => {
    const latest = new Map<string, Snap>();
    for (const s of displayedSnaps ?? []) latest.set(s.item, s);
    return (displayedItems ?? []).map((it) => {
      const s = latest.get(it.name); const cur = s ? Number(s.quantity) : null;
      const mine = (displayedOrders ?? []).filter((o) => o.item === it.name);
      const pending = mine.filter((o) => o.status === "발주 완료").reduce((a, o) => a + Number(o.quantity), 0);
      const waiting = mine.filter((o) => o.status === "입고 완료" && (!s || !o.received_at || o.received_at > s.as_of));
      return { ...it, cur, asOf: s?.as_of ?? null, pending, waiting: waiting.length > 0,
        rec: cur === null ? null : recommendOrder(Number(it.target_stock), cur, pending), short: cur !== null && cur < Number(it.min_stock) };
    });
  }, [displayedSnaps, displayedItems, displayedOrders]);
  const asOfAll = [...new Set(table.map((t) => t.asOf).filter(Boolean))].sort().reverse();

  const saveItem = useMutation({
    mutationFn: async (v: { name: string; min_stock?: number; target_stock?: number }) => { const { error } = await supabase.from("inventory_items").update({ ...v, updated_at: new Date().toISOString() }).eq("name", v.name); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inv-items"] }), onError: () => toast.error("저장하지 못했습니다."),
  });
  const [oItem, setOItem] = useState(""); const [oQty, setOQty] = useState(""); const [oStatus, setOStatus] = useState<string>("발주 전");
  const addOrder = useMutation({
    mutationFn: async () => {
      const q = Number(oQty); if (!oItem || !(q > 0)) throw new Error("품목과 1 이상의 수량을 입력해 주세요.");
      const t = todayKst();
      const { error } = await supabase.from("purchase_orders").insert({ item: oItem, quantity: q, status: oStatus, ordered_at: oStatus !== "발주 전" ? t : null, received_at: oStatus === "입고 완료" ? t : null });
      if (error) throw new Error("발주를 기록하지 못했습니다.");
    },
    onSuccess: () => { setOQty(""); toast.success("발주를 기록했습니다."); qc.invalidateQueries({ queryKey: ["orders"] }); }, onError: (e) => toast.error((e as Error).message),
  });
  const setStatus = useMutation({
    mutationFn: async (o: { id: string; status: string; prev: Order }) => {
      const t = todayKst();
      const { error } = await supabase.from("purchase_orders").update({ status: o.status, ordered_at: o.status === "발주 전" ? null : o.prev.ordered_at ?? t, received_at: o.status === "입고 완료" ? o.prev.received_at ?? t : null }).eq("id", o.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  });

  const [sel, setSel] = useState("");
  const chartItem = table.some((item) => item.name === sel) ? sel : table[0]?.name ?? "";
  const itemInfo = table.find((t) => t.name === chartItem);
  const itemSeries = (displayedSnaps ?? []).filter((s) => s.item === chartItem).map((s) => ({ k: s.as_of, 재고: Number(s.quantity) }));
  const orderSeries = useMemo(() => { const m = new Map<string, number>(); for (const o of displayedOrders ?? []) if (o.ordered_at) m.set(o.ordered_at, (m.get(o.ordered_at) ?? 0) + Number(o.quantity)); return [...m].sort().map(([k, v]) => ({ k, 발주수량: v })); }, [displayedOrders]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="재고·발주" desc={showSample ? "가상 재고와 발주 기록입니다." : asOfAll.length ? `재고 기준일: ${asOfAll[0]}${asOfAll.length > 1 ? " (품목별 최근 기준일이 다를 수 있음)" : ""}` : "아직 반영한 재고 엑셀이 없습니다."}
        action={<Button variant="outline" onClick={() => exportXlsx([{ name: "재고", rows: table.map((t) => ({ 구분: t.kind, 품목명: t.name, 현재재고: t.cur ?? "확인 필요", 재고기준일: t.asOf ?? "확인 필요", 최소재고: t.min_stock, 목표재고: t.target_stock, 미입고발주: t.pending, 권장발주: t.rec ?? "확인 필요" })) },
          { name: "발주 기록", rows: (displayedOrders ?? []).map((o) => ({ 품목: o.item, 수량: o.quantity, 상태: o.status, 발주일: o.ordered_at, 입고일: o.received_at, 메모: o.memo })) }], `${showSample ? "가상_" : ""}재고_${asOfAll[0] ?? todayKst()}.xlsx`)}><Download className="size-4" />엑셀 내려받기</Button>} />
      <div className="flex flex-wrap gap-2" role="group" aria-label="재고 데이터 보기">
        <Button type="button" size="sm" variant={!showSample ? "default" : "outline"} aria-pressed={!showSample}
          onClick={() => setView("real")}>실제 데이터</Button>
        <Button type="button" size="sm" variant={showSample ? "default" : "outline"} aria-pressed={showSample}
          onClick={() => setView("sample")}>가상 데이터</Button>
      </div>
      {!showSample && <UploadPanel title="재고 엑셀 올리기" required="품목명, 현재 재고 (선택: 구분[완제품/부품·재료], 기준일)" needsDate
        analyze={(d, asOf) => { const p = parseInventory(d.rows, d.headers); const fileDates = [...new Set(p.rows.map((r) => r.as_of).filter(Boolean))];
          const date = fileDates.length === 1 ? fileDates[0]! : asOf;
          return { count: p.rows.length, errors: p.errors.concat(fileDates.length > 1 ? ["파일에 기준일이 여러 개 있습니다. 기준일별로 나눠 올려 주세요."] : []), missing: p.missing, ready: p.rows.length > 0 && fileDates.length <= 1,
            sample: p.rows.slice(0, 8).map((r) => ({ 구분: r.kind, 품목명: r.item, 재고: r.quantity })), scope: `재고 기준일 ${date}의 기존 재고 자료를 이 파일로 교체합니다.` }; }}
        apply={async (name, asOf, d) => { const p = parseInventory(d.rows, d.headers); const date = p.rows.find((r) => r.as_of)?.as_of ?? asOf;
          const { data, error } = await supabase.rpc("import_inventory", { _file: name, _as_of: date, _rows: p.rows as never });
          if (error) throw new Error("재고를 반영하지 못했습니다."); qc.invalidateQueries(); const r = data as { inserted: number; replaced: number };
          return `기준일 ${date}: 기존 ${r.replaced}건을 교체하고 ${r.inserted}개 품목을 반영했습니다.`; }} />}

      <Panel title="품목별 재고" accent="gold">
        <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-sm">
          <thead className="bg-secondary text-left"><tr><th className="p-2">구분</th><th className="p-2">품목명</th><th className="p-2 text-right">현재 재고</th><th className="p-2">기준일</th><th className="p-2">최소 재고</th><th className="p-2">목표 재고</th><th className="p-2 text-right">미입고 발주</th><th className="p-2 text-right">권장 발주</th><th className="p-2">상태</th></tr></thead>
          <tbody>{table.map((t) => (
            <tr key={`${showSample ? "sample" : "real"}:${t.name}`} className="border-t">
              <td className="p-2">{t.kind}</td><td className="p-2 font-semibold">{t.name}</td>
              <td className="p-2 text-right">{t.cur === null ? "확인 필요" : cnt(t.cur)}</td><td className="p-2">{t.asOf ?? "-"}</td>
              <td className="p-2">{showSample ? cnt(Number(t.min_stock)) : <Input aria-label={`${t.name} 최소 재고`} type="number" min={0} className="h-8 w-20 bg-card" defaultValue={t.min_stock} onBlur={(e) => Number(e.target.value) !== Number(t.min_stock) && saveItem.mutate({ name: t.name, min_stock: Number(e.target.value) })} />}</td>
              <td className="p-2">{showSample ? cnt(Number(t.target_stock)) : <Input aria-label={`${t.name} 목표 재고`} type="number" min={0} className="h-8 w-20 bg-card" defaultValue={t.target_stock} onBlur={(e) => Number(e.target.value) !== Number(t.target_stock) && saveItem.mutate({ name: t.name, target_stock: Number(e.target.value) })} />}</td>
              <td className="p-2 text-right">{cnt(t.pending)}</td><td className="p-2 text-right font-bold">{t.rec === null ? "-" : cnt(t.rec)}</td>
              <td className="space-x-1 p-2">{t.short && <StatusBadge label="부족" tone="bad" />}{t.waiting && <StatusBadge label="재고 엑셀 반영 대기" tone="warn" />}{!t.short && !t.waiting && t.cur !== null && <StatusBadge label="정상" tone="good" />}</td>
            </tr>))}
          </tbody></table></div>
        <p className="mt-2 text-xs text-muted-foreground">권장 발주 = 0과 (목표 재고 − 현재 재고 − 발주 완료 건의 미입고 수량) 중 큰 값</p>
      </Panel>

      <Panel title="기준일별 재고 추이">
        <Select value={chartItem} onValueChange={setSel}><SelectTrigger className="w-64 bg-card" aria-label="품목 선택"><SelectValue placeholder="품목 선택" /></SelectTrigger><SelectContent>{table.map((t) => <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>)}</SelectContent></Select>
        {itemSeries.length === 0 ? <p className="py-8 text-center text-muted-foreground">재고 이력이 없습니다.</p> :
          <div className="mt-4 h-64"><ResponsiveContainer><LineChart data={itemSeries}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="k" /><YAxis /><Tooltip formatter={(v: number) => cnt(v)} /><Legend />
            <Line dataKey="재고" name="재고 수량(개)" stroke={C.orange} strokeWidth={2} dot={{ r: 4 }} label={itemSeries.length === 1 ? { position: "top" } : false} />
            {itemInfo && <ReferenceLine y={Number(itemInfo.min_stock)} stroke="var(--destructive)" strokeDasharray="4 4" label="최소 재고" />}
            {itemInfo && <ReferenceLine y={Number(itemInfo.target_stock)} stroke={C.gold} strokeDasharray="4 4" label="목표 재고" />}
          </LineChart></ResponsiveContainer></div>}
      </Panel>

      <Panel title="발주 기록" accent="primary">
        {!showSample && <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); addOrder.mutate(); }}>
          <div className="space-y-1.5"><Label>품목</Label><Select value={oItem} onValueChange={setOItem}><SelectTrigger className="w-56 bg-card"><SelectValue placeholder="품목 선택" /></SelectTrigger><SelectContent>{table.map((t) => <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label htmlFor="oq">수량</Label><Input id="oq" type="number" min={1} className="w-28 bg-card" value={oQty} onChange={(e) => setOQty(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>상태</Label><Select value={oStatus} onValueChange={setOStatus}><SelectTrigger className="w-36 bg-card"><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
          <Button type="submit" disabled={addOrder.isPending}>발주 기록</Button>
        </form>}
        {orderSeries.length > 0 && <div className="mt-4 h-56"><ResponsiveContainer><LineChart data={orderSeries}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="k" /><YAxis /><Tooltip formatter={(v: number) => cnt(v)} /><Legend /><Line dataKey="발주수량" name="발주일별 발주 수량(개)" stroke={C.taupe} strokeWidth={2} dot={{ r: 4 }} /></LineChart></ResponsiveContainer></div>}
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead className="bg-secondary text-left"><tr><th className="p-2">품목</th><th className="p-2 text-right">수량</th><th className="p-2">상태</th><th className="p-2">발주일</th><th className="p-2">입고일</th></tr></thead>
          <tbody>{(displayedOrders ?? []).map((o) => <tr key={o.id} className="border-t"><td className="p-2">{o.item}</td><td className="p-2 text-right">{cnt(Number(o.quantity))}</td>
            <td className="p-2">{showSample ? o.status : <Select value={o.status} onValueChange={(v) => setStatus.mutate({ id: o.id, status: v, prev: o })}><SelectTrigger className="h-8 w-32 bg-card" aria-label={`${o.item} 발주 상태`}><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>}</td>
            <td className="p-2">{o.ordered_at ?? "-"}</td><td className="p-2">{o.received_at ?? "-"}</td></tr>)}</tbody></table></div>
      </Panel>
    </div>
  );
}
