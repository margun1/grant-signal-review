import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getNamyangjuHouseAverage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { month: string }) =>
    z.object({ month: z.string().regex(/^20\d{2}-(?:0[1-9]|1[0-2])$/) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const { data: staff, error } = await context.supabase.rpc("is_staff", {
      _user_id: context.userId,
    });
    if (error || !staff) throw new Error("활성 직원 계정만 전력데이터를 조회할 수 있습니다.");
    const key = process.env["DATA_GO_KEY"]?.trim();
    if (!key)
      throw new Error("Lovable Secrets의 한전 전력데이터 인증키(DATA_GO_KEY)를 확인해 주세요.");
    const { fetchNamyangjuHouseAverage } = await import("./server/kepco.server");
    return fetchNamyangjuHouseAverage(data.month, key);
  });
