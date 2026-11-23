import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getWeather = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: staff, error } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
    if (error || !staff) throw new Error("활성 직원 계정만 날씨를 조회할 수 있습니다.");
    const key = process.env['DATA_GO_KEY'];
    if (!key) return { ok: false as const, error: "날씨 인증키가 설정되지 않았습니다. DATA_GO_KEY 등록이 필요합니다." };
    const { loadWeather } = await import("./server/weather.server");
    return { ok: true as const, data: await loadWeather(key) };
  });