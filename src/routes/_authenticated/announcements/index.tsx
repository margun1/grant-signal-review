import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FilePlus2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, StatusBadge, kst } from "@/components/app/ui";

export const Route = createFileRoute("/_authenticated/announcements/")({
  head: () => ({ meta: [{ title: "지원사업 공고 · 주식회사 에너인프라의 경영비서" }, { name: "description", content: "정부지원사업 공고 목록" }] }),
  component: List,
});

function List() {
  const { data = [], isLoading } = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => (await supabase.from("announcements").select("id,url,title,organizer,deadline,fit_level,status,status_updated_at,analysis_status,created_at").order("created_at", { ascending: false })).data ?? [],
  });
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="지원사업 공고" desc="분석한 공고와 대표님 확인 결과" action={<Button asChild><Link to="/announcements/new"><FilePlus2 aria-hidden />새 공고 분석</Link></Button>} />
      <Panel>
        {isLoading ? <p className="text-sm text-muted-foreground">불러오는 중…</p> : data.length === 0 ? (
          <p className="text-sm text-muted-foreground">아직 분석한 공고가 없습니다. ‘새 공고 분석’에서 공고 링크를 입력해 주세요.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-secondary text-left">
                <tr><th className="p-3">사업명</th><th className="p-3">주관기관</th><th className="p-3">마감</th><th className="p-3">적합성</th><th className="p-3">진행 상태</th><th className="p-3">등록</th></tr>
              </thead>
              <tbody>
                {data.map((a) => (
                  <tr key={a.id} className="border-t hover:bg-accent/50">
                    <td className="p-3"><Link to="/announcements/$id" params={{ id: a.id }} className="font-semibold underline-offset-4 hover:underline">{a.title ?? a.url}</Link></td>
                    <td className="p-3">{a.organizer ?? "—"}</td>
                    <td className="p-3 tabular-nums">{a.deadline ?? "확인 필요"}</td>
                    <td className="p-3">{a.analysis_status === "done" && a.fit_level ? <StatusBadge label={a.fit_level} /> : <StatusBadge label={a.analysis_status === "failed" ? "분석 실패" : a.analysis_status === "running" ? "분석 중" : "분석 대기"} tone={a.analysis_status === "failed" ? "bad" : a.analysis_status === "running" ? "busy" : "info"} />}</td>
                    <td className="p-3"><StatusBadge label={a.status} /></td>
                    <td className="p-3 text-muted-foreground">{kst(a.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
