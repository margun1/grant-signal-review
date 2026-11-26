import { z } from "zod";

export const salesPeriodSchema = z.object({
  start: z.string(),
  end: z.string(),
  records: z.number(),
  revenue: z.number().nullable(),
  quantity: z.number().nullable(),
  covered: z.boolean(),
});
export const summarySchema = z.object({
  sales: z.object({
    yesterday: salesPeriodSchema,
    thisWeek: salesPeriodSchema,
    lastWeek: salesPeriodSchema,
    lastWeekComparable: salesPeriodSchema,
    thisMonth: salesPeriodSchema,
    lastMonth: salesPeriodSchema,
  }),
  shortageCount: z.number(),
  shortages: z.array(
    z.object({
      name: z.string(),
      quantity: z.number(),
      min_stock: z.number(),
      as_of: z.string(),
      recommended: z.number(),
    }),
  ),
  pendingOrders: z.number(),
  todayTaskCount: z.number(),
  todayTasks: z.array(z.object({ title: z.string(), due_date: z.string() })),
  weekMeetingCount: z.number(),
  weekMeetings: z.array(
    z.object({
      kind: z.string(),
      title: z.string().nullable(),
      start_at: z.string(),
      status: z.string(),
    }),
  ),
  rainDaySales: z.null(),
});
export function kstDay(now = new Date()) {
  return new Date(now.getTime() + 9 * 3600000).toISOString().slice(0, 10);
}
export function kstWeekRange(day: string) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  const midnight = () =>
    new Date(`${date.toISOString().slice(0, 10)}T00:00:00+09:00`).toISOString();
  const from = midnight();
  date.setUTCDate(date.getUTCDate() + 7);
  return { from, to: midnight() };
}
export function comparison(current: number | null, prior: number | null) {
  if (current === null || prior === null) return { difference: null, percent: null };
  return {
    difference: current - prior,
    percent: prior === 0 ? null : Math.round(((current - prior) / prior) * 1000) / 10,
  };
}
export function shortAnswer(text: string) {
  return text
    .replace(/\b01[016789][ -]?\d{3,4}[ -]?\d{4}\b/g, "[연락처 비공개]")
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .slice(0, 5)
    .join("\n");
}
export function todayOnly<T extends { fetchedAt: string }>(items: T[], today: string) {
  return items.filter((x) => kstDay(new Date(x.fetchedAt)) === today);
}
export const briefRowSchema = z.object({
  id: z.string(),
  briefing_date: z.string(),
  status: z.enum(["generating", "ready", "failed"]),
  content: z.string().nullable(),
  sources: z.json(),
  error: z.string().nullable(),
  request_key: z.string(),
  revision: z.number(),
  updated_at: z.string(),
});
export type BriefRow = z.infer<typeof briefRowSchema>;

export const briefingSourcesSchema = z.object({
  summary: summarySchema
    .pick({ todayTasks: true, todayTaskCount: true, weekMeetings: true, weekMeetingCount: true })
    .optional()
    .catch(undefined),
  external: z
    .object({
      grants: z.object({
        candidates: z.array(z.object({ title: z.string() })),
        error: z.string().optional(),
      }),
    })
    .optional()
    .catch(undefined),
});
