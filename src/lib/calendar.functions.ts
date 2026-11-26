import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getGoogleEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { from: string; to: string }) => z.object({ from: z.string().datetime({ offset: true }), to: z.string().datetime({ offset: true }) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: staff, error } = await context.supabase.rpc("is_staff", { _user_id: context.userId });
    if (error || !staff) throw new Error("활성 직원 계정만 일정을 조회할 수 있습니다.");
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

const timedEdit = {
  title: z.string().trim().min(1).max(250),
  start: z.iso.datetime({ offset: true }),
  end: z.iso.datetime({ offset: true }),
};

export const updateCalendarMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) =>
    z.object({ id: z.uuid(), ...timedEdit })
      .refine((d) => Date.parse(d.end) > Date.parse(d.start), "종료 시간이 시작보다 늦어야 합니다.")
      .parse(value))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: meeting, error } = await sb.from("meetings")
      .update({ title: data.title, start_at: data.start, end_at: data.end })
      .eq("id", data.id).eq("status", "확정")
      .select("kind,calendar_event_id,calendar_status").single();
    if (error || !meeting) throw new Error("확정된 일정을 수정하지 못했습니다.");
    if (meeting.kind !== "외부 미팅" || (!meeting.calendar_event_id && !meeting.calendar_status)) {
      return { calendar: null };
    }
    const { pushMeeting } = await import("./server/meeting-sync.server");
    const result = await pushMeeting(sb, data.id).catch(() => ({ ok: false }));
    return { calendar: result.ok };
  });

const googleId = z.string().regex(/^[A-Za-z0-9_-]{1,1024}$/).refine((id) => !/^ei[0-9a-f]{32}$/.test(id));

export const deleteCalendarEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => z.discriminatedUnion("source", [
    z.object({ source: z.literal("meeting"), id: z.uuid() }),
    z.object({ source: z.literal("google"), id: googleId }),
  ]).parse(value))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    if (data.source === "google") {
      const [staff, admin] = await Promise.all([
        sb.rpc("is_staff", { _user_id: context.userId }),
        sb.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
      ]);
      if (staff.error || admin.error || !staff.data || !admin.data) {
        throw new Error("관리자만 Google 캘린더 일정을 삭제할 수 있습니다.");
      }
      const { deleteGoogleEvent } = await import("./server/gcal.server");
      await deleteGoogleEvent(data.id).catch(() => {
        throw new Error("Google 캘린더 일정을 삭제하지 못했습니다.");
      });
      return;
    }

    const result = await sb.from("meetings")
      .select("status, calendar_event_id, calendar_status")
      .eq("id", data.id).single();
    if (result.error || !result.data) throw new Error("일정을 찾지 못했습니다.");
    const meeting = result.data;
    if (meeting.status === "취소") return;
    if (meeting.calendar_event_id || meeting.calendar_status) {
      const { deleteGoogleEvent, eventIdFor } = await import("./server/gcal.server");
      await deleteGoogleEvent(eventIdFor(data.id)).catch(() => {
        throw new Error("연결된 Google 캘린더 일정을 삭제하지 못했습니다. 다시 시도해 주세요.");
      });
    }
    const { error } = await sb.from("meetings").update({ status: "취소" }).eq("id", data.id);
    if (error) throw new Error("일정을 삭제하지 못했습니다. 다시 시도해 주세요.");
  });

const googleEdit = z.discriminatedUnion("allDay", [
  z.object({ id: googleId, allDay: z.literal(false), ...timedEdit }),
  z.object({
    id: googleId,
    allDay: z.literal(true),
    ...timedEdit,
    start: z.iso.date(),
    end: z.iso.date(),
  }),
]).refine((d) => Date.parse(d.end) > Date.parse(d.start), "종료 시간이 시작보다 늦어야 합니다.");

export const updateGoogleCalendarEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => googleEdit.parse(value))
  .handler(async ({ data, context }) => {
    const [staff, admin] = await Promise.all([
      context.supabase.rpc("is_staff", { _user_id: context.userId }),
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    ]);
    if (staff.error || admin.error || !staff.data || !admin.data) {
      throw new Error("관리자만 Google 캘린더 일정을 수정할 수 있습니다.");
    }
    const { updateGoogleEvent, recordStatus } = await import("./server/gcal.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    try {
      await updateGoogleEvent(data);
    } catch {
      await recordStatus(supabaseAdmin, false, "Google 캘린더 일정 수정 실패").catch(() => {});
      throw new Error("Google 캘린더 일정을 수정하지 못했습니다. 연결과 수정 권한을 확인해 주세요.");
    }
    await recordStatus(supabaseAdmin, true).catch(() => {});
    return { calendar: true };
  });
