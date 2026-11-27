import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Sparkles, Send, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, Panel, StatusBadge, kst } from "@/components/app/ui";
import { AssigneeSelect } from "@/components/app/AssigneeSelect";
import { sampleCustomerInquiries } from "@/lib/sample-customer-inquiries";
import { draftInquiryReply, sendInquiryReply } from "@/lib/inquiries.functions";

export const Route = createFileRoute("/_authenticated/inquiries")({
  head: () => ({ meta: [{ title: "고객문의 · 주식회사 에너인프라의 경영비서" }, { name: "description", content: "홈페이지·카카오톡 문의와 답변" }] }),
  component: InquiriesPage,
});
const ST = ["미답변", "처리 중", "답변 완료"] as const;
const tone = (s: string) => (s === "답변 완료" ? "good" : s === "처리 중" ? "warn" : "bad") as "good" | "warn" | "bad";

function InquiriesPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("전체"); const [sel, setSel] = useState<string | null>(null);
  const list = useQuery({ queryKey: ["inq", filter], queryFn: async () => { let q = supabase.from("inquiries").select("*").order("received_at", { ascending: false }).limit(200); if (filter !== "전체") q = q.eq("status", filter); return (await q).data ?? []; } });
  const settings = useQuery({ queryKey: ["company_settings"], queryFn: async () => (await supabase.from("company_settings").select("*").eq("id", 1).maybeSingle()).data });
  const [n, setN] = useState({ channel: "전화", content: "", email: "" });
  const add = useMutation({ mutationFn: async () => { if (!n.content.trim()) throw new Error("문의 내용을 입력해 주세요.");
    const { error } = await supabase.from("inquiries").insert({ channel: n.channel, content: n.content.trim(), email: n.email.trim() || null }); if (error) throw new Error("등록하지 못했습니다."); },
    onSuccess: () => { setN({ ...n, content: "", email: "" }); qc.invalidateQueries({ queryKey: ["inq"] }); }, onError: (e) => toast.error((e as Error).message) });
  const [showSamples, setShowSamples] = useState(true);
  const rows = [
    ...(list.data ?? []).map((inquiry) => ({ ...inquiry, sample: false as const })),
    ...(showSamples ? sampleCustomerInquiries.filter((q) => filter === "전체" || q.status === filter) : []),
  ].sort((a, b) => Date.parse(b.received_at) - Date.parse(a.received_at));
  const cur = rows.find((x) => x.id === sel);
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="고객문의 (C/S)" desc={`회신 이메일: ${settings.data?.reply_email ?? "미설정"} · 카카오톡 채널: ${settings.data?.kakao_channel_url ? "등록됨 (답변 연동 대기)" : "미개설"}`} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Panel title="문의 목록" action={<Select value={filter} onValueChange={setFilter}><SelectTrigger className="h-8 w-32 bg-card" aria-label="상태 필터"><SelectValue /></SelectTrigger><SelectContent>{["전체", ...ST].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>}>
          <label className="mb-2 flex w-fit cursor-pointer items-center gap-2 py-2 text-sm">
            <input type="checkbox" checked={showSamples} onChange={(e) => setShowSamples(e.target.checked)} />
            가상 문의 표시
          </label>
          <ul className="divide-y">{rows.map((x) => (
            <li key={x.id}><button type="button" onClick={() => setSel(x.id)} className={`w-full rounded-md p-3 text-left hover:bg-accent ${sel === x.id ? "bg-accent" : ""}`}>
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>{x.channel} · {kst(x.received_at)}</span><span className="flex shrink-0 items-center gap-1.5">{x.sample && <StatusBadge label="가상" tone="warn" />}<StatusBadge label={x.status} tone={tone(x.status)} /></span></div>
              <p className="mt-1 line-clamp-2 text-sm">{x.content}</p></button></li>))}
            {rows.length === 0 && <li className="py-6 text-center text-muted-foreground">문의가 없습니다.</li>}</ul>
          <form className="mt-4 space-y-2 border-t pt-4" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
            <p className="text-sm font-semibold">직접 등록 (전화 등)</p>
            <div className="flex gap-2"><Select value={n.channel} onValueChange={(v) => setN({ ...n, channel: v })}><SelectTrigger className="w-28 bg-card" aria-label="채널"><SelectValue /></SelectTrigger><SelectContent>{["전화", "홈페이지", "카카오톡", "기타"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
              <Input placeholder="회신 이메일 (선택)" type="email" value={n.email} onChange={(e) => setN({ ...n, email: e.target.value })} className="bg-card" /></div>
            <Textarea aria-label="문의 내용" placeholder="문의 내용" value={n.content} onChange={(e) => setN({ ...n, content: e.target.value })} />
            <Button type="submit" size="sm">등록</Button>
          </form>
        </Panel>
        {cur ? (
          cur.sample ? <SampleDetail q={cur} /> : <Detail key={cur.id} q={cur} />
        ) : (
          <Panel><p className="py-10 text-center text-muted-foreground">목록에서 문의를 선택하세요.</p></Panel>
        )}
      </div>
      <Panel title="홈페이지 문의 양식 연결 방법">
        <p className="text-sm">홈페이지 문의 양식의 전송 주소를 아래 주소로 바꾸면 문의가 이 화면에 들어옵니다. 받는 칸 이름: name, org(선택), email, content</p>
        <code className="mt-2 block break-all rounded bg-secondary p-2 text-sm">{typeof window !== "undefined" ? window.location.origin : ""}/api/public/inquiry</code>
        <p className="mt-2 text-xs text-muted-foreground">앱을 게시한 뒤 게시 주소로 연결하고 테스트 문의를 한 번 보내 확인해 주세요.</p>
      </Panel>
    </div>
  );
}

type Inq = { id: string; channel: string; name: string | null; org: string | null; email: string | null; content: string; received_at: string; assignee: string | null; status: string; reply_draft: string | null };
function InquirySummary({ q }: { q: Inq }) {
  return (
    <>
        <dl className="grid grid-cols-[6rem_1fr] gap-y-1 text-sm"><dt className="text-muted-foreground">채널</dt><dd>{q.channel}</dd><dt className="text-muted-foreground">접수일</dt><dd>{kst(q.received_at)}</dd>
          <dt className="text-muted-foreground">이름·소속</dt><dd>{q.name ?? "-"}{q.org ? ` · ${q.org}` : ""}</dd><dt className="text-muted-foreground">회신 주소</dt><dd>{q.email ?? "-"}</dd></dl>
        <p className="mt-3 whitespace-pre-wrap rounded-md bg-secondary p-3 text-sm">{q.content}</p>
    </>
  );
}

function SampleDetail({ q }: { q: Inq }) {
  return (
    <Panel title="가상 문의 상세" accent="primary" action={<StatusBadge label={q.status} tone={tone(q.status)} />}>
      <InquirySummary q={q} />
      <p className="mt-3 text-sm">담당자 <span className="ml-2">{q.assignee ?? "미지정"}</span></p>
      <div className="mt-4 space-y-1">
        <p className="text-sm font-semibold">답변 예시</p>
        <p className="rounded-md bg-secondary p-3 text-sm">{q.reply_draft ?? "등록된 답변 예시가 없습니다."}</p>
      </div>
    </Panel>
  );
}

function Detail({ q }: { q: Inq }) {
  const qc = useQueryClient(); const draftFn = useServerFn(draftInquiryReply); const sendFn = useServerFn(sendInquiryReply);
  const [body, setBody] = useState(q.reply_draft ?? ""); useEffect(() => setBody(q.reply_draft ?? ""), [q.reply_draft]);
  const msgs = useQuery({ queryKey: ["inq-msg", q.id], queryFn: async () => (await supabase.from("inquiry_messages").select("*").eq("inquiry_id", q.id).order("created_at", { ascending: false })).data ?? [] });
  const upd = useMutation({ mutationFn: async (v: Partial<Pick<Inq, "assignee" | "status" | "reply_draft">>) => { await supabase.from("inquiries").update(v).eq("id", q.id); }, onSuccess: () => qc.invalidateQueries({ queryKey: ["inq"] }) });
  const draft = useMutation({ mutationFn: () => draftFn({ data: { id: q.id } }), onSuccess: (r) => { setBody(r.reply); qc.invalidateQueries({ queryKey: ["inq"] }); }, onError: (e) => toast.error((e as Error).message || "초안을 만들지 못했습니다.") });
  const send = useMutation({ mutationFn: async () => { await upd.mutateAsync({ reply_draft: body }); return sendFn({ data: { id: q.id, body } }); },
    onSuccess: (r) => { if (!r.sent) toast.warning(`발송하지 못했습니다: ${r.reason}`); qc.invalidateQueries({ queryKey: ["inq-msg", q.id] }); }, onError: () => toast.error("발송하지 못했습니다.") });
  const toIssue = useMutation({ mutationFn: async () => { const { error } = await supabase.from("device_issues").insert({ category: "고객·실증 현장 제품", device: "확인 필요", symptom: q.content.slice(0, 1000), inquiry_id: q.id }); if (error) throw error; },
    onSuccess: () => toast.success("기기오류 건을 만들었습니다. 기기오류 화면에서 내용을 채워 주세요."), onError: () => toast.error("만들지 못했습니다.") });
  return (
    <Panel title="문의 상세" accent="primary">
      <InquirySummary q={q} />
      <div className="mt-4 flex flex-wrap gap-3"><AssigneeSelect value={q.assignee} onChange={(a) => upd.mutate({ assignee: a })} />
        <Select value={q.status} onValueChange={(v) => upd.mutate({ status: v })}><SelectTrigger className="w-32 bg-card" aria-label="처리 상태"><SelectValue /></SelectTrigger><SelectContent>{ST.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
        <Button variant="outline" onClick={() => toIssue.mutate()}><Wrench className="size-4" />기기오류로 등록</Button></div>
      <div className="mt-4 space-y-2"><div className="flex items-center justify-between"><Label htmlFor="rb">답변</Label><Button size="sm" variant="outline" disabled={draft.isPending} onClick={() => draft.mutate()}><Sparkles className="size-4" />{draft.isPending ? "작성 중…" : "AI 초안"}</Button></div>
        <Textarea id="rb" rows={8} value={body} onChange={(e) => setBody(e.target.value)} placeholder="AI 초안을 만들거나 직접 작성하세요. 읽고 수정한 뒤 발송합니다." />
        <Button disabled={!body.trim() || send.isPending} onClick={() => send.mutate()}><Send className="size-4" />확인하고 발송</Button></div>
      <div className="mt-4"><p className="text-sm font-semibold">발송 이력</p>
        <ul className="mt-1 space-y-1 text-sm">{(msgs.data ?? []).map((m) => <li key={m.id} className="flex flex-wrap gap-2"><span className="text-muted-foreground">{kst(m.created_at)}</span><StatusBadge label={m.result} tone={m.result === "성공" ? "good" : "warn"} />{m.error && <span className="text-xs">{m.error}</span>}</li>)}
          {(msgs.data ?? []).length === 0 && <li className="text-muted-foreground">없음</li>}</ul></div>
      <Link to="/devices" className="mt-3 inline-block text-sm underline">기기오류 화면</Link>
    </Panel>
  );
}
