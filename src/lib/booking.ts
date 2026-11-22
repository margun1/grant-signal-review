// 외부 미팅 예약 가능 시간 규칙: 평일 10:00~18:00, 점심 12:00~13:00 제외, 1시간 단위 (한국 시간)
export const SLOT_HOURS = [10, 11, 13, 14, 15, 16, 17];
export const BOOKING_DAYS = 14;

/** 한국 시간 날짜(YYYY-MM-DD)와 시(hour)로 UTC ISO 시각 */
export function kstSlot(date: string, hour: number) {
  return new Date(`${date}T${String(hour).padStart(2, "0")}:00:00+09:00`).toISOString();
}
export function kstDow(date: string) { return new Date(`${date}T12:00:00+09:00`).getUTCDay(); }

export type Busy = { start: string; end: string };
export const overlaps = (aS: string, aE: string, b: Busy) => new Date(aS) < new Date(b.end) && new Date(b.start) < new Date(aE);

/** 예약 가능한 시작 시각 목록. now 이후, 평일만, 바쁜 시간과 겹치면 제외 */
export function availableSlots(todayKst: string, now: Date, busy: Busy[], days = BOOKING_DAYS) {
  const out: { date: string; slots: string[] }[] = [];
  const base = new Date(`${todayKst}T00:00:00Z`);
  for (let i = 0; i < days; i++) {
    const d = new Date(base); d.setUTCDate(d.getUTCDate() + i); const date = d.toISOString().slice(0, 10);
    const dow = kstDow(date); if (dow === 0 || dow === 6) continue;
    const slots = SLOT_HOURS.map((h) => kstSlot(date, h)).filter((s) => {
      const e = new Date(new Date(s).getTime() + 3600000).toISOString();
      return new Date(s) > now && !busy.some((b) => overlaps(s, e, b));
    });
    out.push({ date, slots });
  }
  return out;
}
export function isValidSlot(start: string) {
  const d = new Date(start); if (isNaN(d.getTime())) return false;
  const k = new Date(d.getTime() + 9 * 3600000);
  const dow = k.getUTCDay();
  return dow !== 0 && dow !== 6 && k.getUTCMinutes() === 0 && SLOT_HOURS.includes(k.getUTCHours());
}
