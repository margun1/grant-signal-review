import { describe, it, expect } from "vitest";
import { bucketKey, recommendOrder, summarizeProfit, costFor, parseSales } from "./biz";

describe("재고·수익성 규칙", () => {
  it("목표 30, 현재 8, 미입고 10이면 12개 권장", () => { expect(recommendOrder(30, 8, 10)).toBe(12); });
  it("권장량은 0 미만이 되지 않음", () => { expect(recommendOrder(10, 8, 5)).toBe(0); });
  it("판매일에 해당하는 원가 적용", () => {
    const costs = [{ product: "A", unit_cost: 100, effective_date: "2026-01-01" }, { product: "A", unit_cost: 150, effective_date: "2026-03-01" }];
    expect(costFor(costs, "A", "2026-02-10")?.unit_cost).toBe(100);
    expect(costFor(costs, "A", "2026-03-05")?.unit_cost).toBe(150);
  });
  it("매출총이익 = 판매금액 − 수량×원가, 원가 없는 판매는 제외하고 표시", () => {
    const r = summarizeProfit([
      { sale_date: "2026-01-02", product: "A", quantity: 2, amount: 1000 },
      { sale_date: "2026-01-02", product: "B", quantity: 1, amount: 500 },
    ], [{ product: "A", unit_cost: 300, effective_date: null }]);
    expect(r.gross).toBe(400); expect(r.revenue).toBe(1500); expect(r.missingCount).toBe(1); expect(r.missingProducts).toEqual(["B"]);
  });
  it("주간 집계는 월요일부터 일요일까지 같은 그룹", () => {
    expect(bucketKey("2026-11-23", "week")).toBe("2026-11-23");
    expect(bucketKey("2026-11-29", "week")).toBe("2026-11-23");
    expect(bucketKey("2027-01-01", "week")).toBe("2026-12-28");
  });
  it("같은 값의 판매 건을 합치지 않음", () => {
    const row = { 판매일: "2026-01-02", 구매자명: "x", 상품명: "A", 수량: 1, 판매금액: 100 };
    expect(parseSales([row, { ...row }], Object.keys(row)).rows).toHaveLength(2);
  });
});
