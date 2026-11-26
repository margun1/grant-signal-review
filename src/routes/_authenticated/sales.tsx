import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, kst } from "@/components/app/ui";
import { SampleSalesPanel } from "@/components/app/SampleSalesPanel";
import { C, RangePicker, UploadPanel, exportXlsx, fetchAll, presetRange, type Range } from "@/components/app/data";
import { bucketKey, cnt, parseSales, won, type SaleRow } from "@/lib/biz";
import { lastUpload, loadSales } from "@/lib/biz-queries";

export const Route = createFileRoute("/_authenticated/sales")({
  head: () => ({ meta: [{ title: "매출·상품 · 주식회사 에너인프라의 경영비서" }, { name: "description", content: "매출 엑셀 업로드와 기간별 매출, 상품별 판매량" }] }),
  component: SalesPage,
});

function SalesPage() {
  const qc = useQueryClient();
  const [range, setRange] = useState<Range>(presetRange(30));
  const [by, setBy] = useState<"day" | "month">("day");
  const sales = useQuery({ queryKey: ["sales", range], queryFn: () => loadSales(range) });
  const up = useQuery({ queryKey: ["last-upload", "sales"], queryFn: () => lastUpload("sales") });
  const rows = sales.data ?? [];
  const { series, products } = useMemo(() => {
    const m = new Map<string, number>(); const p = new Map<string, number>();
    for (const s of rows) { const k = bucketKey(s.sale_date, by); m.set(k, (m.get(k) ?? 0) + Number(s.amount)); p.set(s.product, (p.get(s.product) ?? 0) + Number(s.quantity)); }
    return { series: [...m].map(([k, v]) => ({ k, 매출액: v })), products: [...p].sort((a, b) => b[1] - a[1]) };
  }, [rows, by]);
  const productSeries = useMemo(() => {
    const top = products.slice(0, 5).map(([n]) => n); const m = new Map<string, Record<string, number | string>>();
    for (const s of rows) { if (!top.includes(s.product)) continue; const k = bucketKey(s.sale_date, by); const o = m.get(k) ?? { k }; o[s.product] = Number(o[s.product] ?? 0) + Number(s.quantity); m.set(k, o); }
    return { top, data: [...m.values()] };
  }, [rows, products, by]);
  const total = rows.reduce((a, s) => a + Number(s.amount), 0);
  const colors = [C.orange, C.gold, C.taupe, C.dark, "var(--chart-4)"];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="매출·상품" desc={up.data ? `최근 반영: ${up.data.file_name} (${up.data.period_start} ~ ${up.data.period_end}, ${kst(up.data.created_at)})` : "아직 반영한 매출 엑셀이 없습니다."} />
      <SampleSalesPanel />
      <UploadPanel title="매출 엑셀 올리기" required="판매일, 구매자명, 상품명, 수량, 판매금액"
        analyze={(d) => { const p = parseSales(d.rows, d.headers); const ds = p.rows.map((r) => r.sale_date).sort();
          return { count: p.rows.length, errors: p.errors, missing: p.missing, ready: p.rows.length > 0,
            sample: p.rows.slice(0, 8).map((r) => ({ 판매일: r.sale_date, 상품명: r.product, 수량: r.quantity, 판매금액: r.amount })),
            scope: ds.length ? `판매일 ${ds[0]} ~ ${ds[ds.length - 1]} 기간의 기존 매출을 이 파일로 교체합니다. (같은 기간을 다시 올려도 중복 합산되지 않습니다)` : "" }; }}
        apply={async (name, _a, d) => {
          const rows: SaleRow[] = parseSales(d.rows, d.headers).rows;
          const { data, error } = await supabase.rpc("import_sales", { _file: name, _rows: rows as never });
          if (error) throw new Error("매출을 반영하지 못했습니다.");
          qc.invalidateQueries();
          const r = data as { inserted: number; replaced: number; start: string; end: string };
          return `${r.start} ~ ${r.end}: 기존 ${r.replaced}건을 교체하고 ${r.inserted}건을 반영했습니다.`;
        }} />
      <Panel title="기간별 매출" action={<Button size="sm" variant="outline" onClick={async () => {
        const full = await fetchAll<{ sale_date: string; buyer_name: string | null; product: string; quantity: number; amount: number }>((a, b) => supabase.from("sales").select("sale_date,buyer_name,product,quantity,amount").gte("sale_date", range.start).lte("sale_date", range.end).order("sale_date").range(a, b));
        exportXlsx([{ name: "매출", rows: full.map((s) => ({ 판매일: s.sale_date, 구매자명: s.buyer_name, 상품명: s.product, 수량: s.quantity, 판매금액: s.amount })) },
          { name: "상품별 판매량", rows: products.map(([n, q]) => ({ 상품명: n, 판매수량: q })) }], `매출_${range.start}_${range.end}.xlsx`);
      }}><Download className="size-4" />엑셀 내려받기</Button>}>
        <RangePicker value={range} onChange={setRange} />
        <div className="mt-3 flex gap-2"><Button size="sm" variant={by === "day" ? "default" : "outline"} onClick={() => setBy("day")}>일별</Button><Button size="sm" variant={by === "month" ? "default" : "outline"} onClick={() => setBy("month")}>월별</Button></div>
        <p className="mt-4 text-sm">선택 기간 매출 합계 <b className="text-lg">{won(total)}</b> · 판매 {rows.length.toLocaleString()}건 (판매일 기준)</p>
        {series.length === 0 ? <p className="py-10 text-center text-muted-foreground">선택한 기간에 매출 자료가 없습니다.</p> : (
          <div className="mt-4 h-72"><ResponsiveContainer><LineChart data={series}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="k" /><YAxis tickFormatter={(v) => `${(v / 10000).toLocaleString()}만`} /><Tooltip formatter={(v: number) => won(v)} /><Legend />
            <Line dataKey="매출액" name="매출액(원)" stroke={C.orange} strokeWidth={2} dot={{ r: 4 }} label={series.length === 1 ? { position: "top", formatter: (v: number) => won(v) } : false} /></LineChart></ResponsiveContainer></div>)}
      </Panel>
      <Panel title="상품별 판매 수량">
        {productSeries.data.length > 0 && <div className="h-72"><ResponsiveContainer><LineChart data={productSeries.data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="k" /><YAxis /><Tooltip formatter={(v: number) => cnt(v)} /><Legend />
          {productSeries.top.map((n, i) => <Line key={n} dataKey={n} name={`${n}(개)`} stroke={colors[i]} strokeWidth={2} dot={{ r: 4 }} connectNulls={false} />)}</LineChart></ResponsiveContainer></div>}
        <div className="mt-4 overflow-x-auto"><table className="w-full text-sm"><thead className="bg-secondary text-left"><tr><th className="p-2">상품명</th><th className="p-2 text-right">판매 수량</th></tr></thead>
          <tbody>{products.map(([n, q]) => <tr key={n} className="border-t"><td className="p-2">{n}</td><td className="p-2 text-right">{cnt(q)}</td></tr>)}</tbody></table></div>
      </Panel>
    </div>
  );
}
