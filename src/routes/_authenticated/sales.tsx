import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, kst } from "@/components/app/ui";
import { SampleSalesPanel } from "@/components/app/SampleSalesPanel";
import { C, RangePicker, UploadPanel, exportXlsx, fetchAll, presetRange, type Range } from "@/components/app/data";
import { bucketKey, cnt, parseSales, won, type SaleRow } from "@/lib/biz";
import { lastUpload, loadSales } from "@/lib/biz-queries";
import { sampleSales, sampleSalesRange } from "@/lib/sample-sales";

export const Route = createFileRoute("/_authenticated/sales")({
  head: () => ({ meta: [{ title: "매출·상품 · 주식회사 에너인프라의 경영비서" }, { name: "description", content: "매출 엑셀 업로드와 기간별 매출, 상품별 판매량" }] }),
  component: SalesPage,
});

const salesSources = [
  ["sample", "가상 매출"],
  ["actual", "실제 매출"],
] as const;
const chartTypes = [
  ["bar", "막대그래프"],
  ["line", "꺾은선 그래프"],
] as const;
const sampleRevenueRows = sampleSales.map(([sale_date, , , quantity, price]) => ({
  sale_date,
  amount: quantity * price,
}));

function SalesPage() {
  const qc = useQueryClient();
  const [range, setRange] = useState<Range>(presetRange(30));
  const [source, setSource] = useState<(typeof salesSources)[number][0]>("sample");
  const [sampleRange, setSampleRange] = useState<Range>(sampleSalesRange);
  const [chartType, setChartType] = useState<(typeof chartTypes)[number][0]>("bar");
  const [by, setBy] = useState<"day" | "month">("day");
  const sales = useQuery({ queryKey: ["sales", range], queryFn: () => loadSales(range) });
  const up = useQuery({ queryKey: ["last-upload", "sales"], queryFn: () => lastUpload("sales") });
  const rows = sales.data ?? [];
  const isSample = source === "sample";
  const chartRows = useMemo(
    () => isSample
      ? sampleRevenueRows.filter(({ sale_date }) => sale_date >= sampleRange.start && sale_date <= sampleRange.end)
      : rows,
    [isSample, sampleRange, rows],
  );
  const series = useMemo(() => {
    const amounts = new Map<string, number>();
    for (const sale of chartRows) {
      const period = bucketKey(sale.sale_date, by);
      amounts.set(period, (amounts.get(period) ?? 0) + Number(sale.amount));
    }
    return [...amounts].sort(([a], [b]) => a.localeCompare(b)).map(([k, amount]) => ({ k, amount }));
  }, [chartRows, by]);
  const products = useMemo(() => {
    const quantities = new Map<string, number>();
    for (const sale of rows) {
      quantities.set(sale.product, (quantities.get(sale.product) ?? 0) + Number(sale.quantity));
    }
    return [...quantities].sort((a, b) => b[1] - a[1]);
  }, [rows]);
  const productSeries = useMemo(() => {
    const top = products.slice(0, 5).map(([n]) => n); const m = new Map<string, Record<string, number | string>>();
    for (const s of rows) { if (!top.includes(s.product)) continue; const k = bucketKey(s.sale_date, by); const o = m.get(k) ?? { k }; o[s.product] = Number(o[s.product] ?? 0) + Number(s.quantity); m.set(k, o); }
    return { top, data: [...m.values()] };
  }, [rows, products, by]);
  const total = series.reduce((sum, point) => sum + point.amount, 0);
  const Chart = chartType === "bar" ? BarChart : LineChart;
  const chartLabel = isSample ? "가상 매출액" : "실제 매출액";
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
      <Panel title="기간별 매출" action={!isSample && <Button size="sm" variant="outline" onClick={async () => {
        const full = await fetchAll<{ sale_date: string; buyer_name: string | null; product: string; quantity: number; amount: number }>((a, b) => supabase.from("sales").select("sale_date,buyer_name,product,quantity,amount").gte("sale_date", range.start).lte("sale_date", range.end).order("sale_date").range(a, b));
        exportXlsx([{ name: "매출", rows: full.map((s) => ({ 판매일: s.sale_date, 구매자명: s.buyer_name, 상품명: s.product, 수량: s.quantity, 판매금액: s.amount })) },
          { name: "상품별 판매량", rows: products.map(([n, q]) => ({ 상품명: n, 판매수량: q })) }], `매출_${range.start}_${range.end}.xlsx`);
      }}><Download className="size-4" />엑셀 내려받기</Button>}>
        <div role="group" aria-label="매출 데이터" className="mb-3 flex flex-wrap gap-2">
          {salesSources.map(([value, label]) => (
            <Button key={value} type="button" size="sm" variant={source === value ? "default" : "outline"}
              aria-pressed={source === value} onClick={() => setSource(value)}>{label}</Button>
          ))}
        </div>
        {isSample ? (
          <>
            <div className="flex flex-wrap items-end gap-2">
              <RangePicker value={sampleRange} onChange={setSampleRange} presets={[]} />
              <Button type="button" size="sm" variant="outline" onClick={() => setSampleRange(sampleSalesRange)}>
                가상 기간 전체
              </Button>
            </div>
            <p className="mt-2 text-sm font-medium text-warning">가상 데이터 · 실제 실적 아님</p>
          </>
        ) : <RangePicker value={range} onChange={setRange} />}
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
          <div role="group" aria-label="매출 집계 단위" className="flex gap-2">
            <Button type="button" size="sm" variant={by === "day" ? "default" : "outline"} aria-pressed={by === "day"} onClick={() => setBy("day")}>일별</Button>
            <Button type="button" size="sm" variant={by === "month" ? "default" : "outline"} aria-pressed={by === "month"} onClick={() => setBy("month")}>월별</Button>
          </div>
          <div role="group" aria-label="그래프 유형" className="flex flex-wrap gap-2">
            {chartTypes.map(([value, label]) => (
              <Button key={value} type="button" size="sm" variant={chartType === value ? "default" : "outline"}
                aria-pressed={chartType === value} onClick={() => setChartType(value)}>{label}</Button>
            ))}
          </div>
        </div>
        {!isSample && sales.isPending ? (
          <p role="status" className="mt-4 text-sm text-muted-foreground">실제 매출을 불러오는 중…</p>
        ) : !isSample && sales.isError ? (
          <p role="alert" className="mt-4 text-sm text-destructive">실제 매출을 불러오지 못했습니다.</p>
        ) : (
          <>
            <p className="mt-4 text-sm">
              선택 기간 {isSample ? "가상 매출" : "매출"} 합계 <b className="text-lg">{won(total)}</b> · 판매 {chartRows.length.toLocaleString("ko-KR")}건
            </p>
            {series.length === 0 ? (
              <p className="py-10 text-center text-muted-foreground">선택한 기간에 {isSample ? "가상" : "실제"} 매출 자료가 없습니다.</p>
            ) : (
              <div className="mt-4 h-72 min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <Chart data={series}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="k" minTickGap={14} />
                    <YAxis tickFormatter={(value: number) => `${(value / 10000).toLocaleString("ko-KR")}만`} />
                    <Tooltip formatter={(value) => typeof value === "number" ? won(value) : "기록 없음"} />
                    <Legend />
                    {chartType === "bar" ? (
                      <Bar dataKey="amount" name={chartLabel} fill={C.orange} />
                    ) : (
                      <Line dataKey="amount" name={chartLabel} stroke={C.orange} strokeWidth={2} dot={{ r: 4 }} />
                    )}
                  </Chart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </Panel>
      <Panel title="상품별 판매 수량 · 실제 매출">
        {productSeries.data.length > 0 && <div className="h-72"><ResponsiveContainer><LineChart data={productSeries.data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="k" /><YAxis /><Tooltip formatter={(v: number) => cnt(v)} /><Legend />
          {productSeries.top.map((n, i) => <Line key={n} dataKey={n} name={`${n}(개)`} stroke={colors[i]} strokeWidth={2} dot={{ r: 4 }} connectNulls={false} />)}</LineChart></ResponsiveContainer></div>}
        <div className="mt-4 overflow-x-auto"><table className="w-full text-sm"><thead className="bg-secondary text-left"><tr><th className="p-2">상품명</th><th className="p-2 text-right">판매 수량</th></tr></thead>
          <tbody>{products.map(([n, q]) => <tr key={n} className="border-t"><td className="p-2">{n}</td><td className="p-2 text-right">{cnt(q)}</td></tr>)}</tbody></table></div>
      </Panel>
    </div>
  );
}
