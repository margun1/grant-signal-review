// 회사 구글 캘린더 (커넥터 게이트웨이 경유, 서버 전용)
const GATEWAY = "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supa = any;

function headers() {
  const a = process.env["LOVABLE_API_KEY"]; const c = process.env["GOOGLE_CALENDAR_API_KEY"];
  if (!a || !c) throw new Error("구글 캘린더가 연결되어 있지 않습니다.");
  return { Authorization: `Bearer ${a}`, "X-Connection-Api-Key": c, "Content-Type": "application/json" };
}
async function call(path: string, init?: RequestInit) {
  const r = await fetch(`${GATEWAY}${path}`, { ...init, headers: headers() });
  if (!r.ok) { const t = await r.text(); const e = new Error(`구글 캘린더 오류 [${r.status}]: ${t.slice(0, 300)}`) as Error & { status: number }; e.status = r.status; throw e; }
  if (r.status === 204) return null;
  return r.json();
}

export async function recordStatus(admin: Supa, ok: boolean, err?: string) {
  const now = new Date().toISOString();
  await admin.from("integration_status").upsert(ok ? { name: "google_calendar", last_success: now, updated_at: now } : { name: "google_calendar", last_error: err?.slice(0, 500) ?? "오류", last_error_at: now, updated_at: now });
}

export type GEvent = { id: string; title: string; start: string; end: string; allDay: boolean; fromApp: boolean };
export async function listEvents(timeMin: string, timeMax: string): Promise<GEvent[]> {
  const q = new URLSearchParams({ timeMin, timeMax, singleEvents: "true", orderBy: "startTime", maxResults: "250" });
  const d = await call(`/calendars/primary/events?${q}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (d.items ?? []).filter((e: any) => e.status !== "cancelled").map((e: any) => ({
    id: e.id, title: e.summary ?? "(제목 없음)", allDay: !!e.start?.date,
    start: e.start?.dateTime ?? `${e.start?.date}T00:00:00+09:00`, end: e.end?.dateTime ?? `${e.end?.date}T00:00:00+09:00`,
    fromApp: /^ei[0-9a-f]{32}$/.test(e.id ?? ""),
  }));
}
export async function busyTimes(timeMin: string, timeMax: string): Promise<{ start: string; end: string }[]> {
  const d = await call(`/freeBusy`, { method: "POST", body: JSON.stringify({ timeMin, timeMax, timeZone: "Asia/Seoul", items: [{ id: "primary" }] }) });
  return d.calendars?.primary?.busy ?? [];
}
/** 회의 id로 만든 고정 이벤트 id → 재시도해도 중복 일정이 생기지 않음 */
export const eventIdFor = (meetingId: string) => `ei${meetingId.replace(/-/g, "")}`;
export async function deleteGoogleEvent(id: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  try {
    await call(`/calendars/primary/events/${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status !== 404 && status !== 410) {
      await recordStatus(supabaseAdmin, false, "Google 캘린더 일정 삭제 실패").catch(() => {});
      throw error;
    }
  }
  await recordStatus(supabaseAdmin, true).catch(() => {});
}

export async function updateGoogleEvent(event: { id: string; title: string; start: string; end: string; allDay: boolean }) {
  const time = (value: string) => event.allDay ? { date: value } : { dateTime: value, timeZone: "Asia/Seoul" };
  await call(`/calendars/primary/events/${encodeURIComponent(event.id)}`, {
    method: "PATCH",
    body: JSON.stringify({ summary: event.title, start: time(event.start), end: time(event.end) }),
  });
}

export async function upsertMeetingEvent(m: { id: string; title?: string | null; start_at: string; end_at: string; name: string | null; org: string | null; topic: string | null; email: string | null }) {
  const id = eventIdFor(m.id);
  const body = { id, summary: `[미팅] ${m.title || m.org || m.name || "외부 미팅"}`, description: `${m.topic ?? ""}\n요청자: ${m.name ?? ""} ${m.email ?? ""}\n(경영비서에서 등록)`, start: { dateTime: m.start_at, timeZone: "Asia/Seoul" }, end: { dateTime: m.end_at, timeZone: "Asia/Seoul" } };
  try { await call(`/calendars/primary/events`, { method: "POST", body: JSON.stringify(body) }); }
  catch (e) { if ((e as { status?: number }).status === 409) { await call(`/calendars/primary/events/${id}`, { method: "PUT", body: JSON.stringify(body) }); } else throw e; }
  return id;
}
