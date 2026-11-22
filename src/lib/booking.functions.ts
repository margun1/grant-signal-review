import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { availableSlots, isValidSlot, overlaps } from "./booking";

function todayKst() { return new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10); }

// 공개: 예약 가능 시간만 돌려준다(사내 일정 내용은 내보내지 않음)
export const getOpenSlots = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("meetings").select("start_at,end_at").in("status", ["확인 대기", "확정"]).gte("end_at", new Date().toISOString());
  if (error) throw new Error("예약 가능 시간을 불러오지 못했습니다.");
  const busy = (data ?? []).map((m) => ({ start: m.start_at, end: m.end_at }));
  const { busyTimes, recordStatus } = await import("./server/gcal.server");
  try { busy.push(...(await busyTimes(new Date().toISOString(), new Date(Date.now() + 15 * 86400000).toISOString()))); await recordStatus(supabaseAdmin, true); }
  catch (e) { await recordStatus(supabaseAdmin, false, (e as Error).message); }
  return availableSlots(todayKst(), new Date(), busy);
});

const reqSchema = z.object({
  start: z.string().refine(isValidSlot, "예약할 수 없는 시간입니다."),
  name: z.string().trim().min(1).max(50), org: z.string().trim().max(100).optional().default(""),
  email: z.string().trim().email().max(200), phone: z.string().trim().max(30).optional().default(""),
  topic: z.string().trim().min(1).max(1000), website: z.string().max(0).optional().default(""),
});

export const requestMeeting = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => reqSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const end = new Date(new Date(data.start).getTime() + 3600000).toISOString();
    if (new Date(data.start) <= new Date()) throw new Error("지난 시간은 예약할 수 없습니다.");
    const { data: busy } = await supabaseAdmin.from("meetings").select("start_at,end_at").in("status", ["확인 대기", "확정"]).lt("start_at", end).gt("end_at", data.start);
    if ((busy ?? []).length) throw new Error("방금 다른 예약이 들어온 시간입니다. 다른 시간을 골라 주세요.");
    try { const { busyTimes } = await import("./server/gcal.server"); if ((await busyTimes(data.start, end)).length) throw new Error("BUSY"); }
    catch (e) { if ((e as Error).message === "BUSY") throw new Error("방금 다른 예약이 들어온 시간입니다. 다른 시간을 골라 주세요."); }
    const { error } = await supabaseAdmin.from("meetings").insert({ kind: "외부 미팅", name: data.name, org: data.org || null, email: data.email, phone: data.phone || null, topic: data.topic, start_at: data.start, end_at: end });
    if (error) throw new Error("예약 요청을 보내지 못했습니다.");
    return { ok: true };
  });

// 직원: 확정 직전에 시간 충돌을 다시 확인
export const confirmMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: m, error } = await sb.from("meetings").select("*").eq("id", data.id).single();
    if (error || !m) throw new Error("예약을 찾을 수 없습니다.");
    const { data: others } = await sb.from("meetings").select("id,start_at,end_at").eq("status", "확정").neq("id", m.id).lt("start_at", m.end_at).gt("end_at", m.start_at);
    if ((others ?? []).some((o) => overlaps(m.start_at, m.end_at, { start: o.start_at, end: o.end_at }))) throw new Error("같은 시간에 이미 확정된 일정이 있습니다.");
    const { listEvents } = await import("./server/gcal.server");
    let gcalChecked = true;
    try { const ev = await listEvents(m.start_at, m.end_at); if (ev.some((e) => !e.fromApp && !e.allDay)) throw new Error("GCAL_BUSY"); }
    catch (e) { if ((e as Error).message === "GCAL_BUSY") throw new Error("구글 캘린더에 같은 시간 일정이 있습니다."); gcalChecked = false; }
    const { error: e2 } = await sb.from("meetings").update({ status: "확정" }).eq("id", m.id);
    if (e2) throw new Error("확정하지 못했습니다.");
    const { pushMeeting } = await import("./server/meeting-sync.server");
    const r = await pushMeeting(sb, m.id);
    return { ok: true, calendar: r.ok, gcalChecked };
  });
