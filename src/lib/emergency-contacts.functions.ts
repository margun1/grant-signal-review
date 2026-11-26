import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { EMERGENCY_CONTACT_IMAGE, EMERGENCY_CONTACT_IMAGE_TYPES } from "./emergency-contacts";

export const uploadEmergencyContactImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: FormData) => {
    if (!(data instanceof FormData)) throw new Error("이미지 파일을 선택해 주세요.");
    return data;
  })
  .handler(async ({ data, context }) => {
    const [staff, admin] = await Promise.all([
      context.supabase.rpc("is_staff", { _user_id: context.userId }),
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    ]);
    if (staff.error || admin.error || !staff.data || !admin.data) {
      throw new Error("활성 관리자만 비상연락망을 등록할 수 있습니다.");
    }

    const image = data.get("image");
    if (
      !(image instanceof File) ||
      !EMERGENCY_CONTACT_IMAGE_TYPES.includes(image.type) ||
      image.size === 0 ||
      image.size > 5 * 1024 * 1024
    ) {
      throw new Error("5MB 이하의 PNG, JPG 또는 WebP 이미지를 선택해 주세요.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.storage
      .from("documents")
      .upload(EMERGENCY_CONTACT_IMAGE, image, {
        contentType: image.type,
        cacheControl: "0",
        upsert: true,
      });
    if (error) throw new Error("이미지를 등록하지 못했습니다.");
    return { ok: true };
  });
