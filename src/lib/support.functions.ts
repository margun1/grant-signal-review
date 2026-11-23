import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DEFAULT_PREFERENCES, preferencesSchema } from "./support";

export const getSupportPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const q = await context.supabase
      .from("support_preferences")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (q.error) throw new Error("지원사업 조건을 읽지 못했습니다.");
    return preferencesSchema.parse(q.data ?? DEFAULT_PREFERENCES);
  });
export const saveSupportPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => preferencesSchema.parse(data))
  .handler(async ({ context, data }) => {
    const q = await context.supabase
      .from("support_preferences")
      .upsert({ ...data, user_id: context.userId, updated_at: new Date().toISOString() });
    if (q.error) throw new Error("조건을 저장하지 못했습니다.");
    return { ok: true };
  });
export const getSupportRecommendations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { format: "json" | "xml" }) =>
    z.object({ format: z.enum(["json", "xml"]) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const { data: staff } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
    if (!staff) throw new Error("활성 직원 계정만 조회할 수 있습니다.");
    const prefs = await context.supabase
      .from("support_preferences")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (prefs.error) throw new Error("조건을 읽지 못했습니다.");
    const key = process.env["DATA_GO_KEY"];
    if (!key) throw new Error("DATA_GO_KEY 인증키 등록이 필요합니다.");
    const { loadSupport } = await import("./server/support.server");
    return loadSupport(
      key,
      preferencesSchema.parse(prefs.data ?? DEFAULT_PREFERENCES),
      data.format,
    );
  });
