import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const createStaffShareInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: admin, error } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (error || !admin) throw new Error("관리자만 공유 링크를 만들 수 있습니다.");
    const { createStaffShareToken } = await import("./server/share-invite.server");
    return { token: createStaffShareToken() };
  });

export const prepareSharedSignup = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; token: string }) => z.object({
    email: z.string().trim().toLowerCase().email().max(254),
    token: z.string().max(100),
  }).parse(input))
  .handler(async ({ data }) => {
    const { isValidStaffShareToken } = await import("./server/share-invite.server");
    if (!isValidStaffShareToken(data.token)) throw new Error("공유 가입 링크가 유효하지 않거나 만료됐습니다.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // The existing signup trigger grants the role in this invitation. Preserve earlier invites.
    const { error } = await supabaseAdmin.from("invitations").upsert(
      { email: data.email, role: "staff" },
      { onConflict: "email", ignoreDuplicates: true },
    );
    if (error) throw new Error("공유 링크로 가입을 준비하지 못했습니다.");
  });
