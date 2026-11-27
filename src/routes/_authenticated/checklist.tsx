import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, Panel, todayKst } from "@/components/app/ui";
import { AssigneeSelect } from "@/components/app/AssigneeSelect";
import { useStaff } from "@/hooks/use-staff";
import { correctChecklistTitle, correctStoredChecklistTitles, registerCompanyChecklist } from "@/lib/company-checklist";

export const Route = createFileRoute("/_authenticated/checklist")({
  head: () => ({ meta: [{ title: "체크리스트 · 주식회사 에너인프라의 경영비서" }, { name: "description", content: "반복 체크리스트와 할 일" }] }),
  component: ChecklistPage,
});
const DOW = ["일", "월", "화", "수", "목", "금", "토"];

const frequencies = ["매일", "매주", "매월"] as const;
type Frequency = (typeof frequencies)[number] | "한 번";

function ScheduleButtons({ value, weekday, once, onChange, onWeekdayChange }: {
  value: Frequency;
  weekday: string;
  once?: boolean;
  onChange: (value: Frequency) => void;
  onWeekdayChange: (value: string) => void;
}) {
  const options = once ? ["한 번" as const, ...frequencies] : frequencies;
  return (
    <fieldset className="w-full space-y-2">
      <legend className="text-sm font-medium">주기</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Button key={option} type="button" size="sm" variant={value === option ? "default" : "outline"}
            aria-pressed={value === option} onClick={() => onChange(option)}>{option}</Button>
        ))}
      </div>
      {value === "매주" && (
        <Select value={weekday} onValueChange={onWeekdayChange}>
          <SelectTrigger aria-label="반복 요일" className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>{DOW.map((day, index) => <SelectItem key={day} value={String(index)}>{day}요일</SelectItem>)}</SelectContent>
        </Select>
      )}
      {value === "매월" && <p className="text-sm text-muted-foreground">등록한 날짜와 같은 일에 반복됩니다. 해당 일이 없는 달은 말일에 생성됩니다.</p>}
    </fieldset>
  );
}

async function addRecurring(title: string, assignee: string | null, frequency: Frequency, weekday: string, today: string) {
  const { error } = await supabase.from("checklist_templates").insert({
    title: correctChecklistTitle(title), assignee, frequency, weekday: frequency === "매주" ? Number(weekday) : null,
  });
  if (error) {
    if (frequency === "매월" && error.code === "23514") {
      throw new Error("매월 반복을 저장하려면 Lovable에서 월간 반복을 활성화해야 합니다.");
    }
    throw new Error("반복 항목을 추가하지 못했습니다.");
  }
  const { error: generationError } = await supabase.rpc("generate_checklist", { _date: today });
  if (generationError) toast.error("반복 설정은 저장됐지만 오늘 할 일을 생성하지 못했습니다.");
}

function ChecklistPage() {
  const qc = useQueryClient(); const today = todayKst(); const { nameOf } = useStaff();
  useEffect(() => {
    async function prepareChecklist() {
      try {
        await registerCompanyChecklist(today);
      } catch {
        toast.error("기본 체크리스트를 등록하지 못했습니다.");
      }

      try {
        await correctStoredChecklistTitles();
      } catch {
        toast.error("체크리스트의 문의 제목을 수정하지 못했습니다.");
      }

      const { error } = await supabase.rpc("generate_checklist", { _date: today });
      if (error) toast.error("오늘의 반복 할 일을 만들지 못했습니다.");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["tasks"] }),
        qc.invalidateQueries({ queryKey: ["tpls"] }),
      ]);
    }

    void prepareChecklist();
  }, [today, qc]);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [taskId, setTaskId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const tasks = useQuery({ queryKey: ["tasks", showDone], queryFn: async () => {
    let q = supabase.from("tasks").select("*").order("due_date", { ascending: true, nullsFirst: false }).order("created_at");
    if (!showDone) q = q.eq("done", false);
    return (await q.limit(300)).data ?? []; } });
  const tpls = useQuery({ queryKey: ["tpls"], queryFn: async () => (await supabase.from("checklist_templates").select("*").order("created_at")).data ?? [] });
  const [t, setT] = useState({ title: "", assignee: null as string | null, due: today, freq: "한 번" as Frequency, wd: "1" });
  const add = useMutation({ mutationFn: async () => { if (!t.title.trim()) throw new Error("할 일을 입력해 주세요.");
    if (t.freq !== "한 번") return addRecurring(t.title.trim(), t.assignee, t.freq, t.wd, today);
    const { error } = await supabase.from("tasks").insert({ title: correctChecklistTitle(t.title.trim()), assignee: t.assignee, due_date: t.due || null }); if (error) throw new Error("추가하지 못했습니다."); },
    onSuccess: () => { setT({ ...t, title: "" }); setTaskDialogOpen(false); qc.invalidateQueries({ queryKey: ["tasks"] }); qc.invalidateQueries({ queryKey: ["tpls"] }); }, onError: (e) => toast.error((e as Error).message) });
  const toggle = useMutation({ mutationFn: async (v: { id: string; done: boolean }) => { await supabase.from("tasks").update({ done: v.done, done_at: v.done ? new Date().toISOString() : null }).eq("id", v.id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }) });
  const setAssignee = useMutation({ mutationFn: async (v: { id: string; a: string | null }) => { await supabase.from("tasks").update({ assignee: v.a }).eq("id", v.id); }, onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }) });
  const [r, setR] = useState({ title: "", freq: "매일" as Frequency, wd: "1", assignee: null as string | null });
  const addTpl = useMutation({ mutationFn: async () => { if (!r.title.trim()) throw new Error("항목을 입력해 주세요.");
    return addRecurring(r.title.trim(), r.assignee, r.freq, r.wd, today); },
    onSuccess: () => { setR({ ...r, title: "" }); setTemplateDialogOpen(false); qc.invalidateQueries(); }, onError: (e) => toast.error((e as Error).message) });
  const toggleTpl = useMutation({ mutationFn: async (v: { id: string; active: boolean }) => { await supabase.from("checklist_templates").update({ active: v.active }).eq("id", v.id); }, onSuccess: () => qc.invalidateQueries({ queryKey: ["tpls"] }) });

  const taskRows = tasks.data ?? [];
  const templateRows = tpls.data ?? [];
  const task = taskRows.find(({ id }) => id === taskId);
  const template = templateRows.find(({ id }) => id === templateId);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="체크리스트" desc="반복 항목은 지정한 날 처음 화면을 열 때 한 번만 만들어집니다." />
      <Panel title="할 일" accent="primary" action={<label className="flex items-center gap-2 text-sm"><Checkbox checked={showDone} onCheckedChange={(v) => setShowDone(!!v)} />완료 항목도 보기</label>}>
        <Label htmlFor="checklist-task-select" className="mb-1.5 block">항목</Label>
        <Select value={task?.id ?? ""} onValueChange={(value) => value === "add" ? setTaskDialogOpen(true) : setTaskId(value)}>
          <SelectTrigger id="checklist-task-select" className="w-full bg-card text-left" aria-label="할 일 선택">
            <SelectValue placeholder="할 일을 선택하세요" />
          </SelectTrigger>
          <SelectContent position="popper">
            {taskRows.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.title}{item.done ? " · 완료" : ""}
              </SelectItem>
            ))}
            <SelectItem value="add" className="mt-1 border-t font-semibold text-primary"><Plus aria-hidden="true" className="mr-2 inline size-4" />할 일 추가</SelectItem>
          </SelectContent>
        </Select>
        {task && (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-md border p-3">
            <p className="basis-full break-words text-sm font-semibold">{task.title}</p>
            <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">
              <Checkbox checked={task.done} onCheckedChange={(value) => toggle.mutate({ id: task.id, done: !!value })} />
              {task.done ? "완료됨" : "완료로 표시"}
            </label>
            {task.template_id && <span className="text-xs text-muted-foreground">반복</span>}
            <AssigneeSelect value={task.assignee} onChange={(a) => setAssignee.mutate({ id: task.id, a })} className="w-36 h-8" />
          </div>
        )}
        <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
          <DialogContent aria-describedby={undefined} className="max-h-[85dvh] overflow-y-auto">
            <DialogTitle>할 일 추가</DialogTitle>
            <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
              <div className="min-w-56 flex-1 space-y-1.5"><Label htmlFor="tt">새 할 일</Label><Input id="tt" value={t.title} onChange={(e) => setT({ ...t, title: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>담당자</Label><AssigneeSelect value={t.assignee} onChange={(a) => setT({ ...t, assignee: a })} /></div>
              <ScheduleButtons once value={t.freq} weekday={t.wd}
                onChange={(freq) => setT({ ...t, freq })} onWeekdayChange={(wd) => setT({ ...t, wd })} />
              {t.freq === "한 번" && (<div className="space-y-1.5"><Label htmlFor="td">기한</Label><Input id="td" type="date" className="bg-card" value={t.due} onChange={(e) => setT({ ...t, due: e.target.value })} /></div>)}
              <Button type="submit" disabled={add.isPending}>추가</Button>
            </form>
          </DialogContent>
        </Dialog>
      </Panel>
      <Panel title="반복 체크리스트 설정">
        <Label htmlFor="checklist-template-select" className="mb-1.5 block">항목</Label>
        <Select value={template?.id ?? ""} onValueChange={(value) => value === "add" ? setTemplateDialogOpen(true) : setTemplateId(value)}>
          <SelectTrigger id="checklist-template-select" className="w-full bg-card text-left" aria-label="반복 체크리스트 항목 선택">
            <SelectValue placeholder="반복 항목을 선택하세요" />
          </SelectTrigger>
          <SelectContent position="popper">
            {templateRows.map((item) => (
              <SelectItem key={item.id} value={item.id}>{item.title}{item.active ? "" : " · 중지됨"}</SelectItem>
            ))}
            <SelectItem value="add" className="mt-1 border-t font-semibold text-primary"><Plus aria-hidden="true" className="mr-2 inline size-4" />반복 항목 추가</SelectItem>
          </SelectContent>
        </Select>
        {template && (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-md border p-3 text-sm">
            <p className="basis-full break-words text-sm font-semibold">{template.title}</p>
            <span>{template.frequency}{template.frequency === "매주" && template.weekday !== null ? ` ${DOW[template.weekday]}요일` : ""}</span>
            <span className="min-w-0 flex-1 truncate">{nameOf(template.assignee)}</span>
            <Button size="sm" variant="outline" onClick={() => toggleTpl.mutate({ id: template.id, active: !template.active })}>
              {template.active ? "중지" : "다시 사용"}
            </Button>
          </div>
        )}
        <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
          <DialogContent aria-describedby={undefined} className="max-h-[85dvh] overflow-y-auto">
            <DialogTitle>반복 항목 추가</DialogTitle>
            <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); addTpl.mutate(); }}>
              <div className="min-w-56 flex-1 space-y-1.5"><Label htmlFor="rt">새 항목</Label><Input id="rt" value={r.title} onChange={(e) => setR({ ...r, title: e.target.value })} /></div>
              <ScheduleButtons value={r.freq} weekday={r.wd}
                onChange={(freq) => setR({ ...r, freq })} onWeekdayChange={(wd) => setR({ ...r, wd })} />
              <div className="space-y-1.5"><Label>담당자</Label><AssigneeSelect value={r.assignee} onChange={(a) => setR({ ...r, assignee: a })} /></div>
              <Button type="submit" disabled={addTpl.isPending}>반복 항목 추가</Button>
            </form>
          </DialogContent>
        </Dialog>
      </Panel>
    </div>
  );
}
