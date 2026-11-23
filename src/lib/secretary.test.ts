import { describe, expect, it } from "vitest";
import { comparison, kstDay, shortAnswer, todayOnly, summarySchema } from "./secretary";
import { SECRETARY_RULES } from "./company";
describe("경영비서 규칙", () => {
  it("한국 날짜의 자정에 하루가 바뀜", () => {
    expect(kstDay(new Date("2026-11-22T14:59:59Z"))).toBe("2026-11-22");
    expect(kstDay(new Date("2026-11-22T15:00:00Z"))).toBe("2026-11-23");
  });
  it("답변은 다섯 줄을 넘지 않음", () => {
    expect(shortAnswer("1\n2\n3\n4\n5\n6")).toBe("1\n2\n3\n4\n5");
  });
  it("전화번호를 답변에서 제외", () => {
    expect(shortAnswer("연락 010-1234-5678")).toBe("연락 [연락처 비공개]");
  });
  it("기록 없는 매출을 0으로 추정하지 않음", () => {
    expect(comparison(null, 100)).toEqual({ difference: null, percent: null });
  });
  it("지난주 0일 때 성장률을 만들지 않음", () => {
    expect(comparison(100, 0)).toEqual({ difference: 100, percent: null });
    expect(comparison(120, 100)).toEqual({ difference: 20, percent: 20 });
  });
  it("외부 정보는 오늘 받은 자료만 허용", () => {
    expect(
      todayOnly(
        [
          { fetchedAt: "2026-11-22T14:59:59Z", id: "old" },
          { fetchedAt: "2026-11-22T15:00:00Z", id: "today" },
        ],
        "2026-11-23",
      ).map((x) => x.id),
    ).toEqual(["today"]);
  });
  it("요약 스키마가 원본 장부·고객 정보를 포함하지 않음", () => {
    const period = {
      start: "2026-11-01",
      end: "2026-11-23",
      records: 1,
      revenue: 100,
      quantity: 1,
      covered: false,
    };
    const result = summarySchema.parse({
      sales: {
        yesterday: period,
        thisWeek: period,
        lastWeek: period,
        lastWeekComparable: period,
        thisMonth: period,
        lastMonth: period,
      },
      shortageCount: 0,
      shortages: [],
      pendingOrders: 0,
      todayTaskCount: 0,
      todayTasks: [],
      weekMeetingCount: 0,
      weekMeetings: [],
      rainDaySales: null,
      buyer_name: "private",
      sales_rows: [{ amount: 100 }],
    });
    expect(Object.keys(result)).not.toContain("sales_rows");
    expect(JSON.stringify(result)).not.toContain("private");
  });
});
