import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, StatusBadge } from "@/components/app/ui";
import { SampleSalesPanel } from "@/components/app/SampleSalesPanel";
import { C, RangePicker, UploadPanel, fetchAll, presetRange, type Range } from "@/components/app/data";
import { bucketKey, costFor, parseCosts, summarizeProfit, won, type PartRow } from "@/lib/biz";
import { loadCosts, loadSales } from "@/lib/biz-queries";
import { sampleSales } from "@/lib/sample-sales";

export const Route = createFileRoute("/_authenticated/profit")({
  head: () => ({ meta: [{ title: "수익성 · 주식회사 에너인프라의 경영비서" }, { name: "description", content: "원가 엑셀 업로드와 상품별 매출총이익" }] }),
  component: ProfitPage,
});

const periods = [
  ["day", "일별"],
  ["week", "주간별"],
  ["month", "월별"],
] as const;
const chartStyles = [
  ["bar", "막대그래프"],
  ["line", "꺾은선 그래프"],
] as const;

const sampleRange = { start: "2026-06-01", end: "2026-11-30" };
const chartSources = [
  ["sample", "가상 매출"],
  ["actual", "실제 매출·수익성"],
] as const;

type ProfitPoint = {
  period: string;
  revenue: number;
  gross: number | null;
  margin: number | null;
};

function ProfitChart({
  data,
  style,
  mode,
}: {
  data: ProfitPoint[];
  style: "bar" | "line";
  mode: "sample" | "amount" | "percentage";
}) {
  const Chart = style === "bar" ? BarChart : LineChart;
  const percentage = mode === "percentage";
  const metrics = percentage
    ? [{ key: "margin", label: "매출총이익률", color: C.orange }]
    : mode === "sample"
      ? [{ key: "revenue", label: "가상 매출", color: C.orange }]
      : [
          { key: "revenue", label: "매출", color: C.orange },
          { key: "gross", label: "매출총이익", color: C.gold },
        ];
  return (
    <div className="h-64 min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <Chart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="period" minTickGap={14} />
          <YAxis tickFormatter={(value: number) => percentage
            ? `${value}%`
            : `${(value / 10000).toLocaleString("ko-KR")}만`} />
          <Tooltip formatter={(value) => typeof value === "number"
            ? percentage ? `${value}%` : won(value)
            : "기록 없음"} />
          <Legend />
          {metrics.map(({ key, label, color }) => style === "bar"
            ? <Bar key={key} dataKey={key} name={label} fill={color} />
            : <Line key={key} dataKey={key} name={label} stroke={color} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />)}
        </Chart>
      </ResponsiveContainer>
    </div>
  );
}

function ProfitPage() {
  const qc = useQueryClient();
  const [range, setRange] = useState<Range>(presetRange(30));
  const [source, setSource] = useState<(typeof chartSources)[number][0]>("sample");
  const [sampleDates, setSampleDates] = useState<Range>(sampleRange);
  const [by, setBy] = useState<(typeof periods)[number][0]>("day");
  const [chartStyle, setChartStyle] = useState<(typeof chartStyles)[number][0]>("bar");
  const sales = useQuery({ queryKey: ["sales", range], queryFn: () => loadSales(range) });
  const costs = useQuery({ queryKey: ["costs"], queryFn: loadCosts });
  const parts = useQuery({ queryKey: ["parts"], queryFn: () => fetchAll<PartRow>((a, b) => supabase.from("part_costs").select("product,part,unit_price,qty").range(a, b)) });
  const s = sales.data ?? []; const c = costs.data ?? [];
  const sum = useMemo(() => summarizeProfit(s, c), [s, c]);
  const series = useMemo(() => {
    const groups = new Map<string, typeof s>();
    for (const sale of s) {
      const key = bucketKey(sale.sale_date, by);
      const group = groups.get(key) ?? [];
      group.push(sale);
      groups.set(key, group);
    }
    return [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([period, group]) => {
      const result = summarizeProfit(group, c);
      return {
        period,
        revenue: result.revenue,
        gross: result.missingCount === group.length ? null : result.gross,
        margin: result.margin === null ? null : Math.round(result.margin * 1000) / 10,
      };
    });
  }, [s, c, by]);
  const sampleSeries = useMemo(() => {
    const groups = new Map<string, number>();
    for (const [date, , , quantity, unitPrice] of sampleSales) {
      if (date < sampleDates.start || date > sampleDates.end) continue;
      const period = bucketKey(date, by);
      groups.set(period, (groups.get(period) ?? 0) + quantity * unitPrice);
    }
    return [...groups].map(([period, revenue]) => ({ period, revenue, gross: null, margin: null }));
  }, [sampleDates, by]);
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
      <SampleSalesPanel profitability />
      <Panel title="수익성 그래프" accent="primary">
        <div role="group" aria-label="그래프 데이터" className="mb-4 flex flex-wrap gap-2">
          {chartSources.map(([value, label]) => (
            <Button key={value} type="button" size="sm" variant={source === value ? "default" : "outline"}
              aria-pressed={source === value} onClick={() => setSource(value)}>{label}</Button>
          ))}
        </div>
        {source === "sample" ? (
          <>
            <div className="flex flex-wrap items-end gap-2">
              <RangePicker value={sampleDates} onChange={setSampleDates} presets={[]} />
              <Button type="button" variant="outline" size="sm" onClick={() => setSampleDates(sampleRange)}>
                가상 기간 전체
              </Button>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">가상 데이터 · 원가가 없어 가상 매출만 표시합니다.</p>
          </>
        ) : (
          <RangePicker value={range} onChange={setRange} />
        )}
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
          <div role="group" aria-label="그래프 집계 단위" className="flex flex-wrap gap-2">
            {periods.map(([value, label]) => (
              <Button key={value} type="button" size="sm" variant={by === value ? "default" : "outline"}
                aria-pressed={by === value} onClick={() => setBy(value)}>{label}</Button>
            ))}
          </div>
          <div role="group" aria-label="그래프 유형" className="flex flex-wrap gap-2">
            {chartStyles.map(([value, label]) => (
              <Button key={value} type="button" size="sm" variant={chartStyle === value ? "default" : "outline"}
                aria-pressed={chartStyle === value} onClick={() => setChartStyle(value)}>{label}</Button>
            ))}
          </div>
        </div>
        {by === "week" && <p className="mt-2 text-xs text-muted-foreground">월요일~일요일 기준 · 가로축은 주 시작일입니다.</p>}
        {source === "sample" ? (
          <div className="mt-4">
            {sampleSeries.length > 0 ? <ProfitChart data={sampleSeries} style={chartStyle} mode="sample" /> : (
              <p className="text-sm text-muted-foreground">선택한 기간에 가상 매출이 없습니다.</p>
            )}
          </div>
        ) : sales.isPending || costs.isPending ? (
          <p role="status" className="mt-4 text-sm text-muted-foreground">매출과 원가 자료를 불러오는 중…</p>
        ) : sales.isError || costs.isError ? (
          <p role="alert" className="mt-4 text-sm text-destructive">매출 또는 원가 자료를 불러오지 못했습니다.</p>
        ) : series.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">선택한 기간에 등록된 실제 매출이 없습니다.</p>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <ProfitChart data={series} style={chartStyle} mode="amount" />
            {series.some((point) => point.margin !== null) ? (
              <ProfitChart data={series} style={chartStyle} mode="percentage" />
            ) : (
              <p className="text-sm text-muted-foreground">선택한 기간에 이익률을 계산할 수 있는 매출과 원가 자료가 없습니다.</p>
            )}
          </div>
        )}
      </Panel>
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
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border p-3"><p className="text-sm text-muted-foreground">매출</p><p className="text-xl font-bold">{won(sum.revenue)}</p></div>
          <div className="rounded-md border border-t-4 border-t-gold p-3"><p className="text-sm text-muted-foreground">매출총이익</p><p className="text-xl font-bold">{won(sum.gross)}</p></div>
          <div className="rounded-md border p-3"><p className="text-sm text-muted-foreground">매출총이익률</p><p className="text-xl font-bold">{sum.margin === null ? "확인 필요" : `${(sum.margin * 100).toFixed(1)}%`}</p></div>
        </div>
        {sum.missingCount > 0 && <p className="mt-3 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">원가 확인 필요: {sum.missingCount}건 ({won(sum.missingRevenue)}) — {sum.missingProducts.join(", ")}. 매출총이익은 원가가 있는 매출 {won(sum.costedRevenue)} 범위에서만 계산했습니다.</p>}
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
