import { describe, expect, it } from "vitest";
import { filterPilot, pilotRows, pilotNumber, summarizePilot } from "./powerboard";

describe("POWERBOARD 가상 실증 자료", () => {
  it("첨부된 80건을 가상 자료로 유지한다", () => {
    expect(pilotRows).toHaveLength(80);
    expect(pilotRows.every((r) => r["자료 유형"] === "가상")).toBe(true);
  });
  it("계측 72건과 기관 도입 8건을 분리한다", () => {
    const s = summarizePilot(pilotRows);
    expect(s.measured).toBe(72);
    expect(s.institutions).toBe(8);
    expect(s.paid).toBe(4);
    expect(s.contract).toBe(8500000);
    expect(s.cost).toBe(5860000);
  });
  it("수집률은 총 유효 건수 / 총 예정 건수로 계산한다", () => {
    const rows = filterPilot("가정", "2026-06");
    expect(rows).toHaveLength(12);
    expect(summarizePilot(rows).collection).toBeCloseTo(99.7071759259);
  });
  it("빈값을 0으로 바꾸지 않고 음수 절감액을 유지한다", () => {
    expect(pilotNumber(pilotRows[0] ?? {}, "계약금액(원)")).toBeNull();
    expect(pilotNumber(pilotRows[0] ?? {}, "모의 요금 절감액(원)")).toBe(-577);
    expect(summarizePilot(filterPilot("기관 도입", "2026-09")).saving).toBeNull();
  });
});