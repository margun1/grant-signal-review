import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Download, LogIn, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-auth";
import { useStaff } from "@/hooks/use-staff";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { PageHeader, Panel, StatusBadge, todayKst } from "@/components/app/ui";
import { RangePicker, exportXlsx, fetchAll, presetRange, type Range } from "@/components/app/data";

export const Route = createFileRoute("/_authenticated/attendance")({
  head: () => ({ meta: [{ title: "출·퇴근 관리 · 주식회사 에너인프라의 경영비서" }, { name: "description", content: "출근·퇴근 기록과 수정 요청" }] }),
  component: AttendancePage,
});

const t = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" }) : null;
function days(range: Range) {
  const dates: { date: string; weekend: boolean }[] = [];
  const day = new Date(`${range.start}T00:00:00Z`);
  const end = new Date(`${range.end}T00:00:00Z`);
  while (day <= end && dates.length < 400) {
    const weekday = day.getUTCDay();
    dates.push({ date: day.toISOString().slice(0, 10), weekend: weekday === 0 || weekday === 6 });
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return dates.reverse();
}
const toIso = (date: string, hm: string) => hm ? new Date(`${date}T${hm}:00+09:00`).toISOString() : null;

function AttendancePage() {
  const qc = useQueryClient(); const { me } = useMe(); const { list, nameOf } = useStaff(); const today = todayKst();
  const uid = me?.profile?.id; const isAdmin = !!me?.isAdmin;
  const [range, setRange] = useState<Range>(() => presetRange(7));
  const [draftRange, setDraftRange] = useState(range);
  const [view, setView] = useState<"date" | "employee">("date");
  const [employee, setEmployee] = useState("all");
  const recs = useQuery({
    queryKey: ["att", uid, range],
    enabled: !!uid,
    queryFn: () => fetchAll((from, to) => supabase.from("attendance").select("*")
      .gte("work_date", range.start).lte("work_date", range.end)
      .order("work_date").order("id").range(from, to)),
  });
  const { data: mine } = useQuery({
    queryKey: ["att", "today", uid, today],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase.from("attendance").select("check_in,check_out")
        .eq("user_id", uid!).eq("work_date", today).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  function searchAttendance() {
    if (!draftRange.start || !draftRange.end || draftRange.start > draftRange.end) {
      toast.error("시작일과 종료일을 올바르게 선택해 주세요.");
      return;
    }
    if (draftRange.start === range.start && draftRange.end === range.end) {
      void recs.refetch();
    } else {
      setRange(draftRange);
    }
  }

  const reqs = useQuery({ queryKey: ["att-req"], enabled: !!uid, queryFn: async () => (await supabase.from("attendance_requests").select("*").order("created_at", { ascending: false }).limit(100)).data ?? [] });
  const clock = useMutation({ mutationFn: async (k: "in" | "out") => { const { error } = await supabase.rpc("clock", { _kind: k }); if (error) throw new Error("기록하지 못했습니다."); },
    onSuccess: (_d, k) => { toast.success(k === "in" ? "출근을 기록했습니다." : "퇴근을 기록했습니다."); qc.invalidateQueries({ queryKey: ["att"] }); }, onError: (e) => toast.error((e as Error).message) });
  const [rq, setRq] = useState({ date: today, inT: "", outT: "", reason: "" });
  const request = useMutation({ mutationFn: async () => { if (!rq.reason.trim() || (!rq.inT && !rq.outT)) throw new Error("시간과 사유를 입력해 주세요.");
    const { error } = await supabase.from("attendance_requests").insert({ work_date: rq.date, req_check_in: toIso(rq.date, rq.inT), req_check_out: toIso(rq.date, rq.outT), reason: rq.reason.trim() });
    if (error) throw new Error("요청하지 못했습니다."); },
    onSuccess: () => { toast.success("수정 요청을 보냈습니다. 관리자 승인 후 반영됩니다."); setRq({ ...rq, reason: "" }); qc.invalidateQueries({ queryKey: ["att-req"] }); }, onError: (e) => toast.error((e as Error).message) });
  const review = useMutation({ mutationFn: async (v: { id: string; ok: boolean }) => { const { error } = await supabase.rpc("review_attendance_request", { _id: v.id, _approve: v.ok }); if (error) throw new Error("처리하지 못했습니다."); },
    onSuccess: () => qc.invalidateQueries(), onError: (e) => toast.error((e as Error).message) });

  const people = list.filter(({ id }) =>
    isAdmin ? view === "date" || employee === "all" || id === employee : id === uid,
  );
  const recordsByDayAndUser = new Map(
    (recs.data ?? []).map((record) => [`${record.work_date}:${record.user_id}`, record]),
  );
  const rows = days(range).flatMap(({ date, weekend }) => people.flatMap((person) => {
    const record = recordsByDayAndUser.get(`${date}:${person.id}`);
    if (weekend && !record?.check_in && !record?.check_out) return [];
    return [{ d: date, p: person, r: record }];
  }));
  if (isAdmin && view === "employee") {
    const employeeOrder = new Map(people.map(({ id }, index) => [id, index]));
    rows.sort((a, b) => (employeeOrder.get(a.p.id) ?? 0) - (employeeOrder.get(b.p.id) ?? 0));
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="출·퇴근 관리" desc="서버 시각으로 기록하고 한국 시간으로 표시합니다. 버튼을 여러 번 눌러도 처음 기록만 남습니다." />
      <Panel title={`오늘 (${today})`} accent="primary">
        <div className="grid gap-3 sm:grid-cols-2">
          <Button size="lg" className="h-16 text-lg" disabled={!!mine?.check_in || clock.isPending} onClick={() => clock.mutate("in")}><LogIn className="size-5" />출근 {t(mine?.check_in ?? null) ?? ""}</Button>
          <Button size="lg" variant="outline" className="h-16 text-lg" disabled={!!mine?.check_out || clock.isPending} onClick={() => clock.mutate("out")}><LogOut className="size-5" />퇴근 {t(mine?.check_out ?? null) ?? ""}</Button>
        </div>
      </Panel>
      <Panel title={isAdmin ? "직원별 출퇴근 현황" : "내 출퇴근 기록"} action={<Button size="sm" variant="outline" onClick={() => exportXlsx([{ name: "출퇴근", rows: rows.map(({ d, p, r }) => ({ 날짜: d, 직원: p.display_name || p.email, 출근: t(r?.check_in ?? null) ?? "미기록", 퇴근: t(r?.check_out ?? null) ?? "미기록" })) }], `출퇴근_${range.start}_${range.end}.xlsx`)}><Download className="size-4" />엑셀 내려받기</Button>}>
        <div className="flex flex-wrap items-end gap-2">
          <RangePicker value={isAdmin ? draftRange : range} onChange={isAdmin ? setDraftRange : setRange}
            presets={[[7, "최근 7일"], [30, "최근 30일"]]} />
          {isAdmin && (
            <>
              <Button type="button" size="sm" className="h-9" onClick={searchAttendance}
                disabled={recs.isFetching}>조회</Button>
              <div className="flex flex-wrap gap-2" role="group" aria-label="출퇴근 조회 방식">
                <Button type="button" size="sm" className="h-9" variant={view === "employee" ? "default" : "outline"}
                  aria-pressed={view === "employee"} onClick={() => setView("employee")}>직원별 조회</Button>
                <Button type="button" size="sm" className="h-9" variant={view === "date" ? "default" : "outline"}
                  aria-pressed={view === "date"} onClick={() => setView("date")}>날짜별 조회</Button>
              </div>
            </>
          )}
        </div>
        {isAdmin && view === "employee" && (
          <div className="mt-3">
            <Select value={employee} onValueChange={setEmployee}>
              <SelectTrigger aria-label="조회할 직원" className="w-full bg-card sm:w-64"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 직원</SelectItem>
                {list.map((person) => <SelectItem key={person.id} value={person.id}>{person.display_name || person.email}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        {recs.isError && <p role="alert" className="mt-3 text-sm text-destructive">출퇴근 기록을 불러오지 못했습니다.</p>}
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[480px] text-sm"><thead className="bg-secondary text-left"><tr><th className="p-2">날짜</th>{isAdmin && <th className="p-2">직원</th>}<th className="p-2">출근</th><th className="p-2">퇴근</th></tr></thead>
          <tbody>{recs.isSuccess && rows.map(({ d, p, r }) => <tr key={d + p.id} className="border-t"><td className="p-2">{d}</td>{isAdmin && <td className="p-2">{p.display_name || p.email}</td>}
            <td className="p-2">{t(r?.check_in ?? null) ?? <StatusBadge label="미기록" tone="warn" />}</td><td className="p-2">{t(r?.check_out ?? null) ?? <StatusBadge label="미기록" tone="warn" />}</td></tr>)}</tbody></table></div>
      </Panel>
      <Panel title="기록 수정 요청">
        <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); request.mutate(); }}>
          <div className="space-y-1.5"><Label htmlFor="rd">날짜</Label><Input id="rd" type="date" className="bg-card" value={rq.date} max={today} onChange={(e) => setRq({ ...rq, date: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="ri">출근 시각</Label><Input id="ri" type="time" className="bg-card" value={rq.inT} onChange={(e) => setRq({ ...rq, inT: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="ro">퇴근 시각</Label><Input id="ro" type="time" className="bg-card" value={rq.outT} onChange={(e) => setRq({ ...rq, outT: e.target.value })} /></div>
          <div className="min-w-48 flex-1 space-y-1.5"><Label htmlFor="rr">사유</Label><Input id="rr" value={rq.reason} onChange={(e) => setRq({ ...rq, reason: e.target.value })} /></div>
          <Button type="submit">요청</Button>
        </form>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[640px] text-sm"><thead className="bg-secondary text-left"><tr><th className="p-2">날짜</th><th className="p-2">직원</th><th className="p-2">요청</th><th className="p-2">변경 전</th><th className="p-2">사유</th><th className="p-2">상태</th><th className="p-2"></th></tr></thead>
          <tbody>{(reqs.data ?? []).map((q) => <tr key={q.id} className="border-t"><td className="p-2">{q.work_date}</td><td className="p-2">{nameOf(q.user_id)}</td>
            <td className="p-2">{t(q.req_check_in) ?? "-"} / {t(q.req_check_out) ?? "-"}</td><td className="p-2">{q.status === "대기" ? "-" : `${t(q.old_check_in) ?? "미기록"} / ${t(q.old_check_out) ?? "미기록"}`}</td>
            <td className="p-2">{q.reason}</td><td className="p-2"><StatusBadge label={q.status} tone={q.status === "승인" ? "good" : q.status === "반려" ? "bad" : "warn"} /></td>
            <td className="space-x-1 p-2 text-right">{isAdmin && q.status === "대기" && <><Button size="sm" onClick={() => review.mutate({ id: q.id, ok: true })}>승인</Button><Button size="sm" variant="outline" onClick={() => review.mutate({ id: q.id, ok: false })}>반려</Button></>}</td></tr>)}</tbody></table></div>
      </Panel>
    </div>
  );
}
