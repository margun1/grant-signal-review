import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { briefRowSchema, kstDay, shortAnswer } from "./secretary";
import { SECRETARY_RULES } from "./company";
import { DEFAULT_PREFERENCES, preferencesSchema } from "./support";

export const getTodayBriefingTasks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const today = kstDay();
    const { error: generationError } = await context.supabase.rpc("generate_checklist", {
      _date: today,
    });
    if (generationError) throw new Error("오늘의 반복 체크리스트를 불러오지 못했습니다.");

    const { data, count, error } = await context.supabase
      .from("tasks")
      .select("id,title,template_id", { count: "exact" })
      .eq("due_date", today)
      .eq("done", false)
      .order("created_at")
      .order("id")
      .limit(50);
    if (error) throw new Error("오늘의 할 일을 불러오지 못했습니다.");
    return {
      tasks: (data ?? []).map(({ id, title, template_id }) => ({
        id,
        title,
        recurring: template_id !== null,
      })),
      count,
    };
  });

export const getSecretaryScreen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const today = kstDay();
    const { data: staff } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
    if (!staff) throw new Error("활성 직원 계정이 필요합니다.");
    const [brief, history, role] = await Promise.all([
      context.supabase
        .from("secretary_briefings")
        .select("*")
        .eq("user_id", context.userId)
        .eq("briefing_date", today)
        .maybeSingle(),
      context.supabase
        .from("secretary_messages")
        .select("client_id,role,parts,created_at")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(60),
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    ]);
    if (brief.error || history.error || role.error)
      throw new Error("저장된 브리핑과 대화를 불러오지 못했습니다.");
    return {
      today,
      isAdmin: !!role.data,
      brief: brief.data ? briefRowSchema.parse(brief.data) : null,
      messages: (history.data ?? []).reverse(),
    };
  });

export const ensureSecretaryBriefing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { force: boolean; requestKey: string }) =>
    z.object({ force: z.boolean(), requestKey: z.string().uuid() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const claim = await context.supabase.rpc("claim_secretary_briefing", {
      _force: data.force,
      _request_key: data.requestKey,
    });
    if (claim.error) throw new Error("사장님 관리자 계정만 오늘의 브리핑을 만들 수 있습니다.");
    const parsed = z.object({ claimed: z.boolean(), row: briefRowSchema }).parse(claim.data);
    if (!parsed.claimed) return parsed.row;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { externalToday, secretaryContext } = await import("./server/secretary-context.server");
    const { makeBriefing, safeAiError } = await import("./server/secretary-ai.server");
    const { data: access, error: accessError } = await context.supabase
      .from("secretary_ai_access")
      .select("*")
      .eq("scope", "secretary")
      .maybeSingle();
    let failure: string | null = null;
    let sources: unknown = parsed.row.sources;
    let content = parsed.row.content;
    try {
      if (accessError) throw new Error("AI 사용 상태를 확인하지 못했습니다.");
      if (access && !(data.force && access.reason === "budget")) throw new Error(access.message);
      if (access && data.force && access.reason === "budget") {
        const { error } = await supabaseAdmin
          .from("secretary_ai_access")
          .delete()
          .eq("scope", "secretary")
          .eq("reason", "budget");
        if (error) throw new Error("AI 사용 상태를 갱신하지 못했습니다.");
      }
      const key = process.env["LOVABLE_API_KEY"];
      if (!key) throw new Error("Lovable AI 연결이 설정되지 않았습니다.");
      const weather = process.env["DATA_GO_KEY"];
      const firecrawl = process.env["FIRECRAWL_API_KEY"];
      const prefs = await context.supabase
        .from("support_preferences")
        .select("*")
        .eq("user_id", context.userId)
        .maybeSingle();
      if (prefs.error) throw new Error("회사 조건을 읽지 못했습니다.");
      const checklist = await context.supabase.rpc("generate_checklist", {
        _date: parsed.row.briefing_date,
      });
      if (checklist.error) throw new Error("오늘 할 일을 확인하지 못했습니다.");
      const external = await externalToday(
        { lovable: key, ...(weather ? { weather } : {}), ...(firecrawl ? { firecrawl } : {}) },
        parsed.row.briefing_date,
        preferencesSchema.parse(prefs.data ?? DEFAULT_PREFERENCES),
      );
      sources = await secretaryContext(context.supabase, parsed.row.briefing_date, external);
      content = shortAnswer(
        await makeBriefing(
          getRequest(),
          key,
          `${SECRETARY_RULES}\n[앱 요약 숫자와 오늘 받은 외부 자료]\n${JSON.stringify(sources)}`,
        ),
      );
      if (!content.trim()) throw new Error("AI가 브리핑 내용을 반환하지 않았습니다.");
    } catch (error) {
      const safe = safeAiError(error);
      failure =
        error instanceof Error &&
        !(error instanceof (await import("./server/secretary-ai.server")).SecretaryAiError)
          ? error.message
          : safe.message;
      if (safe.status === 402 || safe.status === 403) {
        const { error: saveError } = await supabaseAdmin.from("secretary_ai_access").upsert({
          scope: "secretary",
          status: safe.status,
          reason: safe.reason,
          message: safe.message,
          updated_at: new Date().toISOString(),
        });
        if (saveError)
          failure = "AI 사용 제한 상태를 저장하지 못했습니다. 자동 생성은 중지되었습니다.";
      }
    }
    const saved = await supabaseAdmin
      .from("secretary_briefings")
      .update({
        status: failure ? "failed" : "ready",
        content,
        sources: JSON.parse(JSON.stringify(sources)),
        error: failure,
        updated_at: new Date().toISOString(),
      })
      .eq("id", parsed.row.id)
      .eq("user_id", context.userId)
      .eq("request_key", data.requestKey)
      .select("*")
      .single();
    if (saved.error) throw new Error("브리핑을 저장하지 못했습니다. 자동 재생성하지 않습니다.");
    return briefRowSchema.parse(saved.data);
  });
