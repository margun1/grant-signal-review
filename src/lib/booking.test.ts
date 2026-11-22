import { describe, it, expect } from "vitest";
import { availableSlots, isValidSlot, kstSlot } from "./booking";

describe("외부 미팅 예약 시간", () => {
  const now = new Date("2026-11-23T00:00:00Z"); // 월요일 09:00 KST
  it("평일 10~18시, 점심 12시 제외", () => {
    const d = availableSlots("2026-11-23", now, [], 1)[0]!;
    expect(d.slots.map((s) => new Date(s).getUTCHours() + 9)).toEqual([10, 11, 13, 14, 15, 16, 17]);
  });
  it("주말은 예약 불가", () => { expect(availableSlots("2026-11-28", now, [], 2)).toHaveLength(0); });
  it("이미 일정이 있는 시간은 제외", () => {
    const busy = [{ start: kstSlot("2026-11-23", 14), end: kstSlot("2026-11-23", 15) }];
    expect(availableSlots("2026-11-23", now, busy, 1)[0]!.slots).not.toContain(kstSlot("2026-11-23", 14));
  });
  it("점심시간 시작은 유효하지 않음", () => { expect(isValidSlot(kstSlot("2026-11-23", 12))).toBe(false); expect(isValidSlot(kstSlot("2026-11-23", 13))).toBe(true); });
});
