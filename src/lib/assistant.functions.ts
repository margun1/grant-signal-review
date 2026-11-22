import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { COMPANY_PROFILE, WRITING_RULES } from "./company";

const actionSchema = z.object({
  type: z.enum(["none", "add_task", "add_meeting"]),
  title: z.string().nullable(), date: z.string().nullable().describe("YYYY-MM-DD"), start_time: z.string().nullable().describe("HH:MM"), end_time: z.string().nullable(),
});
const answerSchema = z.object({ answer: z.string(), sources: z.array(z.string()), action: actionSchema });


function kstToday() { return new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10); }
function minusDays(d: string, n: number) { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() - n); return x.toISOString().slice(0, 10); }

export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { messages: { role: "user" | "assistant"; content: string }[] }) => z.object({ messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) })).min(1).max(20) }).parse(d))
  .handler(async ({ data, context }) => {
    const today = kstToday();
    const { buildContext } = await import("./server/context.server");
    const ctx = await buildContext(context.supabase, minusDays(today, 29), today);
    const { generateStructured } = await import("./server/ai.server");
    return generateStructured({
      schema: answerSchema,
      instructions: `${COMPANY_PROFILE}\n${WRITING_RULES}\n너는 주식회사 에너인프라의 경영비서다. 오늘은 ${today}(한국 시간)이다. 아래 업무 자료만 근거로 답한다. 수치에는 기간과 기준 자료(업로드 기준일)를 함께 쓴다. 자료에 없으면 [확인 필요: …]로 표시한다. 고객 이름·연락처는 언급하지 않는다.
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
