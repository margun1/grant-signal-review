import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ExternalLink, Save, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/app/ui";
import { saveSupportPreferences } from "@/lib/support.functions";
import { supportPreferencesOptions, useSupportRecommendations } from "@/lib/support.queries";
import { INTERESTS, preferencesSchema } from "@/lib/support";

export const Route = createFileRoute("/_authenticated/support")({
  loader: ({ context }) => context.queryClient.ensureQueryData(supportPreferencesOptions),
  head: () => ({
    meta: [
      { title: "지원사업 추천 · 에너인프라 경영비서" },
      { name: "description", content: "저장한 회사 조건에 맞는 K-Startup 접수 중 지원사업 추천" },
      { property: "og:title", content: "지원사업 추천 · 에너인프라" },
      {
        property: "og:description",
        content: "업종·지역·업력·매출·관심 분야별 접수 중 공고와 원문",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SupportPage,
});
function SupportPage() {
  const { data: saved } = useSuspenseQuery(supportPreferencesOptions);
  const [prefs, setPrefs] = useState(saved);
  const [format, setFormat] = useState<"json" | "xml">("json");
  const qc = useQueryClient();
  const save = useServerFn(saveSupportPreferences);
  const results = useSupportRecommendations(saved, format);
  const mutation = useMutation({
    mutationFn: () => save({ data: preferencesSchema.parse(prefs) }),
    onSuccess: () => {
      qc.setQueryData(supportPreferencesOptions.queryKey, prefs);
      void qc.invalidateQueries({ queryKey: ["support-recommendations"] });
      toast.success("조건을 저장했습니다.");
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="지원사업" desc="K-Startup · 접수 중 공고" />
      <form
        className="space-y-4 border-y py-5"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <h2 className="font-bold">내 회사 조건</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="industry">업종</Label>
            <Input
              id="industry"
              value={prefs.industry}
              maxLength={80}
              onChange={(e) => setPrefs({ ...prefs, industry: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="support-region">지역</Label>
            <Input
              id="support-region"
              value={prefs.region}
              maxLength={100}
              onChange={(e) => setPrefs({ ...prefs, region: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="business-years">업력 (년)</Label>
            <Input
              id="business-years"
              type="number"
              step="0.1"
              min="0"
              max="200"
              value={prefs.business_years ?? ""}
              placeholder="확인 필요"
              onChange={(e) =>
                setPrefs({
                  ...prefs,
                  business_years: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="annual-revenue">연 매출 규모 (원)</Label>
            <Input
              id="annual-revenue"
              type="number"
              step="1"
              min="0"
              max="1000000000000000"
              value={prefs.annual_revenue ?? ""}
              placeholder="확인 필요"
              onChange={(e) =>
                setPrefs({
                  ...prefs,
                  annual_revenue: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-5">
          <span className="text-sm font-medium">관심 분야</span>
          {INTERESTS.map((i) => (
            <label key={i} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={prefs.interests.includes(i)}
                onCheckedChange={(checked) =>
                  setPrefs({
                    ...prefs,
                    interests:
                      checked === true
                        ? [...new Set([...prefs.interests, i])]
                        : prefs.interests.filter((x) => x !== i),
                  })
                }
              />
              {i}
            </label>
          ))}
          <Button type="submit" className="sm:ml-auto" disabled={mutation.isPending}>
            <Save />
            조건 저장
          </Button>
        </div>
      </form>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold">추천 공고 {results.data?.recommendations.length ?? ""}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            매일 오전 10시 · 오후 2시 갱신 (한국 시간)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs
            value={format}
            onValueChange={(v) => {
              if (v === "json" || v === "xml") setFormat(v);
            }}
          >
            <TabsList aria-label="데이터 형식">
              <TabsTrigger value="json">JSON</TabsTrigger>
              <TabsTrigger value="xml">XML</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button
            variant="outline"
            size="icon"
            title="공고 다시 조회"
            aria-label="공고 다시 조회"
            disabled={results.isFetching}
            onClick={() => void results.refetch()}
          >
            <RefreshCw className={results.isFetching ? "animate-spin" : ""} />
          </Button>
        </div>
      </div>
      {results.isPending ? (
        <p role="status" className="text-muted-foreground">
          접수 중 공고를 불러오는 중…
        </p>
      ) : results.error ? (
        <p role="alert" className="text-destructive">
          {results.error.message}
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {results.data?.scheduled ? "정기 갱신" : "실시간 조회"}{" "}
            {results.data?.fetchedAt
              ? new Date(results.data.fetchedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })
              : "—"}{" "}
            · {results.data?.checkedCount}개 모집 중 자료 확인
            {results.data?.complete === false ? " · 일부 자료만 조회됨" : ""}
          </p>
          <ol className="space-y-3">
            {results.data?.recommendations.map((n, i) => (
              <li key={n.id || n.url} className="rounded-lg border bg-card p-4 sm:p-5">
                <div className="flex gap-3">
                  <span className="text-xl font-bold text-gold">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold leading-relaxed">{n.title}</h3>
                    <p className="mt-2 text-sm">{n.reason}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {n.field || "분야 확인 필요"} · {n.region || "지역 확인 필요"}
                    </p>
                    <p className="mt-2 text-xs text-warning">확인 필요: {n.missing.join(" · ")}</p>
                    <a
                      href={n.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-1 text-sm font-semibold underline"
                    >
                      공고 원문
                      <ExternalLink className="size-3.5" />
                    </a>
                  </div>
                </div>
              </li>
            ))}
          </ol>
          {results.data?.recommendations.length === 0 && (
            <p className="py-4 text-muted-foreground">
              현재 조회된 자료에서 조건에 맞는 접수 중 공고가 없습니다.
            </p>
          )}
        </>
      )}
      <p className="border-t pt-4 text-sm text-muted-foreground">
        접수 기간과 지원 금액은 공고 원문에서 다시 확인하세요
      </p>
    </div>
  );
}
