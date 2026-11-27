import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Activity, Download } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { exportXlsx } from "@/components/app/data";
import { DroneEducationStatistics } from "@/components/app/DroneEducationStatistics";
import { PageHeader, Panel } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sampleDronePilot, summarizeDronePilot } from "@/lib/sample-drone-pilot";

export const Route = createFileRoute("/_authenticated/drone")({
  head: () => ({ meta: [{ title: "드론 가상 실증 · 에너인프라 경영비서" }] }),
  component: DronePage,
});

const categories = [...new Set(sampleDronePilot.map(({ category }) => category))];
const months = [...new Set(sampleDronePilot.map(({ month }) => month))];
const format = (value: number) => value.toLocaleString("ko-KR", { maximumFractionDigits: 1 });

function DronePage() {
  const [category, setCategory] = useState("전체");
  const [month, setMonth] = useState("전체");
  const categoryRows = sampleDronePilot.filter((row) => category === "전체" || row.category === category);
  const rows = categoryRows.filter((row) => month === "전체" || row.month === month);
  const summary = summarizeDronePilot(rows);
  const series = months.map((period) => ({
    month: period,
    completion: summarizeDronePilot(categoryRows.filter((row) => row.month === period)).completion,
  }));
  const metrics = [
    ["실증 장소", `${summary.sites}곳`],
    ["시험 횟수", `${summary.attempts}회`],
    ["정상 완료", `${summary.completed}회`],
    ["완료율", `${format(summary.completion)}%`],
    ["평균 비행 시간", `${format(summary.averageMinutes)}분`],
    ["추가 점검", `${summary.checks}건`],
  ];
  const detailRows = rows.map((row) => ({
    기준월: row.month, 장소: row.site, 유형: row.category, 시험: row.attempts,
    정상완료: row.completed, 평균비행시간_분: row.minutes, 추가점검: row.checks,
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="드론" desc="교육용 드론 가상 실증 · 2026년 8~11월"
        action={<Button asChild variant="outline"><Link to="/drone/parts">드론 부품찾기</Link></Button>} />
      <DroneEducationStatistics />
      <div className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm font-semibold">
        <Activity className="size-4 shrink-0" aria-hidden="true" />시연용 가상 실증 데이터
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-40" aria-label="실증 유형"><SelectValue /></SelectTrigger>
          <SelectContent>{["전체", ...categories].map((value) => <SelectItem key={value} value={value}>{value === "전체" ? "전체 실증 유형" : value}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-40" aria-label="기준월"><SelectValue /></SelectTrigger>
          <SelectContent>{["전체", ...months].map((value) => <SelectItem key={value} value={value}>{value === "전체" ? "전체 기준월" : value}</SelectItem>)}</SelectContent>
        </Select>
        <Button type="button" variant="outline" className="sm:ml-auto"
          onClick={() => exportXlsx([{ name: "가상 실증", rows: detailRows }], "드론_가상실증.xlsx")}>
          <Download aria-hidden="true" />선택 자료 엑셀
        </Button>
      </div>
      <Panel title="가상 실증 요약">
        <dl className="grid grid-cols-2 gap-5 sm:grid-cols-3">
          {metrics.map(([label, value]) => <div key={label}>
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="mt-1 text-xl font-bold">{value}</dd>
          </div>)}
        </dl>
        <p className="mt-4 text-xs text-muted-foreground">완료율은 정상 완료 ÷ 시험 횟수, 평균 비행 시간은 정상 완료 횟수로 가중한 값입니다.</p>
      </Panel>
      <Panel title="월별 정상 완료율">
        <div className="h-64 min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="month" /><YAxis unit="%" domain={[0, 100]} />
              <Tooltip formatter={(value) => typeof value === "number" ? `${format(value)}%` : value} />
              <Line type="linear" dataKey="completion" name="완료율" stroke="var(--primary)" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-muted-foreground">선택한 실증 유형의 전체 월을 비교합니다.</p>
      </Panel>
      <Panel title={`실증 기록 · ${rows.length}건`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="bg-secondary"><tr>{["기준월", "실증 장소", "유형", "시험", "정상 완료", "평균 비행 시간", "추가 점검"].map((label) => (
              <th key={label} scope="col" className="p-3">{label}</th>
            ))}</tr></thead>
            <tbody>{rows.map((row) => (
              <tr key={`${row.month}-${row.site}`} className="border-t">
                <td className="p-3">{row.month}</td><td className="p-3">{row.site}</td>
                <td className="p-3">{row.category}</td><td className="p-3">{row.attempts}회</td>
                <td className="p-3">{row.completed}회</td><td className="p-3">{format(row.minutes)}분</td>
                <td className="p-3">{row.checks}건</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
