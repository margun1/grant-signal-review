import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { SECRETARY_RULES } from "./company";
import { DEFAULT_PREFERENCES, preferencesSchema } from "./support";

const actionSchema = z.object({
  type: z.enum(["none", "add_task", "add_meeting"]),
  title: z.string().nullable(), date: z.string().nullable().describe("YYYY-MM-DD"), start_time: z.string().nullable().describe("HH:MM"), end_time: z.string().nullable(),
});
const answerSchema = z.object({ answer: z.string(), sources: z.array(z.string()), action: actionSchema });


function kstToday() { return new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10); }

export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { messages: { role: "user" | "assistant"; content: string }[] }) => z.object({ messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) })).min(1).max(20) }).parse(d))
  .handler(async ({ data, context }) => {
    const today = kstToday();
    const { secretaryContext, externalToday } = await import("./server/secretary-context.server");
    const { data: staff } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
    if (!staff) throw new Error("활성 직원 계정이 필요합니다.");
    const prefs = await context.supabase.from("support_preferences").select("*").eq("user_id", context.userId).maybeSingle();
    if (prefs.error) throw new Error("회사 조건을 읽지 못했습니다.");
    const weather = process.env['DATA_GO_KEY'];
    const ctx = await secretaryContext(context.supabase, today, await externalToday(weather ? { weather } : {}, today, preferencesSchema.parse(prefs.data ?? DEFAULT_PREFERENCES)));
    const { generateStructured } = await import("./server/ai.server");
    return generateStructured({
      schema: answerSchema,
      instructions: `${SECRETARY_RULES}\n오늘은 ${today}(한국 시간)이다.
사용자가 할 일 추가나 일정(내부 회의) 추가를 요청하면 직접 실행하지 말고 action에 제안만 넣는다(type add_task 또는 add_meeting). 그 외에는 type none, 나머지 필드는 null. sources에는 근거로 쓴 자료 이름(예: 매출 엑셀 2026-01-01~01-31)을 넣는다.
[업무 자료]\n${JSON.stringify(ctx)}`,
      messages: data.messages,
    });
  });

export const generateReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { start: string; end: string }) => z.object({ start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).refine((v) => v.start <= v.end).parse(d))
  .handler(async ({ data, context }) => {
    const { makeReport } = await import("./server/report.server");
    const content = await makeReport(context.supabase, data.start, data.end);
    const { data: row, error } = await context.supabase.from("ai_reports").insert({ kind: "직접", period_start: data.start, period_end: data.end, content, created_by: context.userId }).select("id").single();
    if (error) throw new Error("리포트를 저장하지 못했습니다.");
    return { id: row.id };
  });
