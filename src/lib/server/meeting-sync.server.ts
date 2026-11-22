import { upsertMeetingEvent, recordStatus } from "./gcal.server";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supa = any;
export async function pushMeeting(sb: Supa, id: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: m } = await sb.from("meetings").select("*").eq("id", id).single();
  if (!m || m.status !== "확정") return { ok: false, error: "확정된 미팅만 등록할 수 있습니다." };
  try {
    const ev = await upsertMeetingEvent(m);
    await sb.from("meetings").update({ calendar_event_id: ev, calendar_status: "구글 캘린더 등록 완료" }).eq("id", id);
    await recordStatus(supabaseAdmin, true);
    return { ok: true };
  } catch (e) {
    const msg = (e as Error).message;
    await sb.from("meetings").update({ calendar_status: "구글 캘린더 등록 실패 — 재시도 필요" }).eq("id", id);
    await recordStatus(supabaseAdmin, false, msg);
    return { ok: false, error: msg };
  }
}
