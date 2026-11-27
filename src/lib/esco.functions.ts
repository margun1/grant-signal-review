import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getEscoCompanies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { format: "json" | "xml" }) =>
    z.object({ format: z.enum(["json", "xml"]) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: staff, error } = await context.supabase.rpc("is_staff", {
      _user_id: context.userId,
    });
    if (error) throw new Error("직원 권한을 확인하는 중 오류가 발생했습니다. 다시 로그인한 뒤 조회해 주세요.");
    if (!staff) throw new Error("활성 직원 계정만 ESCO 목록을 조회할 수 있습니다.");
    const key = process.env["DATA_GO_KEY"]?.trim();
    if (!key) throw new Error("현재 배포 서버에 DATA_GO_KEY가 설정되어 있지 않습니다. Lovable에서 실행 중이면 Lovable Secrets를 확인해 주세요.");
    const { fetchEscoCompanies } = await import("./server/esco.server");
    return fetchEscoCompanies(key, data.format);
  });
