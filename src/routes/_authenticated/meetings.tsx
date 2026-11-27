import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useMe } from "@/hooks/use-auth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { PageHeader, Panel, StatusBadge, todayKst } from "@/components/app/ui";
import { kstWeekRange } from "@/lib/secretary";
import { confirmMeeting } from "@/lib/booking.functions";
import { addGoogleCalendarEvent, deleteCalendarEvent, getGoogleEvents, syncMeetingToCalendar, updateCalendarMeeting, updateGoogleCalendarEvent } from "@/lib/calendar.functions";

export const Route = createFileRoute("/_authenticated/meetings")({
  head: () => ({ meta: [{ title: "미팅·일정 · 주식회사 에너인프라의 경영비서" }, { name: "description", content: "외부 미팅 예약 확인과 내부 일정 달력" }] }),
  component: MeetingsPage,
});
const kt = (iso: string) => new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" });
const kd = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600000).toISOString().slice(0, 10);

function localTime(iso: string) {
  return new Date(Date.parse(iso) + 9 * 3600000).toISOString().slice(0, 19);
}

function shiftDate(day: string, days: number) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

type CalendarEdit = {
  source: "meeting" | "google";
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
};

const scheduleTypes = {
  confirmed: { label: "확정 미팅", tone: "bg-lime-200 text-lime-950" },
  internal: { label: "내부 회의", tone: "bg-yellow-200 text-yellow-950" },
  deadline: { label: "지원사업 마감", tone: "bg-pink-200 text-pink-950" },
  google: { label: "구글 캘린더", tone: "bg-sky-200 text-sky-950" },
};
type ScheduleType = keyof typeof scheduleTypes;
const weeklySections = [
  ["internal", "이번주 내부회의일정"],
  ["confirmed", "이번주 확정미팅일정"],
  ["deadline", "이번주 지원사업마감일정"],
  ["google", "이번주 구글캘린더 일정"],
] as const;

const calendarTypes = Object.keys(scheduleTypes) as ScheduleType[];
const scheduleEmojis = [
  ["🤝", "미팅"],
  ["📋", "업무"],
  ["📌", "중요"],
  ["⏰", "마감"],
  ["📞", "전화"],
  ["💻", "화상회의"],
  ["🚗", "이동"],
  ["🏫", "교육"],
  ["🎉", "행사"],
  ["☕", "휴식"],
] as const;
type CalendarEditDraft = CalendarEdit & { emoji: string };

function formatScheduleTitle(value: string, emoji: string) {
  const text = value.trim();
  if (!text) throw new Error("일정 제목을 입력해 주세요.");
  const title = emoji === "none" ? text : `${emoji} ${text}`;
  if (title.length > 250) throw new Error("이모티콘을 포함한 일정 제목은 250자 이하여야 합니다.");
  return title;
}

function ScheduleEmojiSelect({ id, value, onChange, disabled }: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>이모티콘</Label>
      <Select value={value} disabled={disabled} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-32 bg-card"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="none">없음</SelectItem>
          {scheduleEmojis.map(([emoji, label]) => (
            <SelectItem key={emoji} value={emoji}>{emoji} {label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

type CalendarEntry = { label: string; type: ScheduleType; edit?: CalendarEdit | undefined };

function MeetingsPage() {
  const qc = useQueryClient(); const confirmFn = useServerFn(confirmMeeting); const gFn = useServerFn(getGoogleEvents); const syncFn = useServerFn(syncMeetingToCalendar); const today = todayKst();
  const [month, setMonth] = useState(today.slice(0, 7));
  const { me } = useMe();
  const [editing, setEditing] = useState<CalendarEditDraft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteEvent = useServerFn(deleteCalendarEvent);
  const refreshCalendar = () => Promise.all([
    qc.invalidateQueries({ queryKey: ["cal"] }),
    qc.invalidateQueries({ queryKey: ["meet-req"] }),
    qc.invalidateQueries({ queryKey: ["briefing-google-calendar"] }),
  ]);
  const remove = useMutation({
    mutationFn: (edit: CalendarEdit) => deleteEvent({ data: { source: edit.source, id: edit.id } }),
    onSuccess: () => {
      setEditing(null);
      toast.success("일정을 삭제했습니다.");
      void refreshCalendar();
    },
  });
  const updateMeeting = useServerFn(updateCalendarMeeting);
  const updateGoogle = useServerFn(updateGoogleCalendarEvent);
  const update = useMutation({
    mutationFn: (edit: CalendarEditDraft) => {
      const start = edit.allDay ? edit.start : new Date(`${edit.start}+09:00`).toISOString();
      const end = edit.allDay ? shiftDate(edit.end, 1) : new Date(`${edit.end}+09:00`).toISOString();
      const title = formatScheduleTitle(edit.title, edit.emoji);
      if (Date.parse(end) <= Date.parse(start)) throw new Error("종료 시간을 확인해 주세요.");
      const data = { id: edit.id, title, start, end };
      if (edit.source === "meeting") return updateMeeting({ data });
      return edit.allDay
        ? updateGoogle({ data: { ...data, allDay: true } })
        : updateGoogle({ data: { ...data, allDay: false } });
    },
    onSuccess: (result, edit) => {
      setEditing(null);
      setMonth(edit.start.slice(0, 7));
      if (result.calendar === false) {
        toast.warning("일정을 저장했습니다. 미팅 표에서 Google 캘린더 등록을 다시 시도해 주세요.");
      } else {
        toast.success("일정을 수정했습니다.");
      }
      void refreshCalendar();
    },
  });
  const saving = update.isPending || remove.isPending;
  const openEditor = (event: CalendarEdit) => {
    setConfirmDelete(false);
    remove.reset();
    update.reset();
    const existingEmoji = scheduleEmojis.find(([emoji]) => event.title.startsWith(`${emoji} `))?.[0];
    setEditing({
      ...event,
      title: existingEmoji ? event.title.slice(existingEmoji.length + 1) : event.title,
      emoji: existingEmoji ?? "none",
    });
  };
  const reqs = useQuery({ queryKey: ["meet-req"], queryFn: async () => (await supabase.from("meetings").select("*").eq("kind", "외부 미팅").gte("end_at", new Date(Date.now() - 7 * 86400000).toISOString()).order("start_at")).data ?? [] });
  const monthStart = `${month}-01`; const next = new Date(`${monthStart}T00:00:00Z`); next.setUTCMonth(next.getUTCMonth() + 1); const monthEnd = next.toISOString().slice(0, 10);
  async function loadCalendar(start: string, end: string) {
    const from = new Date(`${start}T00:00:00+09:00`).toISOString();
    const to = new Date(`${end}T00:00:00+09:00`).toISOString();
    const [google, meetings, announcements] = await Promise.all([
      gFn({ data: { from, to } }).catch(() => ({ ok: false as const, events: [] })),
      supabase.from("meetings").select("id,kind,title,name,org,start_at,end_at,status")
        .neq("status", "취소").gte("start_at", from).lt("start_at", to).order("start_at"),
      supabase.from("announcements").select("id,title,deadline")
        .gte("deadline", start).lt("deadline", end).in("status", ["검토 중", "진행"]),
    ]);
    const ev = new Map<string, CalendarEntry[]>();
    const add = (day: string, entry: CalendarEntry) => {
      const entries = ev.get(day) ?? [];
      entries.push(entry);
      ev.set(day, entries);
    };
    for (const x of meetings.data ?? []) {
      if (x.kind === "외부 미팅" && x.status !== "확정") continue;
      const title = x.title || (x.kind === "외부 미팅" ? x.org || x.name || "외부 미팅" : "내부 회의");
      add(kd(x.start_at), {
        label: `${localTime(x.start_at).slice(11, 16)} ${title}`,
        type: x.kind === "외부 미팅" ? "confirmed" : "internal",
        edit: x.status === "확정" ? {
          source: "meeting", id: x.id, title, allDay: false,
          start: localTime(x.start_at), end: localTime(x.end_at),
        } : undefined,
      });
    }
    for (const x of announcements.data ?? []) {
      add(x.deadline!, { label: x.title ?? "공고", type: "deadline" });
    }
    for (const x of google.events) {
      if (!Number.isFinite(Date.parse(x.start)) || !Number.isFinite(Date.parse(x.end))) continue;
      add(kd(x.start), {
        label: `${x.allDay ? "" : localTime(x.start).slice(11, 16) + " "}${x.title}`,
        type: "google",
        edit: {
          source: "google", id: x.id, title: x.title, allDay: x.allDay,
          start: x.allDay ? kd(x.start) : localTime(x.start),
          end: x.allDay ? shiftDate(kd(x.end), -1) : localTime(x.end),
        },
      });
    }
    return {
      ev,
      gOk: google.ok,
      meetingsOk: !meetings.error,
      deadlinesOk: !announcements.error,
    };
  }

  const cal = useQuery({ queryKey: ["cal", month], queryFn: () => loadCalendar(monthStart, monthEnd) });
  const weekRange = kstWeekRange(today);
  const weekStart = kd(weekRange.from);
  const weekEnd = kd(weekRange.to);
  const monthCoversWeek = monthStart <= weekStart && monthEnd >= weekEnd;
  const weekly = useQuery({
    queryKey: ["cal", "week", weekStart],
    queryFn: () => loadCalendar(weekStart, weekEnd),
    enabled: !monthCoversWeek,
  });
  const week = monthCoversWeek ? cal : weekly;
  const weekEntries = [...(week.data?.ev.entries() ?? [])]
    .filter(([day]) => day >= weekStart && day < weekEnd)
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([day, entries]) => entries.map((entry) => ({ day, ...entry })));

  const confirm = useMutation({ mutationFn: (id: string) => confirmFn({ data: { id } }), onSuccess: (r) => { if (r.calendar) toast.success("확정하고 구글 캘린더에 등록했습니다."); else toast.warning("확정했지만 구글 캘린더 등록에 실패했습니다. 표에서 다시 시도해 주세요."); qc.invalidateQueries(); }, onError: (e) => toast.error((e as Error).message) });
  const retry = useMutation({ mutationFn: (id: string) => syncFn({ data: { id } }), onSuccess: (r) => { r.ok ? toast.success("구글 캘린더에 등록했습니다.") : toast.error(r.error ?? "등록하지 못했습니다."); qc.invalidateQueries(); } });
  const cancel = useMutation({ mutationFn: async (id: string) => { await supabase.from("meetings").update({ status: "취소" }).eq("id", id); }, onSuccess: () => qc.invalidateQueries() });
  const [draft, setDraft] = useState({ type: "internal" as ScheduleType, title: "", emoji: "none", date: today, from: "10:00", to: "11:00", url: "" });
  const createGoogle = useServerFn(addGoogleCalendarEvent);
  const addSchedule = useMutation({
    mutationFn: async (schedule: typeof draft) => {
      const title = formatScheduleTitle(schedule.title, schedule.emoji);
      if (schedule.type === "deadline") {
        let url = schedule.url.trim();
        if (url) {
          if (!URL.canParse(url)) throw new Error("공고 원문 주소를 확인해 주세요.");
          const parsed = new URL(url);
          if (!["https:", "http:"].includes(parsed.protocol)) {
            throw new Error("공고 원문 주소를 확인해 주세요.");
          }
          url = parsed.href;
        }
        const { error } = await supabase.from("announcements").insert({
          title, url, deadline: schedule.date,
        });
        if (error) throw new Error("지원사업 마감을 추가하지 못했습니다.");
        return;
      }

      const start = new Date(`${schedule.date}T${schedule.from}:00+09:00`).toISOString();
      const end = new Date(`${schedule.date}T${schedule.to}:00+09:00`).toISOString();
      if (end <= start) throw new Error("종료 시간이 시작보다 늦어야 합니다.");
      if (schedule.type === "google") {
        await createGoogle({ data: { title, start, end } });
        return;
      }
      const { error } = await supabase.from("meetings").insert({
        kind: schedule.type === "confirmed" ? "외부 미팅" : "내부 회의",
        title,
        start_at: start,
        end_at: end,
        status: "확정",
      });
      if (error) throw new Error("미팅을 추가하지 못했습니다.");
    },
    onSuccess: (_, schedule) => {
      setMonth(schedule.date.slice(0, 7));
      setDraft((current) => ({ ...current, title: "", emoji: "none", url: "" }));
      void refreshCalendar();
      toast.success("일정을 추가했습니다.");
    },
    onError: (error) => toast.error(error.message),
  });

  const first = new Date(`${monthStart}T00:00:00Z`); const lead = first.getUTCDay(); const dim = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: dim }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  const shiftMonth = (n: number) => { const d = new Date(`${monthStart}T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + n); setMonth(d.toISOString().slice(0, 7)); };
  const bookUrl = typeof window !== "undefined" ? `${window.location.origin}/book` : "/book";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="미팅·일정" desc={`외부 예약 페이지: ${bookUrl}`} />
      <Panel title="외부 미팅 요청" accent="primary">
        <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-sm"><thead className="bg-secondary text-left"><tr><th className="p-2">일시</th><th className="p-2">요청자</th><th className="p-2">연락처</th><th className="p-2">내용</th><th className="p-2">상태</th><th className="p-2"></th></tr></thead>
          <tbody>{(reqs.data ?? []).map((m) => <tr key={m.id} className="border-t align-top"><td className="p-2 whitespace-nowrap">{kt(m.start_at)}</td><td className="p-2">{m.name ?? m.title}{m.org ? ` · ${m.org}` : ""}</td><td className="p-2">{m.email}<br />{m.phone}</td><td className="p-2">{m.topic}</td>
            <td className="p-2"><StatusBadge label={m.status} tone={m.status === "확정" ? "good" : m.status === "취소" ? "bad" : "warn"} />{m.calendar_status && <p className="mt-1 text-xs text-muted-foreground">{m.calendar_status}</p>}{m.status === "확정" && m.calendar_status !== "구글 캘린더 등록 완료" && <Button size="sm" variant="outline" className="mt-1" onClick={() => retry.mutate(m.id)}>캘린더 다시 등록</Button>}</td>
            <td className="space-x-1 whitespace-nowrap p-2 text-right">{m.status === "확인 대기" && <Button size="sm" onClick={() => confirm.mutate(m.id)}>확정</Button>}{m.status !== "취소" && <Button size="sm" variant="outline" onClick={() => cancel.mutate(m.id)}>취소</Button>}</td></tr>)}
            {(reqs.data ?? []).length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">예약 요청이 없습니다.</td></tr>}</tbody></table></div>
      </Panel>
      <Panel title="일정 달력" action={<div className="flex items-center gap-2"><Button size="icon" variant="outline" aria-label="이전 달" onClick={() => shiftMonth(-1)}><ChevronLeft className="size-4" /></Button><span className="font-bold">{month.replace("-", "년 ")}월</span><Button size="icon" variant="outline" aria-label="다음 달" onClick={() => shiftMonth(1)}><ChevronRight className="size-4" /></Button></div>}>
        {cal.data && !cal.data.gOk && (
          <p className="mb-3 text-xs text-destructive">구글 캘린더를 불러오지 못했습니다.</p>
        )}
        <div className="overflow-x-auto"><div className="grid min-w-[700px] grid-cols-7 gap-px rounded-md border bg-border text-sm">
          {["일", "월", "화", "수", "목", "금", "토"].map((d) => <div key={d} className="bg-secondary p-1 text-center font-semibold">{d}</div>)}
          {cells.map((d, i) => <div key={i} className={`min-h-24 bg-card p-1 ${d === today ? "ring-2 ring-primary ring-inset" : ""}`}>{d && <><div className="text-xs font-semibold">{Number(d.slice(8))}</div>
            {(cal.data?.ev.get(d) ?? []).map((entry, index) => {
              const edit = entry.edit;
              const className = `mt-0.5 block w-full truncate rounded px-1 text-left text-xs ${scheduleTypes[entry.type].tone}`;
              return edit && (edit.source === "meeting" || me?.isAdmin) ? (
                <button
                  key={index}
                  type="button"
                  className={`${className} hover:underline focus-visible:ring-2 focus-visible:ring-ring`}
                  aria-label={`${scheduleTypes[entry.type].label} · ${entry.label} 수정`}
                  title={entry.label}
                  onClick={() => openEditor(edit)}
                >
                  {entry.label}
                </button>
              ) : <div key={index} className={className} title={entry.label}><span className="sr-only">{scheduleTypes[entry.type].label} · </span>{entry.label}</div>;
            })}</>}</div>)}
        </div></div>
        <form className="mt-4 space-y-3" onSubmit={(event) => {
          event.preventDefault();
          if (!addSchedule.isPending) addSchedule.mutate(draft);
        }}>
          <div className="max-w-sm space-y-2">
            <Label htmlFor="schedule-type">달력에 표시할 일정</Label>
            <Select value={draft.type} onValueChange={(type: ScheduleType) => setDraft({ ...draft, type })} disabled={addSchedule.isPending}>
              <SelectTrigger id="schedule-type" className="w-full rounded-xl bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {calendarTypes.map((type) => (
                  <SelectItem key={type} value={type} disabled={type === "google" && !me?.isAdmin}>
                    <span className="inline-flex items-center gap-2">
                      <span aria-hidden className={`size-3 rounded-sm border ${scheduleTypes[type].tone}`} />
                      {scheduleTypes[type].label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ul aria-label="일정 유형별 색상" className="flex flex-wrap gap-2">
            {calendarTypes.map((type) => (
              <li key={type} className={`rounded-md px-2.5 py-1 text-xs font-medium ${scheduleTypes[type].tone}`}>
                {scheduleTypes[type].label}
              </li>
            ))}
          </ul>
          <fieldset disabled={addSchedule.isPending} className="flex flex-wrap items-end gap-3">
            <ScheduleEmojiSelect id="schedule-emoji" value={draft.emoji} disabled={addSchedule.isPending}
              onChange={(emoji) => setDraft({ ...draft, emoji })} />
            <div className="min-w-48 flex-1 space-y-2">
              <Label htmlFor="schedule-title">일정 제목</Label>
              <Input id="schedule-title" required maxLength={250} value={draft.title}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="schedule-date">{draft.type === "deadline" ? "마감일" : "날짜"}</Label>
              <Input id="schedule-date" type="date" required className="w-40 bg-card" value={draft.date}
                onChange={(event) => setDraft({ ...draft, date: event.target.value })} />
            </div>
            {draft.type === "deadline" ? (
              <div className="min-w-48 flex-1 space-y-2">
                <Label htmlFor="schedule-url">공고 원문 URL (선택)</Label>
                <Input id="schedule-url" type="url" value={draft.url}
                  onChange={(event) => setDraft({ ...draft, url: event.target.value })} />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="schedule-start">시작</Label>
                  <Input id="schedule-start" type="time" required className="w-28 bg-card" value={draft.from}
                    onChange={(event) => setDraft({ ...draft, from: event.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="schedule-end">종료</Label>
                  <Input id="schedule-end" type="time" required className="w-28 bg-card" value={draft.to}
                    onChange={(event) => setDraft({ ...draft, to: event.target.value })} />
                </div>
              </>
            )}
            <Button type="submit">{addSchedule.isPending ? "추가 중…" : "추가"}</Button>
          </fieldset>
        </form>
      </Panel>
      <Panel title="이번주 일정" accent="gold">
        <p className="mb-4 text-sm text-muted-foreground">
          {weekStart} ~ {shiftDate(weekEnd, -1)} · 한국 시간
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {weeklySections.map(([type, title]) => {
            const entries = weekEntries.filter((entry) => entry.type === type);
            const available = type === "google" ? week.data?.gOk
              : type === "deadline" ? week.data?.deadlinesOk : week.data?.meetingsOk;
            return (
              <section key={type} className="min-w-0 rounded-lg border p-4">
                <h3 className={`rounded-md px-3 py-2 text-sm font-semibold ${scheduleTypes[type].tone}`}>
                  {title}
                </h3>
                {week.isPending ? (
                  <p className="mt-3 text-sm text-muted-foreground">일정을 불러오는 중…</p>
                ) : !available ? (
                  <p className="mt-3 text-sm text-destructive">일정을 불러오지 못했습니다.</p>
                ) : entries.length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">등록된 일정이 없습니다.</p>
                ) : (
                  <ul className="mt-2 divide-y text-sm">
                    {entries.map((entry, index) => (
                      <li key={index} className="flex flex-wrap gap-x-3 gap-y-1 py-2">
                        <time dateTime={entry.day} className="shrink-0 text-muted-foreground">
                          {entry.day.slice(5).replace("-", "/")}
                        </time>
                        <span className="min-w-0 wrap-break-word">{entry.label}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      </Panel>
      <Dialog open={editing !== null} onOpenChange={(open) => {
        if (!open && !saving) setEditing(null);
      }}>
        {editing && (
          <DialogContent>
            <DialogTitle>일정 수정</DialogTitle>
            <DialogDescription>
              {editing.source === "google" ? "Google 캘린더 일정" : "등록된 미팅"} · 한국 시간
            </DialogDescription>
            <form className="space-y-4" onSubmit={(event) => {
              event.preventDefault();
              if (!confirmDelete && !saving) update.mutate(editing);
            }}>
              <ScheduleEmojiSelect id="edit-calendar-emoji" value={editing.emoji}
                disabled={saving || confirmDelete} onChange={(emoji) => setEditing({ ...editing, emoji })} />
              <div className="space-y-2">
                <Label htmlFor="edit-calendar-title">제목</Label>
                <Input id="edit-calendar-title" required maxLength={250} value={editing.title}
                  onChange={(event) => setEditing({ ...editing, title: event.target.value })} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-calendar-start">{editing.allDay ? "시작일" : "시작 시간"}</Label>
                  <Input id="edit-calendar-start" type={editing.allDay ? "date" : "datetime-local"}
                    step={editing.allDay ? undefined : 1} required value={editing.start}
                    onChange={(event) => setEditing({ ...editing, start: event.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-calendar-end">{editing.allDay ? "마지막 날" : "종료 시간"}</Label>
                  <Input id="edit-calendar-end" type={editing.allDay ? "date" : "datetime-local"}
                    step={editing.allDay ? undefined : 1} required value={editing.end}
                    onChange={(event) => setEditing({ ...editing, end: event.target.value })} />
                </div>
              </div>
              {(confirmDelete ? remove.error : update.error) && (
                <p role="alert" className="text-sm text-destructive">
                  {(confirmDelete ? remove.error : update.error)?.message}
                </p>
              )}
              {confirmDelete ? (
                <div className="space-y-2">
                  <p role="status" className="text-sm">이 일정을 삭제할까요?</p>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" disabled={saving}
                      onClick={() => setConfirmDelete(false)}>돌아가기</Button>
                    <Button type="button" variant="destructive" disabled={saving}
                      onClick={() => remove.mutate(editing)}>
                      {remove.isPending ? "삭제 중…" : "삭제 확인"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="destructive" className="mr-auto" disabled={saving}
                    onClick={() => { remove.reset(); setConfirmDelete(true); }}>삭제</Button>
                  <Button type="button" variant="outline" disabled={saving} onClick={() => setEditing(null)}>취소</Button>
                  <Button type="submit" disabled={saving}>{update.isPending ? "저장 중…" : "저장"}</Button>
                </div>
              )}
            </form>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
