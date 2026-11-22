import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Send, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader, Panel } from "@/components/app/ui";
import { askAssistant } from "@/lib/assistant.functions";

export const Route = createFileRoute("/_authenticated/assistant")({
  head: () => ({ meta: [{ title: "AI 비서 · 주식회사 에너인프라의 경영비서" }, { name: "description", content: "매출·재고·일정·문의·공고를 묻고 초안을 받는 AI 비서" }] }),
  component: AssistantPage,
});
type Action = { type: "none" | "add_task" | "add_meeting"; title: string | null; date: string | null; start_time: string | null; end_time: string | null };
type Msg = { role: "user" | "assistant"; content: string; sources?: string[]; action?: Action; actionState?: "pending" | "done" | "cancelled" | undefined };
const EXAMPLES = ["최근 30일 매출과 매출총이익 알려줘", "부족한 재고와 권장 발주량은?", "이번 주 마감 공고 정리해줘", "내일 10시에 생산회의 일정 추가해줘"];

function AssistantPage() {
  const ask = useServerFn(askAssistant); const qc = useQueryClient();
  const [msgs, setMsgs] = useState<Msg[]>([]); const [input, setInput] = useState("");
  const end = useRef<HTMLDivElement>(null); useEffect(() => end.current?.scrollIntoView({ behavior: "smooth" }), [msgs]);
  const send = useMutation({
    mutationFn: async (text: string) => { const next = [...msgs, { role: "user" as const, content: text }]; setMsgs(next); setInput("");
      return ask({ data: { messages: next.slice(-12).map((m) => ({ role: m.role, content: m.content })) } }); },
    onSuccess: (r) => setMsgs((m) => [...m, { role: "assistant", content: r.answer, sources: r.sources, action: r.action, actionState: r.action.type !== "none" ? "pending" : undefined }]),
    onError: (e) => toast.error((e as Error).message || "답변을 받지 못했습니다."),
  });
  const run = async (i: number) => {
    const a = msgs[i]!.action!;
    try {
      if (a.type === "add_task") { const { error } = await supabase.from("tasks").insert({ title: a.title ?? "할 일", due_date: a.date }); if (error) throw error; }
      if (a.type === "add_meeting") { if (!a.date || !a.start_time) throw new Error("날짜와 시간이 필요합니다.");
        const s = new Date(`${a.date}T${a.start_time}:00+09:00`); const e = a.end_time ? new Date(`${a.date}T${a.end_time}:00+09:00`) : new Date(s.getTime() + 3600000);
        const { error } = await supabase.from("meetings").insert({ kind: "내부 회의", title: a.title ?? "내부 회의", start_at: s.toISOString(), end_at: e.toISOString(), status: "확정" }); if (error) throw error; }
      setMsgs((m) => m.map((x, j) => (j === i ? { ...x, actionState: "done" } : x))); qc.invalidateQueries(); toast.success("등록했습니다.");
    } catch (e) { toast.error((e as Error).message || "등록하지 못했습니다."); }
  };
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <PageHeader title="AI 비서" desc="로그인한 권한 안의 자료로 답합니다. 일정·할 일 추가는 확인 버튼을 눌러야 실행됩니다." />
      <Panel className="min-h-[50vh]">
        {msgs.length === 0 && <div className="flex flex-wrap gap-2">{EXAMPLES.map((e) => <Button key={e} variant="outline" size="sm" onClick={() => send.mutate(e)}>{e}</Button>)}</div>}
        <div className="space-y-4">{msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "ml-auto max-w-[85%] rounded-lg bg-accent p-3" : "max-w-[90%] rounded-lg border bg-card p-3"}>
            <p className="whitespace-pre-wrap text-sm">{m.content}</p>
            {m.sources && m.sources.length > 0 && <p className="mt-2 text-xs text-muted-foreground">근거: {m.sources.join(" · ")}</p>}
            {m.action && m.action.type !== "none" && (
              <div className="mt-3 rounded-md border border-primary/40 bg-primary/5 p-3 text-sm">
                <p className="font-semibold">{m.action.type === "add_task" ? "할 일 추가" : "내부 회의 추가"} 제안</p>
                <p>{m.action.title} · {m.action.date ?? "날짜 없음"}{m.action.start_time ? ` ${m.action.start_time}` : ""}{m.action.end_time ? `~${m.action.end_time}` : ""}</p>
                {m.actionState === "pending" ? <div className="mt-2 flex gap-2"><Button size="sm" onClick={() => run(i)}><Check className="size-4" />확인하고 실행</Button><Button size="sm" variant="outline" onClick={() => setMsgs((x) => x.map((y, j) => (j === i ? { ...y, actionState: "cancelled" } : y)))}><X className="size-4" />취소</Button></div>
                  : <p className="mt-1 text-xs text-muted-foreground">{m.actionState === "done" ? "실행 완료" : "취소됨"}</p>}
              </div>)}
          </div>))}
          {send.isPending && <p className="text-sm text-muted-foreground">답변을 준비하고 있습니다…</p>}<div ref={end} /></div>
      </Panel>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (input.trim()) send.mutate(input.trim()); }}>
        <Textarea aria-label="질문" rows={2} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if (input.trim()) send.mutate(input.trim()); } }} placeholder="무엇이든 물어보세요" />
        <Button type="submit" disabled={send.isPending || !input.trim()} className="h-auto"><Send className="size-4" />보내기</Button>
      </form>
    </div>
  );
}
