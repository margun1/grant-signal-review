import { describe, expect, it } from "vitest";
import {
  briefingSourcesSchema,
  comparison,
  kstDay,
  kstWeekRange,
  shortAnswer,
  todayOnly,
  summarySchema,
} from "./secretary";
import { SECRETARY_RULES } from "./company";
describe("경영비서 규칙", () => {
  it("이번 주를 한국 시간 월요일부터 다음 월요일 직전까지 조회함", () => {
    const week = { from: "2026-11-22T15:00:00.000Z", to: "2026-11-29T15:00:00.000Z" };
    expect(kstWeekRange("2026-11-23")).toEqual(week);
    expect(kstWeekRange("2026-11-29")).toEqual(week);
  });
  it("저장된 브리핑에서 할 일, 미팅, 지원사업을 읽음", () => {
    const result = briefingSourcesSchema.parse({
      summary: {
        todayTasks: [{ title: "견적 검토", due_date: "2026-11-26" }],
        todayTaskCount: 1,
        weekMeetings: [
          { title: "주간 회의", kind: "미팅", start_at: "2026-11-26T01:00:00Z", status: "확정" },
        ],
        weekMeetingCount: 1,
      },
      external: { grants: { candidates: [{ title: "시제품 제작 지원", id: "123" }] } },
    });
    expect(result.summary?.todayTasks[0]?.title).toBe("견적 검토");
    expect(result.summary?.weekMeetings[0]?.title).toBe("주간 회의");
    expect(result.external?.grants.candidates).toEqual([{ title: "시제품 제작 지원" }]);
  });

  it("이전 브리핑에 상세 자료가 없어도 읽을 수 있음", () => {
    expect(briefingSourcesSchema.parse({})).toEqual({});
  });

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
