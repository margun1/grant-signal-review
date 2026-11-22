import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, Panel, StatusBadge, kst, todayKst } from "@/components/app/ui";
import { AssigneeSelect } from "@/components/app/AssigneeSelect";
import { useStaff } from "@/hooks/use-staff";

export const Route = createFileRoute("/_authenticated/devices")({
  head: () => ({ meta: [{ title: "기기오류 · 주식회사 에너인프라의 경영비서" }, { name: "description", content: "현장 제품·사내 장비 오류 접수와 조치 이력" }] }),
  component: DevicesPage,
});
const CAT = ["고객·실증 현장 제품", "사내 생산·시험 장비"] as const;
const ST = ["접수", "처리 중", "완료"] as const;
type Issue = { id: string; category: string; device: string; location: string | null; occurred_on: string | null; symptom: string; photo_path: string | null; assignee: string | null; status: string; inquiry_id: string | null; created_at: string };

function DevicesPage() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["issues"], queryFn: async () => ((await supabase.from("device_issues").select("*").order("created_at", { ascending: false }).limit(200)).data ?? []) as Issue[] });
  const [f, setF] = useState({ category: CAT[0] as string, device: "", location: "", occurred_on: todayKst(), symptom: "", assignee: null as string | null });
  const [photo, setPhoto] = useState<File | null>(null);
  const add = useMutation({ mutationFn: async () => {
    if (!f.device.trim() || !f.symptom.trim()) throw new Error("기기와 증상을 입력해 주세요.");
    let photo_path: string | null = null;
    if (photo) { photo_path = `issues/${crypto.randomUUID()}-${photo.name.replace(/[^\w.-]/g, "_")}`; const { error } = await supabase.storage.from("photos").upload(photo_path, photo); if (error) throw new Error("사진을 올리지 못했습니다."); }
    const { error } = await supabase.from("device_issues").insert({ ...f, device: f.device.trim(), symptom: f.symptom.trim(), location: f.location.trim() || null, occurred_on: f.occurred_on || null, photo_path });
    if (error) throw new Error("등록하지 못했습니다."); },
    onSuccess: () => { toast.success("등록했습니다."); setF({ ...f, device: "", location: "", symptom: "" }); setPhoto(null); qc.invalidateQueries({ queryKey: ["issues"] }); }, onError: (e) => toast.error((e as Error).message) });
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="기기오류" desc="고객·실증 현장 제품과 사내 생산·시험 장비를 구분해 관리합니다." />
      <Panel title="오류 등록" accent="primary">
        <form className="grid gap-3 md:grid-cols-2" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
          <div className="space-y-1.5"><Label>구분</Label><Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}><SelectTrigger className="bg-card"><SelectValue /></SelectTrigger><SelectContent>{CAT.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label htmlFor="dv">기기</Label><Input id="dv" value={f.device} onChange={(e) => setF({ ...f, device: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="lc">발생 장소</Label><Input id="lc" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="od">발생일</Label><Input id="od" type="date" className="bg-card" value={f.occurred_on} onChange={(e) => setF({ ...f, occurred_on: e.target.value })} /></div>
          <div className="space-y-1.5 md:col-span-2"><Label htmlFor="sy">증상</Label><Textarea id="sy" value={f.symptom} onChange={(e) => setF({ ...f, symptom: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="ph">사진 (선택)</Label><Input id="ph" type="file" accept="image/*" className="bg-card" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} /></div>
          <div className="space-y-1.5"><Label>담당자</Label><AssigneeSelect value={f.assignee} onChange={(a) => setF({ ...f, assignee: a })} className="w-full" /></div>
          <div><Button type="submit" disabled={add.isPending}>등록</Button></div>
        </form>
      </Panel>
      <div className="space-y-4">{(list.data ?? []).map((i) => <IssueCard key={i.id} i={i} />)}{(list.data ?? []).length === 0 && <p className="text-center text-muted-foreground">등록된 오류가 없습니다.</p>}</div>
    </div>
  );
}

function IssueCard({ i }: { i: Issue }) {
  const qc = useQueryClient(); const { nameOf } = useStaff(); const [note, setNote] = useState("");
  const logs = useQuery({ queryKey: ["issue-logs", i.id], queryFn: async () => (await supabase.from("device_issue_logs").select("*").eq("issue_id", i.id).order("created_at")).data ?? [] });
  const photo = useQuery({ queryKey: ["photo", i.photo_path], enabled: !!i.photo_path, queryFn: async () => (await supabase.storage.from("photos").createSignedUrl(i.photo_path!, 600)).data?.signedUrl ?? null });
  const upd = useMutation({ mutationFn: async (v: Partial<Issue>) => { await supabase.from("device_issues").update(v).eq("id", i.id); }, onSuccess: () => qc.invalidateQueries({ queryKey: ["issues"] }) });
  const addLog = useMutation({ mutationFn: async () => { if (!note.trim()) return; await supabase.from("device_issue_logs").insert({ issue_id: i.id, note: note.trim() }); }, onSuccess: () => { setNote(""); qc.invalidateQueries({ queryKey: ["issue-logs", i.id] }); } });
  return (
    <Panel title={<span>{i.device} <span className="text-sm font-normal text-muted-foreground">· {i.category}</span></span>} action={<StatusBadge label={i.status} tone={i.status === "완료" ? "good" : i.status === "처리 중" ? "warn" : "bad"} />}>
      <div className="flex flex-wrap gap-4">
        {photo.data && <a href={photo.data} target="_blank" rel="noreferrer"><img src={photo.data} alt={`${i.device} 사진`} className="h-28 w-28 rounded-md object-cover" /></a>}
        <div className="flex-1 space-y-1 text-sm"><p>장소: {i.location ?? "-"} · 발생일: {i.occurred_on ?? "-"} · 등록: {kst(i.created_at)}{i.inquiry_id && " · 고객문의에서 등록"}</p><p className="whitespace-pre-wrap">{i.symptom}</p></div>
      </div>
      <div className="mt-3 flex flex-wrap gap-3"><AssigneeSelect value={i.assignee} onChange={(a) => upd.mutate({ assignee: a })} />
        <Select value={i.status} onValueChange={(v) => upd.mutate({ status: v })}><SelectTrigger className="w-28 bg-card" aria-label="처리 상태"><SelectValue /></SelectTrigger><SelectContent>{ST.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
      <div className="mt-3"><p className="text-sm font-semibold">조치 이력</p>
        <ul className="mt-1 space-y-1 text-sm">{(logs.data ?? []).map((l) => <li key={l.id}><span className="text-muted-foreground">{kst(l.created_at)} · {nameOf(l.created_by)}</span> — {l.note}</li>)}</ul>
        <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); addLog.mutate(); }}><Input aria-label="조치 내용" placeholder="조치 내용" value={note} onChange={(e) => setNote(e.target.value)} className="bg-card" /><Button type="submit" size="sm">기록</Button></form></div>
    </Panel>
  );
}
