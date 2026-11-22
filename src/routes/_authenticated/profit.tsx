import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, StatusBadge } from "@/components/app/ui";
import { C, RangePicker, UploadPanel, fetchAll, presetRange, type Range } from "@/components/app/data";
import { bucketKey, costFor, parseCosts, summarizeProfit, won, type PartRow } from "@/lib/biz";
import { loadCosts, loadSales } from "@/lib/biz-queries";

export const Route = createFileRoute("/_authenticated/profit")({
  head: () => ({ meta: [{ title: "수익성 · 주식회사 에너인프라의 경영비서" }, { name: "description", content: "원가 엑셀 업로드와 상품별 매출총이익" }] }),
  component: ProfitPage,
});

function ProfitPage() {
  const qc = useQueryClient();
  const [range, setRange] = useState<Range>(presetRange(30));
  const [by, setBy] = useState<"day" | "month">("day");
  const sales = useQuery({ queryKey: ["sales", range], queryFn: () => loadSales(range) });
  const costs = useQuery({ queryKey: ["costs"], queryFn: loadCosts });
  const parts = useQuery({ queryKey: ["parts"], queryFn: () => fetchAll<PartRow>((a, b) => supabase.from("part_costs").select("product,part,unit_price,qty").range(a, b)) });
  const s = sales.data ?? []; const c = costs.data ?? [];
  const sum = useMemo(() => summarizeProfit(s, c), [s, c]);
  const series = useMemo(() => {
    const g = new Map<string, typeof s>(); for (const x of s) { const k = bucketKey(x.sale_date, by); g.set(k, [...(g.get(k) ?? []), x]); }
    return [...g].map(([k, v]) => { const r = summarizeProfit(v, c); return { k, 매출총이익: r.gross, 이익률: r.margin === null ? null : Math.round(r.margin * 1000) / 10 }; });
  }, [s, c, by]);
  const byProduct = useMemo(() => {
    const names = [...new Set(s.map((x) => x.product))];
    return names.map((n) => { const v = s.filter((x) => x.product === n); const r = summarizeProfit(v, c);
      const last = v.length ? costFor(c, n, v[v.length - 1]!.sale_date) : null;
      const pl = (parts.data ?? []).filter((p) => p.product === n); const partSum = pl.length ? pl.reduce((a, p) => a + Number(p.unit_price) * Number(p.qty), 0) : null;
      return { n, r, cost: last, partSum }; }).sort((a, b) => b.r.revenue - a.r.revenue);
  }, [s, c, parts.data]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="수익성" desc="매출총이익 = 판매금액 합계 − (판매수량 × 적용 완제품 원가)의 합" />
      <UploadPanel title="원가 엑셀 올리기" required="상품명, 완제품 원가 (선택: 원가 변경일) — 부품 비교용은 상품명, 부품명, 부품단가, 사용수량"
        analyze={(d) => { const p = parseCosts(d.rows, d.headers); const isParts = p.parts.length > 0;
          return { count: isParts ? p.parts.length : p.rows.length, errors: p.errors, missing: p.missing, ready: (p.rows.length + p.parts.length) > 0,
            sample: isParts ? p.parts.slice(0, 8).map((r) => ({ 상품명: r.product, 부품명: r.part, 부품단가: r.unit_price, 사용수량: r.qty })) : p.rows.slice(0, 8).map((r) => ({ 상품명: r.product, 완제품원가: r.unit_cost, 원가변경일: r.effective_date ?? "미제공" })),
            scope: isParts ? `파일에 있는 상품의 부품 구성을 이 파일로 교체합니다. (비교용, 수익성 계산에는 쓰지 않음)` : `같은 상품·같은 원가 변경일의 기존 원가를 교체합니다. 변경일이 없으면 오늘 업로드 기준일로 표시됩니다.` }; }}
        apply={async (name, _a, d) => { const p = parseCosts(d.rows, d.headers);
          const { data, error } = await supabase.rpc("import_costs", { _file: name, _costs: p.rows as never, _parts: p.parts as never });
          if (error) throw new Error("원가를 반영하지 못했습니다."); qc.invalidateQueries(); const r = data as { inserted: number; replaced: number };
          return `기존 ${r.replaced}건을 교체하고 ${r.inserted}건을 반영했습니다.`; }} />
      <Panel title="기간별 매출총이익" accent="gold">
        <RangePicker value={range} onChange={setRange} />
        <div className="mt-3 flex gap-2"><Button size="sm" variant={by === "day" ? "default" : "outline"} onClick={() => setBy("day")}>일별</Button><Button size="sm" variant={by === "month" ? "default" : "outline"} onClick={() => setBy("month")}>월별</Button></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border p-3"><p className="text-sm text-muted-foreground">매출</p><p className="text-xl font-bold">{won(sum.revenue)}</p></div>
          <div className="rounded-md border border-t-4 border-t-gold p-3"><p className="text-sm text-muted-foreground">매출총이익</p><p className="text-xl font-bold">{won(sum.gross)}</p></div>
          <div className="rounded-md border p-3"><p className="text-sm text-muted-foreground">매출총이익률</p><p className="text-xl font-bold">{sum.margin === null ? "확인 필요" : `${(sum.margin * 100).toFixed(1)}%`}</p></div>
        </div>
        {sum.missingCount > 0 && <p className="mt-3 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">원가 확인 필요: {sum.missingCount}건 ({won(sum.missingRevenue)}) — {sum.missingProducts.join(", ")}. 매출총이익은 원가가 있는 매출 {won(sum.costedRevenue)} 범위에서만 계산했습니다.</p>}
        {series.length > 0 && <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="h-64"><ResponsiveContainer><LineChart data={series}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="k" /><YAxis tickFormatter={(v) => `${(v / 10000).toLocaleString()}만`} /><Tooltip formatter={(v: number) => won(v)} /><Legend /><Line dataKey="매출총이익" name="매출총이익(원)" stroke={C.gold} strokeWidth={2} dot={{ r: 4 }} /></LineChart></ResponsiveContainer></div>
          <div className="h-64"><ResponsiveContainer><LineChart data={series}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="k" /><YAxis unit="%" /><Tooltip formatter={(v: number) => `${v}%`} /><Legend /><Line dataKey="이익률" name="매출총이익률(%)" stroke={C.orange} strokeWidth={2} dot={{ r: 4 }} connectNulls={false} /></LineChart></ResponsiveContainer></div>
        </div>}
      </Panel>
      <Panel title="상품별 수익성">
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="bg-secondary text-left"><tr><th className="p-2">상품명</th><th className="p-2 text-right">매출</th><th className="p-2 text-right">적용 원가</th><th className="p-2 text-right">매출총이익</th><th className="p-2 text-right">부품비 합계(비교)</th><th className="p-2">비고</th></tr></thead>
          <tbody>{byProduct.map(({ n, r, cost, partSum }) => <tr key={n} className="border-t"><td className="p-2 font-semibold">{n}</td><td className="p-2 text-right">{won(r.revenue)}</td>
            <td className="p-2 text-right">{cost ? <>{won(Number(cost.unit_cost))}<br /><span className="text-xs text-muted-foreground">{cost.effective_date ? `변경일 ${cost.effective_date}` : `업로드 기준일 ${cost.basis_date}`}</span></> : "-"}</td>
            <td className="p-2 text-right">{won(r.gross)}</td>
            <td className="p-2 text-right">{partSum === null ? "-" : <>{won(partSum)}{cost && partSum !== Number(cost.unit_cost) && <><br /><span className="text-xs text-warning">차이 {won(partSum - Number(cost.unit_cost))}</span></>}</>}</td>
            <td className="p-2">{r.missingCount > 0 && <StatusBadge label="원가 확인 필요" tone="warn" />}</td></tr>)}</tbody></table></div>
      </Panel>
    </div>
  );
}
