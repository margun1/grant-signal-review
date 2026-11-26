import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Download, Activity } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/app/ui";
import { PowerboardElectricity } from "@/components/app/PowerboardElectricity";
import { filterPilot, pilotCategories, pilotColumns, pilotMonths, pilotSeries, summarizePilot } from "@/lib/powerboard";

export const Route = createFileRoute("/_authenticated/powerboard")({
  head: () => ({ meta: [
    { title: "POWERBOARD 실증 · 에너인프라 경영비서" },
    { name: "description", content: "POWERBOARD 가상 실증 자료의 월별 계측·절감·기관 도입 현황" },
    { property: "og:title", content: "POWERBOARD 가상 실증 현황" },
    { property: "og:description", content: "가정·취약계층·학교·기관 도입 샘플 자료 비교" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: PowerboardPage,
});
const number = (n: number | null, suffix = "", decimals = 0) => n === null ? "기록 없음" : `${n.toLocaleString("ko-KR", { maximumFractionDigits: decimals })}${suffix}`;

function PowerboardPage() {
  const [category, setCategory] = useState("전체");
  const [month, setMonth] = useState("전체");
  const rows = filterPilot(category, month);
  const s = summarizePilot(rows);
  const series = pilotSeries(category);
  const metrics = [
    ["설치처 · 선택 자료", `${s.sites}곳 · ${s.count}건`],
    ["유효 수집률", number(s.collection, "%", 2)],
    ["보정 사용량 절감률 평균", number(s.saving, "%", 2)],
    ["알림 후 행동 전환율", number(s.conversion, "%", 2)],
    ["계측 오차율 평균", number(s.error, "%", 2)],
    ["모의 요금 절감액 합계", number(s.simulatedSavings, "원")],
  ];
  function download() {
    const quote = (v: string) => `"${v.replaceAll('"', '""')}"`;
    const csv = "\uFEFF" + [pilotColumns, ...rows.map((r) => pilotColumns.map((c) => r[c] ?? ""))].map((r) => r.map(quote).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "POWERBOARD_가상실증.csv"; a.click(); URL.revokeObjectURL(url);
  }
  return <div className="mx-auto max-w-6xl space-y-6">
    <PageHeader title="POWERBOARD 실증" desc="POWERBOARD_sample.csv · 2026년 6~9월" />
    <PowerboardElectricity />
    <div className="border-y border-warning py-4 text-sm">
      <div className="flex items-center gap-2 font-bold text-warning"><Activity className="size-4" />가상 데이터 · 실제 실증 성과 아님</div>
      <p className="mt-2 text-muted-foreground">모의 요금·바우처·계약금액입니다. 실제 매출·수익성·AI 브리핑에는 반영하지 않습니다.</p>
    </div>
    <div className="flex flex-wrap items-end gap-4">
      <div className="min-w-40 space-y-2"><label className="text-sm" htmlFor="pilot-category">데이터 구분</label><Select value={category} onValueChange={setCategory}><SelectTrigger id="pilot-category"><SelectValue /></SelectTrigger><SelectContent>{["전체", ...pilotCategories].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>
      <div className="min-w-40 space-y-2"><label className="text-sm" htmlFor="pilot-month">기준월</label><Select value={month} onValueChange={setMonth}><SelectTrigger id="pilot-month"><SelectValue /></SelectTrigger><SelectContent>{["전체", ...pilotMonths].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>
      <Button variant="outline" className="sm:ml-auto" onClick={download} disabled={!rows.length}><Download />선택 자료 CSV</Button>
    </div>
    <dl className="grid grid-cols-2 gap-x-5 gap-y-6 border-y py-6 lg:grid-cols-3">{metrics.map(([label, value]) => <div key={label}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-2 break-words text-xl font-bold">{value}</dd></div>)}</dl>
    <p className="text-xs text-muted-foreground">수집률·행동 전환율은 건수 합계 기준, 절감률·오차율은 계측 자료의 단순 평균입니다. 빈값은 제외하며 음수 절감액은 유지합니다.</p>
    {series.length > 0 && <section className="space-y-4"><h2 className="font-bold">월별 보정 사용량 절감률 · {category}</h2><div className="h-64 w-full min-w-0"><ResponsiveContainer width="100%" height="100%"><LineChart data={series}><CartesianGrid stroke="var(--border)" strokeDasharray="3 3" /><XAxis dataKey="month" stroke="var(--muted-foreground)" /><YAxis unit="%" stroke="var(--muted-foreground)" /><Tooltip formatter={(v) => number(typeof v === "number" ? v : null, "%", 2)} /><Legend /><Line type="linear" dataKey="saving" name="보정 사용량 절감률 평균" stroke="var(--primary)" strokeWidth={2} dot={{ r: 4 }} connectNulls={false} /></LineChart></ResponsiveContainer></div><p className="text-xs text-muted-foreground">선택한 데이터 구분의 전체 월을 비교합니다.</p></section>}
    {s.institutions > 0 && <section className="border-y py-5"><h2 className="font-bold">기관 도입 · 가상 시나리오</h2><dl className="mt-4 grid gap-5 sm:grid-cols-3">{[["유료 도입 / 전체", `${s.paid} / ${s.institutions}곳`], ["유료 도입 계약금액 합계", number(s.contract, "원")], ["전체 설치·초기 운영 원가", number(s.cost, "원")]].map(([label,value]) => <div key={label}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-2 font-bold">{value}</dd></div>)}</dl></section>}
    <section className="space-y-3"><h2 className="font-bold">원본 항목 · {rows.length}건</h2><div className="max-h-96 overflow-auto rounded-md border" tabIndex={0} aria-label="POWERBOARD 실증 원본 자료"><table className="w-full whitespace-nowrap text-sm"><thead className="sticky top-0 bg-accent"><tr>{pilotColumns.map((c) => <th key={c} className="border-b px-4 py-3 text-left font-semibold">{c}</th>)}</tr></thead><tbody>{rows.map((r,i) => <tr key={`${r["데이터 구분"]}-${r["설치처 ID"]}-${r["기준월"]}-${i}`} className="border-b bg-card">{pilotColumns.map((c) => <td key={c} className="px-4 py-3">{r[c] || "—"}</td>)}</tr>)}</tbody></table></div>{!rows.length && <p className="text-muted-foreground">선택한 조건의 기록이 없습니다.</p>}</section>
    <p className="border-t pt-4 text-sm text-muted-foreground">출처: 업로드한 POWERBOARD_sample.csv · 학교 계약종별 ‘교육용(가정값)’ 및 모든 모의 수치는 원본 표기를 유지했습니다.</p>
  </div>;
}