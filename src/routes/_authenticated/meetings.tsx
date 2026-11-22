import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, Panel, StatusBadge, todayKst } from "@/components/app/ui";
import { confirmMeeting } from "@/lib/booking.functions";

export const Route = createFileRoute("/_authenticated/meetings")({
  head: () => ({ meta: [{ title: "미팅·일정 · 주식회사 에너인프라의 경영비서" }, { name: "description", content: "외부 미팅 예약 확인과 내부 일정 달력" }] }),
  component: MeetingsPage,
});
const kt = (iso: string) => new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit" });
const kd = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600000).toISOString().slice(0, 10);

function MeetingsPage() {
  const qc = useQueryClient(); const confirmFn = useServerFn(confirmMeeting); const today = todayKst();
  const [month, setMonth] = useState(today.slice(0, 7));
  const reqs = useQuery({ queryKey: ["meet-req"], queryFn: async () => (await supabase.from("meetings").select("*").eq("kind", "외부 미팅").gte("end_at", new Date(Date.now() - 7 * 86400000).toISOString()).order("start_at")).data ?? [] });
  const monthStart = `${month}-01`; const next = new Date(`${monthStart}T00:00:00Z`); next.setUTCMonth(next.getUTCMonth() + 1); const monthEnd = next.toISOString().slice(0, 10);
  const cal = useQuery({ queryKey: ["cal", month], queryFn: async () => {
    const [{ data: m }, { data: a }] = await Promise.all([
      supabase.from("meetings").select("id,kind,title,name,org,start_at,status").neq("status", "취소").gte("start_at", new Date(`${monthStart}T00:00:00+09:00`).toISOString()).lt("start_at", new Date(`${monthEnd}T00:00:00+09:00`).toISOString()),
      supabase.from("announcements").select("id,title,deadline").gte("deadline", monthStart).lt("deadline", monthEnd).in("status", ["검토 중", "진행"])]);
    const ev = new Map<string, { label: string; tone: string }[]>();
    for (const x of m ?? []) { if (x.kind === "외부 미팅" && x.status !== "확정") continue; const d = kd(x.start_at); ev.set(d, [...(ev.get(d) ?? []), { label: `${kt(x.start_at).split(" ").slice(-2).join(" ")} ${x.kind === "외부 미팅" ? `미팅 ${x.org ?? x.name ?? ""}` : x.title ?? "내부 회의"}`, tone: x.kind === "외부 미팅" ? "bg-primary/15" : "bg-gold/15" }]); }
    for (const x of a ?? []) ev.set(x.deadline!, [...(ev.get(x.deadline!) ?? []), { label: `마감: ${x.title ?? "공고"}`, tone: "bg-destructive/10" }]);
    return ev; } });
  const confirm = useMutation({ mutationFn: (id: string) => confirmFn({ data: { id } }), onSuccess: () => { toast.success("확정했습니다. (구글 캘린더는 4단계에서 연결)"); qc.invalidateQueries(); }, onError: (e) => toast.error((e as Error).message) });
  const cancel = useMutation({ mutationFn: async (id: string) => { await supabase.from("meetings").update({ status: "취소" }).eq("id", id); }, onSuccess: () => qc.invalidateQueries() });
  const [im, setIm] = useState({ title: "", date: today, from: "10:00", to: "11:00" });
  const addInternal = useMutation({ mutationFn: async () => { if (!im.title.trim()) throw new Error("회의 제목을 입력해 주세요.");
    const s = new Date(`${im.date}T${im.from}:00+09:00`); const e = new Date(`${im.date}T${im.to}:00+09:00`); if (e <= s) throw new Error("끝나는 시간을 확인해 주세요.");
    const { error } = await supabase.from("meetings").insert({ kind: "내부 회의", title: im.title.trim(), start_at: s.toISOString(), end_at: e.toISOString(), status: "확정" }); if (error) throw new Error("추가하지 못했습니다."); },
    onSuccess: () => { setIm({ ...im, title: "" }); qc.invalidateQueries({ queryKey: ["cal"] }); }, onError: (e) => toast.error((e as Error).message) });

  const first = new Date(`${monthStart}T00:00:00Z`); const lead = first.getUTCDay(); const dim = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: dim }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  const shiftMonth = (n: number) => { const d = new Date(`${monthStart}T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + n); setMonth(d.toISOString().slice(0, 7)); };
  const bookUrl = typeof window !== "undefined" ? `${window.location.origin}/book` : "/book";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="미팅·일정" desc={`외부 예약 페이지: ${bookUrl}`} />
      <Panel title="외부 미팅 요청" accent="primary">
        <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-sm"><thead className="bg-secondary text-left"><tr><th className="p-2">일시</th><th className="p-2">요청자</th><th className="p-2">연락처</th><th className="p-2">내용</th><th className="p-2">상태</th><th className="p-2"></th></tr></thead>
          <tbody>{(reqs.data ?? []).map((m) => <tr key={m.id} className="border-t align-top"><td className="p-2 whitespace-nowrap">{kt(m.start_at)}</td><td className="p-2">{m.name}{m.org ? ` · ${m.org}` : ""}</td><td className="p-2">{m.email}<br />{m.phone}</td><td className="p-2">{m.topic}</td>
            <td className="p-2"><StatusBadge label={m.status} tone={m.status === "확정" ? "good" : m.status === "취소" ? "bad" : "warn"} />{m.calendar_status && <p className="mt-1 text-xs text-muted-foreground">{m.calendar_status}</p>}</td>
            <td className="space-x-1 whitespace-nowrap p-2 text-right">{m.status === "확인 대기" && <Button size="sm" onClick={() => confirm.mutate(m.id)}>확정</Button>}{m.status !== "취소" && <Button size="sm" variant="outline" onClick={() => cancel.mutate(m.id)}>취소</Button>}</td></tr>)}
            {(reqs.data ?? []).length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">예약 요청이 없습니다.</td></tr>}</tbody></table></div>
      </Panel>
      <Panel title="일정 달력" action={<div className="flex items-center gap-2"><Button size="icon" variant="outline" aria-label="이전 달" onClick={() => shiftMonth(-1)}><ChevronLeft className="size-4" /></Button><span className="font-bold">{month.replace("-", "년 ")}월</span><Button size="icon" variant="outline" aria-label="다음 달" onClick={() => shiftMonth(1)}><ChevronRight className="size-4" /></Button></div>}>
        <div className="mb-3 flex flex-wrap gap-3 text-xs"><span className="rounded bg-primary/15 px-2">확정 미팅</span><span className="rounded bg-gold/15 px-2">내부 회의</span><span className="rounded bg-destructive/10 px-2">지원사업 마감</span></div>
        <div className="overflow-x-auto"><div className="grid min-w-[700px] grid-cols-7 gap-px rounded-md border bg-border text-sm">
          {["일", "월", "화", "수", "목", "금", "토"].map((d) => <div key={d} className="bg-secondary p-1 text-center font-semibold">{d}</div>)}
          {cells.map((d, i) => <div key={i} className={`min-h-24 bg-card p-1 ${d === today ? "ring-2 ring-primary ring-inset" : ""}`}>{d && <><div className="text-xs font-semibold">{Number(d.slice(8))}</div>
            {(cal.data?.get(d) ?? []).map((e, j) => <div key={j} className={`mt-0.5 truncate rounded px-1 text-xs ${e.tone}`} title={e.label}>{e.label}</div>)}</>}</div>)}
        </div></div>
        <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); addInternal.mutate(); }}>
          <div className="min-w-48 flex-1 space-y-1.5"><Label htmlFor="it">내부 회의 추가</Label><Input id="it" placeholder="회의 제목" value={im.title} onChange={(e) => setIm({ ...im, title: e.target.value })} /></div>
          <Input aria-label="날짜" type="date" className="w-40 bg-card" value={im.date} onChange={(e) => setIm({ ...im, date: e.target.value })} />
          <Input aria-label="시작" type="time" className="w-28 bg-card" value={im.from} onChange={(e) => setIm({ ...im, from: e.target.value })} />
          <Input aria-label="종료" type="time" className="w-28 bg-card" value={im.to} onChange={(e) => setIm({ ...im, to: e.target.value })} />
          <Button type="submit">추가</Button>
        </form>
      </Panel>
    </div>
  );
}
