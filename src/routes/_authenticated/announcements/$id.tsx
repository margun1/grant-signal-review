import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Copy, ExternalLink, FileUp, RefreshCw, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { analyzeAnnouncement, reviewPlan } from "@/lib/announcements.functions";
import type { Analysis, Review } from "@/lib/schemas";
import { STATUSES, type AnnouncementStatus } from "@/lib/company";
import { useMe } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, Panel, StatusBadge, kst } from "@/components/app/ui";

export const Route = createFileRoute("/_authenticated/announcements/$id")({
  validateSearch: (s: Record<string, unknown>): { start?: boolean } => (s["start"] ? { start: true } : {}),
  head: () => ({ meta: [{ title: "공고 상세 · 주식회사 에너인프라의 경영비서" }, { name: "description", content: "공고 적합성 결과와 사업계획서 검토" }] }),
  component: Detail,
});

type Source = { url: string; document: string; location: string };
function Src({ s }: { s: Source }) {
  const label = [s.document, s.location].filter(Boolean).join(" · ");
  return (
    <span className="ml-1 text-xs text-muted-foreground">
      [출처: {s.url ? <a href={s.url} target="_blank" rel="noreferrer" className="underline">{label || "원본"}</a> : label || "확인 필요"}]
    </span>
  );
}

function copy(text: string) {
  navigator.clipboard.writeText(text).then(() => toast.success("복사했습니다. 한글 문서에 붙여 넣어 주세요."), () => toast.error("복사하지 못했습니다."));
}

async function uploadPdf(annId: string, folder: "materials" | "drafts", file: File) {
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) throw new Error("PDF 파일만 올릴 수 있습니다. 한글 파일은 PDF로 변환해 주세요.");
  const path = `announcements/${annId}/${folder}/${crypto.randomUUID()}.pdf`;
  const { error } = await supabase.storage.from("documents").upload(path, file, { contentType: "application/pdf" });
  if (error) throw new Error("파일을 올리지 못했습니다.");
  return path;
}

function Detail() {
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { me } = useMe();
  const analyzeFn = useServerFn(analyzeAnnouncement);
  const reviewFn = useServerFn(reviewPlan);

  const ann = useQuery({
    queryKey: ["ann", id],
    queryFn: async () => (await supabase.from("announcements").select("*").eq("id", id).single()).data,
    refetchInterval: (q) => (q.state.data?.analysis_status === "running" ? 5000 : false),
  });
  const mats = useQuery({
    queryKey: ["mats", id],
    queryFn: async () => (await supabase.from("announcement_materials").select("*").eq("announcement_id", id).order("created_at")).data ?? [],
  });
  const reviews = useQuery({
    queryKey: ["reviews", id],
    queryFn: async () => (await supabase.from("plan_reviews").select("*").eq("announcement_id", id).order("round", { ascending: false })).data ?? [],
    refetchInterval: (q) => (q.state.data?.some((r) => r.status === "running") ? 5000 : false),
  });
  const profiles = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => (await supabase.from("profiles").select("id,display_name,email")).data ?? [],
  });
  const nameOf = (uid: string | null) => profiles.data?.find((p) => p.id === uid)?.display_name ?? "—";

  const refresh = () => { qc.invalidateQueries({ queryKey: ["ann", id] }); qc.invalidateQueries({ queryKey: ["mats", id] }); qc.invalidateQueries({ queryKey: ["announcements"] }); };

  const analyze = useMutation({
    mutationFn: () => analyzeFn({ data: { id } }),
    onMutate: () => qc.setQueryData(["ann", id], (o: typeof ann.data) => (o ? { ...o, analysis_status: "running" } : o)),
    onSuccess: (r) => (r.ok ? toast.success(r.message) : toast.error(r.message)),
    onError: (e) => toast.error((e as Error).message),
    onSettled: refresh,
  });

  const started = useRef(false);
  useEffect(() => {
    if (search.start && ann.data && !started.current) {
      started.current = true;
      navigate({ to: "/announcements/$id", params: { id }, search: {}, replace: true });
      if (ann.data.analysis_status === "pending") analyze.mutate();
    }
  }, [search.start, ann.data, analyze, navigate, id]);

  // 자료 추가 첨부
  const [replaceId, setReplaceId] = useState<string>("none");
  const matInput = useRef<HTMLInputElement>(null);
  const addMaterial = useMutation({
    mutationFn: async (file: File) => {
      const path = await uploadPdf(id, "materials", file);
      const { error } = await supabase.from("announcement_materials").insert({ announcement_id: id, name: file.name, kind: "upload", storage_path: path, fetch_status: "ok" });
      if (error) throw new Error(error.message);
      if (replaceId !== "none") await supabase.from("announcement_materials").update({ fetch_status: "replaced" }).eq("id", replaceId);
    },
    onSuccess: () => { toast.success("자료를 추가했습니다. ‘다시 분석’을 눌러 검토를 재개하세요."); setReplaceId("none"); refresh(); },
    onError: (e) => toast.error((e as Error).message),
  });

  // 사업계획서 검토
  const draftInput = useRef<HTMLInputElement>(null);
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const runReview = useMutation({
    mutationFn: async (file: File) => {
      const path = await uploadPdf(id, "drafts", file);
      const requestKey = crypto.randomUUID();
      const p = reviewFn({ data: { announcementId: id, draftPath: path, draftName: file.name, requestKey } });
      setTimeout(() => qc.invalidateQueries({ queryKey: ["reviews", id] }), 1500);
      return p;
    },
    onSuccess: (r) => { r.ok ? toast.success(r.message) : toast.error(r.message); setSelectedRound(r.round); },
    onError: (e) => toast.error((e as Error).message),
    onSettled: () => qc.invalidateQueries({ queryKey: ["reviews", id] }),
  });

  // 상태 기록
  const [note, setNote] = useState<string | null>(null);
  const setStatus = useMutation({
    mutationFn: async (status: AnnouncementStatus) => {
      const { error } = await supabase.from("announcements").update({ status, status_note: note ?? ann.data?.status_note ?? null }).eq("id", id);
      if (error) throw new Error(error.message.includes("실장") ? "진행 상태는 실장만 기록할 수 있습니다." : error.message);
    },
    onSuccess: () => { toast.success("대표님 확인 결과를 기록했습니다."); refresh(); },
    onError: (e) => toast.error((e as Error).message),
  });

  if (ann.isLoading) return <p className="text-muted-foreground">불러오는 중…</p>;
  if (!ann.data) return <p>공고를 찾을 수 없습니다. <Link to="/announcements" className="underline">목록으로</Link></p>;
  const a = ann.data;
  const analysis = a.analysis as Analysis | null;
  const running = a.analysis_status === "running" || analyze.isPending;
  const failedMats = (mats.data ?? []).filter((m) => m.fetch_status === "failed");
  const reviewList = reviews.data ?? [];
  const shown = reviewList.find((r) => r.round === selectedRound) ?? reviewList[0];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title={a.title ?? "공고 분석"}
        desc={a.organizer ?? undefined}
        action={<a href={a.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold underline"><ExternalLink className="size-4" aria-hidden />원본 공고</a>}
      />

      <Panel title="진행 상태 (대표님 확인 결과)" accent="primary">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge label={a.status} />
          <span className="text-sm text-muted-foreground">수정 {kst(a.status_updated_at)}{a.status_updated_by ? ` · ${nameOf(a.status_updated_by)}` : ""}</span>
        </div>
        {a.status_note && <p className="mt-2 text-sm">메모: {a.status_note}</p>}
        {me?.isManager ? (
          <div className="mt-4 space-y-3">
            <Textarea placeholder="대표님 확인 내용 메모 (선택)" value={note ?? a.status_note ?? ""} onChange={(e) => setNote(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              {STATUSES.map((s) => (
                <Button key={s} variant={a.status === s ? "default" : "outline"} size="sm" disabled={setStatus.isPending} onClick={() => setStatus.mutate(s)} aria-pressed={a.status === s}>{s}{a.status === s ? " (현재)" : ""}</Button>
              ))}
            </div>
          </div>
        ) : <p className="mt-3 text-xs text-muted-foreground">진행 상태는 실장이 기록합니다.</p>}
      </Panel>

      <Panel title="적합성 결과" action={
        <Button variant="outline" size="sm" disabled={running} onClick={() => analyze.mutate()}>
          {running ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}{running ? "분석 중…" : analysis ? "다시 분석" : "분석 시작"}
        </Button>
      }>
        {running && <p className="mb-3 text-sm"><StatusBadge label="분석 중" tone="busy" /> 공고 자료를 가져와 분석하고 있습니다. 1~3분 걸릴 수 있습니다.</p>}
        {a.analysis_status === "failed" && a.analysis_error && <p className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">분석 실패: {a.analysis_error}</p>}
        {!analysis ? (!running && <p className="text-sm text-muted-foreground">아직 분석 결과가 없습니다.</p>) : (
          <div className="space-y-6 text-sm">
            <div className="grid gap-3 md:grid-cols-3">
              <Info label="적합성"><StatusBadge label={analysis.fit_level} /></Info>
              <Info label="신청 마감">{analysis.deadline_text ?? analysis.deadline ?? "[확인 필요: 신청 마감일]"}</Info>
              <Info label="주관기관">{analysis.organizer ?? "[확인 필요]"}</Info>
            </div>
            <section>
              <h3 className="mb-2 font-bold">적합성 판단 이유</h3>
              <ul className="list-disc space-y-1 pl-5">{analysis.fit_reasons.map((r, i) => <li key={i}>{r.text}<Src s={r.source} /></li>)}</ul>
            </section>
            <section>
              <h3 className="mb-2 font-bold">신청 자격</h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead className="bg-secondary text-left"><tr><th className="p-2">조건</th><th className="p-2">공고 요건</th><th className="p-2">회사 정보</th><th className="p-2">판단</th></tr></thead>
                  <tbody>{analysis.eligibility.map((e, i) => (
                    <tr key={i} className="border-t align-top"><td className="p-2 font-semibold">{e.condition}</td><td className="p-2">{e.requirement}<Src s={e.source} /></td><td className="p-2">{e.company_fact}</td><td className="p-2"><StatusBadge label={e.result} /></td></tr>
                  ))}</tbody>
                </table>
              </div>
            </section>
            <section>
              <h3 className="mb-2 font-bold">지원 항목·한도·지급 방식</h3>
              <dl className="grid gap-2 md:grid-cols-2">
                <Info label="지원 항목">{analysis.support.items}</Info>
                <Info label="지원 한도">{analysis.support.limit}</Info>
                <Info label="지급 방식">{analysis.support.payment_method}</Info>
                <Info label="회사 계좌 직접 지급"><StatusBadge label={analysis.support.direct_payment} /></Info>
              </dl>
              <Src s={analysis.support.source} />
            </section>
            <section>
              <h3 className="mb-2 font-bold">POWERBOARD와 연결되는 근거</h3>
              <ul className="list-disc space-y-1 pl-5">{analysis.powerboard_links.map((r, i) => <li key={i}>{r.text}<Src s={r.source} /></li>)}</ul>
            </section>
            <div className="grid gap-4 md:grid-cols-2">
              <section className="rounded-md border border-gold/50 p-3">
                <h3 className="mb-2 font-bold">대표님께 확인할 사항</h3>
                <ul className="list-disc space-y-1 pl-5">{analysis.ceo_questions.map((q, i) => <li key={i}>{q}</li>)}</ul>
              </section>
              <section className="rounded-md border border-warning/50 p-3">
                <h3 className="mb-2 font-bold">미확인 항목</h3>
                {analysis.unverified.length ? <ul className="list-disc space-y-1 pl-5">{analysis.unverified.map((q, i) => <li key={i}>{q}</li>)}</ul> : <p className="text-muted-foreground">없음</p>}
              </section>
            </div>
          </div>
        )}
      </Panel>

      <Panel title="공고 자료">
        {(mats.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">분석을 시작하면 공고 자료가 여기에 표시됩니다.</p> : (
          <ul className="divide-y text-sm">
            {(mats.data ?? []).map((m) => (
              <li key={m.id} className="flex flex-wrap items-start justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <div className="font-medium">{m.source_url ? <a href={m.source_url} target="_blank" rel="noreferrer" className="underline">{m.name}</a> : m.name}</div>
                  {m.fetch_status === "failed" && <div className="text-destructive">{m.failure_reason}</div>}
                </div>
                <StatusBadge label={m.fetch_status === "ok" ? (m.kind === "upload" ? "첨부 완료" : "확인") : m.fetch_status === "replaced" ? "대체됨" : "열 수 없음"} tone={m.fetch_status === "ok" ? "good" : m.fetch_status === "replaced" ? "info" : "bad"} />
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-md bg-secondary p-3">
          <span className="text-sm font-medium">PDF 자료 추가</span>
          {failedMats.length > 0 && (
            <Select value={replaceId} onValueChange={setReplaceId}>
              <SelectTrigger className="w-64 bg-card" aria-label="대체할 자료"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">새 자료로 추가</SelectItem>
                {failedMats.map((m) => <SelectItem key={m.id} value={m.id}>대체: {m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <input ref={matInput} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) addMaterial.mutate(f); e.target.value = ""; }} />
          <Button variant="outline" size="sm" disabled={addMaterial.isPending} onClick={() => matInput.current?.click()}><FileUp aria-hidden />{addMaterial.isPending ? "올리는 중…" : "파일 선택"}</Button>
        </div>
      </Panel>

      <Panel title="사업계획서 검토" accent="gold" action={
        <>
          <input ref={draftInput} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) runReview.mutate(f); e.target.value = ""; }} />
          <Button disabled={runReview.isPending} onClick={() => draftInput.current?.click()}>
            {runReview.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <FileUp aria-hidden />}{runReview.isPending ? "검토 중…" : "초안 PDF 올리고 검토"}
          </Button>
        </>
      }>
        <p className="mb-4 text-xs text-muted-foreground">한글(.hwp·.hwpx) 초안은 PDF로 변환해 올려 주세요. 검토할 때마다 새 회차로 보관됩니다.</p>
        {reviewList.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="검토 회차">
            {reviewList.map((r) => (
              <Button key={r.id} size="sm" variant={shown?.id === r.id ? "default" : "outline"} onClick={() => setSelectedRound(r.round)} role="tab" aria-selected={shown?.id === r.id}>
                {r.round}차 {r.status === "running" ? "(검토 중)" : r.status === "failed" ? "(실패)" : ""}
              </Button>
            ))}
          </div>
        )}
        {shown ? <ReviewView r={shown} executor={nameOf(shown.executed_by)} /> : <p className="text-sm text-muted-foreground">아직 검토 회차가 없습니다.</p>}
      </Panel>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="rounded-md border p-3"><div className="mb-1 text-xs font-semibold text-muted-foreground">{label}</div><div>{children}</div></div>;
}

type ReviewRow = { round: number; status: string; result: unknown; error: string | null; draft_name: string; draft_path: string; material_names: string[]; created_at: string };
function ReviewView({ r, executor }: { r: ReviewRow; executor: string }) {
  const res = r.result as Review | null;
  async function openDraft() {
    const { data } = await supabase.storage.from("documents").createSignedUrl(r.draft_path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  }
  return (
    <div className="space-y-4 text-sm">
      <div className="grid gap-2 rounded-md bg-secondary p-3 md:grid-cols-2">
        <div><span className="font-semibold">회차</span> {r.round}차 · {kst(r.created_at)} · 실행자 {executor}</div>
        <div><span className="font-semibold">초안</span> <button className="underline" onClick={openDraft}>{r.draft_name}</button></div>
        <div className="md:col-span-2"><span className="font-semibold">확인한 공고 자료</span> {r.material_names.join(", ") || "없음"}</div>
      </div>
      {r.status === "running" && <StatusBadge label="검토 중" tone="busy" />}
      {r.status === "failed" && <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-destructive">검토 실패: {r.error} — 초안 PDF를 다시 올려 새 회차로 검토해 주세요.</p>}
      {res && (
        <>
          <div className="flex flex-wrap items-center gap-2"><StatusBadge label={res.criteria_status} />{res.unreadable_pages && <StatusBadge label={`판독 불가: ${res.unreadable_pages} — 판독 가능한 PDF를 올려 주세요`} tone="bad" />}</div>
          <p>{res.summary}</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px]">
              <thead className="bg-secondary text-left"><tr><th className="p-2">공고 문항</th><th className="p-2">평가기준·작성 요구사항과 출처</th><th className="p-2">초안 반영 위치</th><th className="p-2">검토 결과</th><th className="p-2">보완할 내용 (AI가 찾은 누락)</th><th className="p-2">붙여 넣을 수정 문장</th></tr></thead>
              <tbody>{res.rows.map((row, i) => (
                <tr key={i} className="border-t align-top">
                  <td className="p-2 font-semibold">{row.question}</td>
                  <td className="p-2">{row.criteria}<div className="text-xs text-muted-foreground">{row.criteria_source}</div></td>
                  <td className="p-2">{row.draft_location}</td>
                  <td className="p-2"><StatusBadge label={row.result} /></td>
                  <td className="p-2">{row.gap}</td>
                  <td className="p-2">
                    <p className="whitespace-pre-wrap">{row.suggestion}</p>
                    <Button variant="outline" size="sm" className="mt-2" onClick={() => copy(row.suggestion)}><Copy aria-hidden />복사</Button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <section className="rounded-md border border-gold/50 p-3">
            <h3 className="mb-2 font-bold">실장이 확인할 사실</h3>
            <ul className="list-disc space-y-1 pl-5">{res.manager_checks.map((c, i) => <li key={i}>{c}</li>)}</ul>
          </section>
        </>
      )}
    </div>
  );
}
