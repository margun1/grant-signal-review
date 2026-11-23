import sample from "@/data/powerboard-sample.json";

export type PilotRow = Record<string, string>;
export const pilotRows: PilotRow[] = sample;
export const pilotColumns = Object.keys(sample[0] ?? {});
export const pilotCategories = ["가정", "취약계층", "학교", "기관 도입"];
export const pilotMonths = [...new Set(pilotRows.map((r) => r["기준월"] ?? ""))].sort();
export function pilotNumber(row: PilotRow, field: string): number | null {
  const value = row[field];
  if (!value?.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
export function filterPilot(category: string, month: string) {
  return pilotRows.filter((r) => (category === "전체" || r["데이터 구분"] === category) && (month === "전체" || r["기준월"] === month));
}
export function summarizePilot(rows: PilotRow[]) {
  const measured = rows.filter((r) => pilotNumber(r, "예정 수집 건수") !== null);
  const sum = (field: string, values = rows) => values.reduce((total, row) => total + (pilotNumber(row, field) ?? 0), 0);
  const average = (field: string) => {
    const values = measured.map((r) => pilotNumber(r, field)).filter((n): n is number => n !== null);
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  };
  const planned = sum("예정 수집 건수", measured);
  const notices = sum("전달 알림 건수", measured);
  const institutions = rows.filter((r) => r["데이터 구분"] === "기관 도입");
  const paid = institutions.filter((r) => r["도입 결정"] === "유료 도입");
  return {
    count: rows.length,
    sites: new Set(rows.map((r) => `${r["데이터 구분"]}:${r["설치처 ID"]}`)).size,
    measured: measured.length,
    collection: planned ? sum("유효 수집 건수", measured) / planned * 100 : null,
    conversion: notices ? sum("알림 후 조치 건수", measured) / notices * 100 : null,
    saving: average("보정 사용량 절감률(%)"),
    error: average("계측 오차율(%)"),
    simulatedSavings: measured.length ? sum("모의 요금 절감액(원)", measured) : null,
    institutions: institutions.length,
    paid: paid.length,
    contract: institutions.length ? sum("계약금액(원)", paid) : null,
    cost: institutions.length ? sum("설치 및 초기 운영 원가(원)", institutions) : null,
  };
}
export function pilotSeries(category: string) {
  return pilotMonths.map((month) => {
    const s = summarizePilot(filterPilot(category, month));
    return { month, saving: s.saving, collection: s.collection, conversion: s.conversion };
  }).filter((s) => s.saving !== null);
}