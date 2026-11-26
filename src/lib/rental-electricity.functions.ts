import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getRentalElectricityTariffs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { page: number }) =>
    z.object({ page: z.number().int().min(1) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const { data: staff, error } = await context.supabase.rpc("is_staff", {
      _user_id: context.userId,
    });
    if (error || !staff) throw new Error("활성 직원 계정만 전기요금제를 조회할 수 있습니다.");
    const key = process.env["DATA_GO_KEY"]?.trim();
    if (!key) throw new Error("Lovable Secrets의 DATA_GO_KEY를 확인해 주세요.");
    const { fetchRentalElectricityTariffs } = await import("./server/rental-electricity.server");
    return fetchRentalElectricityTariffs(key, data.page);
  });
