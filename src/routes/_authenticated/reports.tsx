import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, StatusBadge, kst } from "@/components/app/ui";
import { RangePicker, presetRange, type Range } from "@/components/app/data";
import { generateReport } from "@/lib/assistant.functions";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "AI 리포트 · 주식회사 에너인프라의 경영비서" }, { name: "description", content: "주간 자동 리포트와 기간별 리포트" }] }),
  component: ReportsPage,
});
type Content = { summary: string; sections: { title: string; body: string }[]; missing: string[]; 자료기준?: { 종류: string; 기간: string | null; 기준일: string | null; 업로드: string }[] };
const DOW = ["일", "월", "화", "수", "목", "금", "토"];

function ReportsPage() {
  const qc = useQueryClient(); const gen = useServerFn(generateReport);
  const [range, setRange] = useState<Range>(presetRange(7)); const [sel, setSel] = useState<string | null>(null);
  const list = useQuery({ queryKey: ["reports"], queryFn: async () => (await supabase.from("ai_reports").select("*").order("created_at", { ascending: false }).limit(50)).data ?? [] });
  const settings = useQuery({ queryKey: ["company_settings"], queryFn: async () => (await supabase.from("company_settings").select("*").eq("id", 1).maybeSingle()).data });
  const make = useMutation({ mutationFn: () => gen({ data: range }), onSuccess: (r) => { setSel(r.id); qc.invalidateQueries({ queryKey: ["reports"] }); toast.success("리포트를 만들었습니다."); }, onError: (e) => toast.error((e as Error).message || "리포트를 만들지 못했습니다.") });
  const cur = (list.data ?? []).find((r) => r.id === (sel ?? list.data?.[0]?.id));
  const c = cur?.content as Content | undefined;
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="AI 리포트" desc={settings.data ? `주간 리포트: 매주 ${DOW[settings.data.report_weekday]}요일 ${settings.data.report_hour}시 자동 생성 (지난 7일) · 관리자는 연락 설정에서 변경` : undefined} />
      <Panel title="기간 리포트 만들기" accent="primary">
        <RangePicker value={range} onChange={setRange} presets={[[7, "최근 7일"], [30, "최근 30일"]]} />
        <Button className="mt-3" disabled={make.isPending} onClick={() => make.mutate()}><Sparkles className="size-4" />{make.isPending ? "작성 중… (1분 정도)" : "리포트 만들기"}</Button>
      </Panel>
      <div className="grid gap-6 md:grid-cols-[16rem_1fr]">
        <Panel title="목록"><ul className="space-y-1">{(list.data ?? []).map((r) => <li key={r.id}><button type="button" onClick={() => setSel(r.id)} className={`w-full rounded-md p-2 text-left text-sm hover:bg-accent ${cur?.id === r.id ? "bg-accent" : ""}`}>
          <StatusBadge label={r.kind} tone={r.kind === "주간" ? "good" : "info"} /> <span className="block">{r.period_start} ~ {r.period_end}</span><span className="text-xs text-muted-foreground">{kst(r.created_at)}</span></button></li>)}
          {(list.data ?? []).length === 0 && <li className="text-sm text-muted-foreground">아직 리포트가 없습니다.</li>}</ul></Panel>
        {c && cur ? <Panel title={`${cur.period_start} ~ ${cur.period_end} 리포트`} accent="gold">
          <p className="whitespace-pre-wrap">{c.summary}</p>
          {c.sections.map((s) => <section key={s.title} className="mt-4"><h3 className="font-bold">{s.title}</h3><p className="mt-1 whitespace-pre-wrap text-sm">{s.body}</p></section>)}
          {c.missing.length > 0 && <div className="mt-4 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm"><p className="font-semibold">확인 필요</p><ul className="list-disc pl-5">{c.missing.map((m) => <li key={m}>{m}</li>)}</ul></div>}
          {c.자료기준 && <p className="mt-4 text-xs text-muted-foreground">자료 기준: {c.자료기준.map((u) => `${u.종류} ${u.기간 ?? u.기준일 ?? ""} (업로드 ${u.업로드})`).join(" · ") || "업로드 자료 없음"}</p>}
        </Panel> : <Panel><p className="text-muted-foreground">리포트를 선택하세요.</p></Panel>}
      </div>
    </div>
  );
}
