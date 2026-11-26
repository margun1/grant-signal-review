import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const path = "settings/integration-notes.json";
const note = z.string().trim().max(300).default("");
const notesSchema = z.object({
  google_calendar: note,
  notion: note,
  kakao: note,
  email: note,
});
export type IntegrationNotes = z.infer<typeof notesSchema>;

async function requireAdminStorage(supabase: SupabaseClient<Database>, userId: string) {
  const [staff, admin] = await Promise.all([
    supabase.rpc("is_staff", { _user_id: userId }),
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
  ]);
  if (staff.error || admin.error || !staff.data || !admin.data) {
    throw new Error("활성 관리자만 외부 연동 상태를 관리할 수 있습니다.");
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin.storage.from("documents");
}

export const getIntegrationNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const storage = await requireAdminStorage(context.supabase, context.userId);
    const { data, error } = await storage.download(path);
    if (
      error?.status === 404 ||
      error?.statusCode === "404" ||
      error?.message === "Object not found"
    ) {
      return notesSchema.parse({});
    }
    if (error || !data) throw new Error("외부 연동 상태를 불러오지 못했습니다.");
    const parsed = notesSchema.safeParse(
      await data
        .text()
        .then(JSON.parse)
        .catch(() => null),
    );
    if (!parsed.success) throw new Error("저장된 외부 연동 상태를 읽지 못했습니다.");
    return parsed.data;
  });

export const saveIntegrationNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: IntegrationNotes) => notesSchema.parse(data))
  .handler(async ({ context, data }) => {
    const storage = await requireAdminStorage(context.supabase, context.userId);
    const { error } = await storage.upload(
      path,
      new Blob([JSON.stringify(data)], { type: "application/json" }),
      { upsert: true, cacheControl: "0", contentType: "application/json" },
    );
    if (error) throw new Error("외부 연동 상태를 저장하지 못했습니다.");
    return data;
  });
