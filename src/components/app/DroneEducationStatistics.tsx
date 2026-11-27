import { useState } from "react";
import { Panel } from "@/components/app/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { droneEducationInstitutions, droneTrainingAircraft } from "@/lib/drone-education-statistics";

type RegionRow = readonly [province: string, district: string, ...counts: number[]];
const formatNumber = new Intl.NumberFormat("ko-KR");

export function DroneEducationStatistics() {
  return (
    <>
      <RegionalStatistics title="권역별 드론 교육기관 현황"
        columns={["전문교육기관", "사설교육기관"]} rows={droneEducationInstitutions} unit="곳" />
      <RegionalStatistics title="권역별 기체 보유 수량"
        columns={["1종 기체", "2종 기체", "3종 기체"]} rows={droneTrainingAircraft} unit="대"
        detail="드론 전문교육기관의 기체 보유 수량입니다." />
    </>
  );
}

function RegionalStatistics({ title, columns, rows, unit, detail }: {
  title: string;
  columns: readonly string[];
  rows: readonly RegionRow[];
  unit: string;
  detail?: string;
}) {
  const [province, setProvince] = useState("전체");
  const provinces = [...new Set(rows.map(([region]) => region))];
  const visible = rows.filter(([region]) => province === "전체" || province === region);
  const totals = columns.map((_, index) => visible.reduce((sum, row) => sum + row[index + 2], 0));

  return (
    <Panel title={title}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          <p>한국교통안전공단 공공데이터 · 2023년 7월 25일 기준</p>
          {detail && <p>{detail}</p>}
        </div>
        <Select value={province} onValueChange={setProvince}>
          <SelectTrigger className="w-44" aria-label={`${title} 시도 선택`}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="전체">전체 시도</SelectItem>
            {provinces.map((region) => <SelectItem key={region} value={region}>{region}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <dl className="mb-4 flex flex-wrap gap-x-6 gap-y-2 rounded-md bg-secondary p-3">
        {columns.map((column, index) => (
          <div key={column}>
            <dt className="text-sm text-muted-foreground">{column} 합계</dt>
            <dd className="font-semibold tabular-nums">{formatNumber.format(totals[index])}{unit}</dd>
          </div>
        ))}
      </dl>
      <div className="max-h-80 overflow-auto rounded-md border" tabIndex={0} role="region" aria-label={`${title} 표`}>
        <table className="w-full min-w-[30rem] text-sm">
          <caption className="sr-only">{title} · {visible.length}개 시군구</caption>
          <thead className="sticky top-0 bg-secondary">
            <tr>
              <th scope="col" className="p-3 text-left">시도</th>
              <th scope="col" className="p-3 text-left">시군구</th>
              {columns.map((column) => <th key={column} scope="col" className="p-3 text-right">{column}</th>)}
            </tr>
          </thead>
          <tbody>
            {visible.map(([region, district, ...counts]) => (
              <tr key={`${region}/${district}`} className="border-t">
                <td className="p-3">{region}</td>
                <th scope="row" className="p-3 text-left font-medium">{district}</th>
                {counts.map((count, index) => <td key={columns[index]} className="p-3 text-right tabular-nums">{formatNumber.format(count)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
