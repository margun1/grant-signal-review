import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, MessageSquare, Package, Users, ListChecks, FileSearch } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { YouTubeIntro } from "@/components/app/YouTubeIntro";
import { PageHeader, Panel, StatusBadge, kstDate, todayKst } from "@/components/app/ui";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "경영현황 · 주식회사 에너인프라의 경영비서" }, { name: "description", content: "오늘 처리할 일과 경영 실적" }] }),
  component: Dashboard,
});

function addDays(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function Dashboard() {
  const today = todayKst();
  const { data: due = [] } = useQuery({
    queryKey: ["due", today],
    queryFn: async () => {
      const { data } = await supabase.from("announcements").select("id,title,url,deadline,status,fit_level")
        .gte("deadline", today).lte("deadline", addDays(today, 14)).in("status", ["검토 중", "진행"]).order("deadline");
      return data ?? [];
    },
  });
  const pending = [
    { icon: MessageSquare, label: "미답변 고객문의" },
    { icon: Package, label: "부족 재고" },
    { icon: Users, label: "미확정 미팅 요청" },
    { icon: ListChecks, label: "오늘 일정·체크리스트" },
  ];
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="경영현황" desc={`오늘 ${kstDate(new Date())} (한국 시간)`} />
      <YouTubeIntro />
      <Panel title="오늘 처리할 일" accent="primary">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-md border p-4 lg:col-span-1">
            <div className="mb-2 flex items-center gap-2 font-semibold"><CalendarClock className="size-4 text-taupe" aria-hidden />마감 임박 지원사업 (14일 이내)</div>
            {due.length === 0 ? <p className="text-sm text-muted-foreground">마감 임박 공고가 없습니다.</p> : (
              <ul className="space-y-2">
                {due.map((a) => (
                  <li key={a.id}>
                    <Link to="/announcements/$id" params={{ id: a.id }} className="flex items-center justify-between gap-2 text-sm hover:underline">
                      <span className="truncate">{a.title ?? a.url}</span>
                      <span className="shrink-0 tabular-nums">{a.deadline}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/announcements" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold underline"><FileSearch className="size-3.5" aria-hidden />공고 목록</Link>
          </div>
          {pending.map((p) => (
            <div key={p.label} className="rounded-md border border-dashed p-4">
              <div className="mb-2 flex items-center gap-2 font-semibold"><p.icon className="size-4 text-taupe" aria-hidden />{p.label}</div>
              <StatusBadge label="미연결" tone="info" />
              <p className="mt-2 text-xs text-muted-foreground">다음 단계에서 연결됩니다.</p>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="경영 실적" accent="gold">
        <p className="text-sm text-muted-foreground">매출·원가·재고 엑셀 업로드가 연결되면 최근 1일 / 3일 / 7일 실적이 여기에 표시됩니다.</p>
      </Panel>
    </div>
  );
}
