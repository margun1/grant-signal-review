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
    if (error || !staff) throw new Error("활성 직원 계정만 ESCO 목록을 조회할 수 있습니다.");
    const key = process.env["DATA_GO_KEY"]?.trim();
    if (!key) throw new Error("Lovable Secrets의 DATA_GO_KEY를 확인해 주세요.");
    const { fetchEscoCompanies } = await import("./server/esco.server");
    return fetchEscoCompanies(key, data.format);
  });
