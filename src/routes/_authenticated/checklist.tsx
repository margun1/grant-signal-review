import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, Panel, StatusBadge, todayKst } from "@/components/app/ui";
import { AssigneeSelect } from "@/components/app/AssigneeSelect";
import { useStaff } from "@/hooks/use-staff";

export const Route = createFileRoute("/_authenticated/checklist")({
  head: () => ({ meta: [{ title: "체크리스트 · 주식회사 에너인프라의 경영비서" }, { name: "description", content: "반복 체크리스트와 할 일" }] }),
  component: ChecklistPage,
});
const DOW = ["일", "월", "화", "수", "목", "금", "토"];

function ChecklistPage() {
  const qc = useQueryClient(); const today = todayKst(); const { nameOf } = useStaff();
  useEffect(() => { supabase.rpc("generate_checklist", { _date: today }).then(() => qc.invalidateQueries({ queryKey: ["tasks"] })); }, [today, qc]);
  const [showDone, setShowDone] = useState(false);
  const tasks = useQuery({ queryKey: ["tasks", showDone], queryFn: async () => {
    let q = supabase.from("tasks").select("*").order("due_date", { ascending: true, nullsFirst: false }).order("created_at");
    if (!showDone) q = q.eq("done", false);
    return (await q.limit(300)).data ?? []; } });
  const tpls = useQuery({ queryKey: ["tpls"], queryFn: async () => (await supabase.from("checklist_templates").select("*").order("created_at")).data ?? [] });
  const [t, setT] = useState({ title: "", assignee: null as string | null, due: today });
  const add = useMutation({ mutationFn: async () => { if (!t.title.trim()) throw new Error("할 일을 입력해 주세요.");
    const { error } = await supabase.from("tasks").insert({ title: t.title.trim(), assignee: t.assignee, due_date: t.due || null }); if (error) throw new Error("추가하지 못했습니다."); },
    onSuccess: () => { setT({ ...t, title: "" }); qc.invalidateQueries({ queryKey: ["tasks"] }); }, onError: (e) => toast.error((e as Error).message) });
  const toggle = useMutation({ mutationFn: async (v: { id: string; done: boolean }) => { await supabase.from("tasks").update({ done: v.done, done_at: v.done ? new Date().toISOString() : null }).eq("id", v.id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }) });
  const setAssignee = useMutation({ mutationFn: async (v: { id: string; a: string | null }) => { await supabase.from("tasks").update({ assignee: v.a }).eq("id", v.id); }, onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }) });
  const [r, setR] = useState({ title: "", freq: "매일", wd: "1", assignee: null as string | null });
  const addTpl = useMutation({ mutationFn: async () => { if (!r.title.trim()) throw new Error("항목을 입력해 주세요.");
    const { error } = await supabase.from("checklist_templates").insert({ title: r.title.trim(), frequency: r.freq, weekday: r.freq === "매주" ? Number(r.wd) : null, assignee: r.assignee });
    if (error) throw new Error("추가하지 못했습니다."); await supabase.rpc("generate_checklist", { _date: today }); },
    onSuccess: () => { setR({ ...r, title: "" }); qc.invalidateQueries(); }, onError: (e) => toast.error((e as Error).message) });
  const toggleTpl = useMutation({ mutationFn: async (v: { id: string; active: boolean }) => { await supabase.from("checklist_templates").update({ active: v.active }).eq("id", v.id); }, onSuccess: () => qc.invalidateQueries({ queryKey: ["tpls"] }) });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="체크리스트" desc="반복 항목은 지정한 날 처음 화면을 열 때 한 번만 만들어집니다." />
      <Panel title="할 일" accent="primary" action={<label className="flex items-center gap-2 text-sm"><Checkbox checked={showDone} onCheckedChange={(v) => setShowDone(!!v)} />완료 항목도 보기</label>}>
        <form className="mb-4 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
          <div className="min-w-56 flex-1 space-y-1.5"><Label htmlFor="tt">할 일</Label><Input id="tt" value={t.title} onChange={(e) => setT({ ...t, title: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>담당자</Label><AssigneeSelect value={t.assignee} onChange={(a) => setT({ ...t, assignee: a })} /></div>
          <div className="space-y-1.5"><Label htmlFor="td">기한</Label><Input id="td" type="date" className="bg-card" value={t.due} onChange={(e) => setT({ ...t, due: e.target.value })} /></div>
          <Button type="submit">추가</Button>
        </form>
        <ul className="divide-y">{(tasks.data ?? []).map((x) => (
          <li key={x.id} className="flex flex-wrap items-center gap-3 py-2">
            <Checkbox aria-label={`${x.title} 완료`} checked={x.done} onCheckedChange={(v) => toggle.mutate({ id: x.id, done: !!v })} />
            <span className={`flex-1 ${x.done ? "text-muted-foreground line-through" : ""}`}>{x.title}{x.template_id && <span className="ml-2 text-xs text-muted-foreground">반복</span>}</span>
            {x.due_date && <StatusBadge label={x.due_date} tone={!x.done && x.due_date < today ? "bad" : x.due_date === today ? "warn" : "info"} />}
            <AssigneeSelect value={x.assignee} onChange={(a) => setAssignee.mutate({ id: x.id, a })} className="w-36 h-8" />
          </li>))}
          {(tasks.data ?? []).length === 0 && <li className="py-6 text-center text-muted-foreground">할 일이 없습니다.</li>}
        </ul>
      </Panel>
      <Panel title="반복 체크리스트 설정">
        <form className="mb-4 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); addTpl.mutate(); }}>
          <div className="min-w-56 flex-1 space-y-1.5"><Label htmlFor="rt">항목</Label><Input id="rt" value={r.title} onChange={(e) => setR({ ...r, title: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>주기</Label><Select value={r.freq} onValueChange={(v) => setR({ ...r, freq: v })}><SelectTrigger className="w-24 bg-card"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="매일">매일</SelectItem><SelectItem value="매주">매주</SelectItem></SelectContent></Select></div>
          {r.freq === "매주" && <div className="space-y-1.5"><Label>요일</Label><Select value={r.wd} onValueChange={(v) => setR({ ...r, wd: v })}><SelectTrigger className="w-20 bg-card"><SelectValue /></SelectTrigger><SelectContent>{DOW.map((d, i) => <SelectItem key={d} value={String(i)}>{d}</SelectItem>)}</SelectContent></Select></div>}
          <div className="space-y-1.5"><Label>담당자</Label><AssigneeSelect value={r.assignee} onChange={(a) => setR({ ...r, assignee: a })} /></div>
          <Button type="submit">반복 항목 추가</Button>
        </form>
        <ul className="divide-y text-sm">{(tpls.data ?? []).map((x) => (
          <li key={x.id} className="flex items-center gap-3 py-2"><span className="flex-1">{x.title}</span><span>{x.frequency}{x.frequency === "매주" && x.weekday !== null ? ` ${DOW[x.weekday]}요일` : ""}</span><span className="w-32 truncate">{nameOf(x.assignee)}</span>
            <Button size="sm" variant="outline" onClick={() => toggleTpl.mutate({ id: x.id, active: !x.active })}>{x.active ? "중지" : "다시 사용"}</Button></li>))}</ul>
      </Panel>
    </div>
  );
}
