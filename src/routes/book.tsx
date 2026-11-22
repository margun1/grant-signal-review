import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getOpenSlots, requestMeeting } from "@/lib/booking.functions";

export const Route = createFileRoute("/book")({
  head: () => ({ meta: [
    { title: "미팅 예약 · 주식회사 에너인프라" }, { name: "description", content: "주식회사 에너인프라와의 미팅 시간을 골라 예약을 요청하세요." },
    { property: "og:title", content: "미팅 예약 · 주식회사 에너인프라" }, { property: "og:description", content: "가능한 시간을 골라 미팅을 요청하세요." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: BookPage,
});
const dayLabel = (d: string) => new Date(`${d}T12:00:00+09:00`).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "short" });
const hm = (iso: string) => new Date(iso).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" });

function BookPage() {
  const slotsFn = useServerFn(getOpenSlots); const reqFn = useServerFn(requestMeeting); const qc = useQueryClient();
  const slots = useQuery({ queryKey: ["open-slots"], queryFn: () => slotsFn() });
  const [pick, setPick] = useState<string | null>(null);
  const [f, setF] = useState({ name: "", org: "", email: "", phone: "", topic: "", website: "" });
  const send = useMutation({ mutationFn: () => reqFn({ data: { ...f, start: pick! } }), onError: () => { qc.invalidateQueries({ queryKey: ["open-slots"] }); } });
  if (send.isSuccess) return (
    <main className="mx-auto max-w-lg p-6 py-16 text-center"><CalendarCheck className="mx-auto size-12 text-primary" aria-hidden /><h1 className="mt-4 text-2xl font-bold">예약 요청을 받았습니다</h1>
      <p className="mt-2 text-muted-foreground">{pick && `${dayLabel(new Date(new Date(pick).getTime() + 9 * 3600000).toISOString().slice(0, 10))} ${hm(pick)}`} · 담당자가 확인 후 이메일로 연락드립니다.</p></main>);
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 py-10">
      <header><p className="text-sm font-semibold text-primary">주식회사 에너인프라</p><h1 className="text-2xl font-bold">미팅 예약</h1><p className="mt-1 text-sm text-muted-foreground">평일 10:00~18:00 (점심 12:00~13:00 제외), 1시간 단위 · 한국 시간</p></header>
      <section className="rounded-lg border bg-card p-4"><h2 className="mb-3 font-bold">1. 시간 선택</h2>
        {slots.isLoading ? <p className="text-muted-foreground">불러오는 중…</p> : slots.isError ? <p className="text-destructive">예약 가능 시간을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p> :
          <div className="space-y-3">{(slots.data ?? []).map((d) => <div key={d.date}><p className="mb-1 text-sm font-semibold">{dayLabel(d.date)}</p>
            {d.slots.length === 0 ? <p className="text-xs text-muted-foreground">가능한 시간 없음</p> : <div className="flex flex-wrap gap-2">{d.slots.map((s) => <Button key={s} type="button" size="sm" className="min-w-20" variant={pick === s ? "default" : "outline"} onClick={() => setPick(s)} aria-pressed={pick === s}>{hm(s)}</Button>)}</div>}</div>)}</div>}
      </section>
      <form className="space-y-3 rounded-lg border bg-card p-4" onSubmit={(e) => { e.preventDefault(); send.mutate(); }}>
        <h2 className="font-bold">2. 연락처와 내용</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor="n">이름</Label><Input id="n" required maxLength={50} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="o">회사·기관 (선택)</Label><Input id="o" maxLength={100} value={f.org} onChange={(e) => setF({ ...f, org: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="e">이메일</Label><Input id="e" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="p">전화 (선택)</Label><Input id="p" maxLength={30} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
        </div>
        <div className="space-y-1.5"><Label htmlFor="t">미팅 내용</Label><Textarea id="t" required maxLength={1000} value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} /></div>
        <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} />
        {send.isError && <p className="text-sm text-destructive">{(send.error as Error).message.includes("다른 예약") ? "방금 다른 예약이 들어온 시간입니다. 다른 시간을 골라 주세요." : "요청을 보내지 못했습니다. 입력 내용을 확인해 주세요."}</p>}
        <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={!pick || send.isPending}>{pick ? `${hm(pick)} 예약 요청` : "시간을 먼저 선택하세요"}</Button>
      </form>
    </main>
  );
}
