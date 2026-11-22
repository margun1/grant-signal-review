import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getGoogleEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { from: string; to: string }) => z.object({ from: z.string().datetime({ offset: true }), to: z.string().datetime({ offset: true }) }).parse(d))
  .handler(async ({ data }) => {
    const { listEvents, recordStatus } = await import("./server/gcal.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    try { const ev = await listEvents(data.from, data.to); await recordStatus(supabaseAdmin, true); return { ok: true as const, events: ev.filter((e) => !e.fromApp) }; }
    catch (e) { await recordStatus(supabaseAdmin, false, (e as Error).message); return { ok: false as const, error: (e as Error).message, events: [] }; }
  });

export const syncMeetingToCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { pushMeeting } = await import("./server/meeting-sync.server");
    return pushMeeting(context.supabase, data.id);
  });
