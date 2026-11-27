import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { PageHeader, Panel } from "@/components/app/ui";
import { SampleCompetitorProducts } from "@/components/app/SampleCompetitorProducts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useMe } from "@/hooks/use-auth";
import {
  competitorProfileSchema,
  defaultCompetitorProfile,
  rankCompetitors,
} from "@/lib/competitors";
import { getEscoCompanies } from "@/lib/esco.functions";

export const Route = createFileRoute("/_authenticated/competitors")({
  head: () => ({ meta: [{ title: "경쟁제품 · 에너인프라 경영비서" }] }),
  component: CompetitorsPage,
});

const pageSize = 5;
const profileFields = [
  { key: "industry", label: "업종", maxLength: 100 },
  { key: "region", label: "지역", maxLength: 100 },
  { key: "years", label: "업력 (년)", maxLength: 10, inputMode: "decimal" },
  { key: "revenue", label: "연 매출 규모 (원)", maxLength: 16, inputMode: "numeric" },
  { key: "product", label: "제품명", maxLength: 150 },
] as const;

function CompetitorsPage() {
  const { session } = useMe();
  return session ? <Competitors key={session.user.id} userId={session.user.id} /> : null;
}

function Competitors({ userId }: { userId: string }) {
  const storageKey = `enerinfra:competitor-profile:${userId}`;
  const [saved, setSaved] = useState(() => {
    try {
      const result = competitorProfileSchema.safeParse(
        JSON.parse(localStorage.getItem(storageKey) ?? "null"),
      );
      return result.success ? result.data : defaultCompetitorProfile;
    } catch {
      return defaultCompetitorProfile;
    }
  });
  const [draft, setDraft] = useState(saved);
  const [message, setMessage] = useState("");
  const [format, setFormat] = useState<"json" | "xml">("json");
  const [page, setPage] = useState(1);
  const listStart = useRef<HTMLHeadingElement>(null);
  const fetchCompanies = useServerFn(getEscoCompanies);
  const query = useQuery({
    queryKey: ["esco-companies", userId, format],
    queryFn: () => fetchCompanies({ data: { format } }),
    staleTime: 20 * 60_000,
    retry: false,
  });
  const ranked = rankCompetitors(query.data?.companies ?? [], saved);
  const pageCount = Math.ceil(ranked.length / pageSize);
  const current = Math.min(page, Math.max(1, pageCount));
  const offset = (current - 1) * pageSize;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="경쟁제품" desc="가상 유사제품 검색과 한국에너지공단 ESCO 등록업체 조회" />
      <SampleCompetitorProducts />
      <Panel title="내 조건" accent="primary">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const result = competitorProfileSchema.safeParse(draft);
            if (!result.success) {
              setMessage("업력은 연 단위 숫자, 연 매출은 쉼표 없이 원 단위 숫자로 입력해 주세요.");
              return;
            }
            try {
              localStorage.setItem(storageKey, JSON.stringify(result.data));
              setSaved(result.data);
              setPage(1);
              setMessage("이 브라우저에 회사 조건을 저장했습니다.");
            } catch {
              setMessage("브라우저에 회사 조건을 저장하지 못했습니다.");
            }
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {profileFields.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={`competitor-${field.key}`}>{field.label}</Label>
                <Input
                  id={`competitor-${field.key}`}
                  maxLength={field.maxLength}
                  inputMode={"inputMode" in field ? field.inputMode : "text"}
                  value={draft[field.key]}
                  onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })}
                />
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor="competitor-description">제품설명</Label>
            <Textarea
              id="competitor-description"
              value={draft.description}
              maxLength={1500}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit">조건 저장</Button>
            <p role="status" className="text-sm text-muted-foreground">
              {message}
            </p>
          </div>
        </form>
      </Panel>
      <section aria-labelledby="competitor-results" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="competitor-results" ref={listStart} className="scroll-mt-24 font-bold">
            유사 업체·제품 {query.data ? `· ${ranked.length}건` : ""}
          </h2>
          <div className="flex items-center gap-2">
            <Tabs
              value={format}
              onValueChange={(value) => {
                if (value === "json" || value === "xml") {
                  setFormat(value);
                  setPage(1);
                }
              }}
            >
              <TabsList aria-label="데이터 형식">
                <TabsTrigger value="json">JSON</TabsTrigger>
                <TabsTrigger value="xml">XML</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button
              size="sm"
              variant="outline"
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
            >
              다시 조회
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          공개 제품·사업 정보와 회사 조건을 비교합니다. 공개되지 않은 항목은 유사도 계산에서
          제외합니다.
        </p>
        {query.isPending ? (
          <p role="status" className="text-sm text-muted-foreground">
            ESCO 등록업체를 불러오는 중…
          </p>
        ) : query.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {query.error.message}
          </p>
        ) : (
          <>
            {!query.data.complete && (
              <p role="status" className="text-sm text-warning">
                조회된 일부 업체만 표시합니다.
              </p>
            )}
            {ranked.length === 0 ? (
              <p className="text-sm text-muted-foreground">표시할 등록업체가 없습니다.</p>
            ) : (
              <ol start={offset + 1} className="list-decimal space-y-3 pl-6">
                {ranked.slice(offset, offset + pageSize).map((company) => (
                  <li key={JSON.stringify(company)} className="rounded-lg border bg-card p-4">
                    <h3 className="font-bold">{company.product || company.name}</h3>
                    {company.product && (
                      <p className="text-sm text-muted-foreground">{company.name}</p>
                    )}
                    <p className="mt-2 text-sm">
                      {company.description || "공개 제품·사업 설명 없음"}
                    </p>
                    {[company.industry, company.region, company.years, company.revenue].some(
                      Boolean,
                    ) && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {[company.industry, company.region, company.years, company.revenue]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                    <p className="mt-2 text-sm font-medium">
                      {company.reasons.length
                        ? company.reasons.join(" · ")
                        : "공개 정보에서 유사성을 확인하지 못했습니다."}
                    </p>
                  </li>
                ))}
              </ol>
            )}
            {pageCount > 1 && (
              <nav
                aria-label="경쟁제품 목록 페이지"
                className="flex flex-wrap justify-center gap-2"
              >
                {Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => (
                  <Button
                    key={number}
                    size="sm"
                    variant={number === current ? "default" : "outline"}
                    aria-current={number === current ? "page" : undefined}
                    aria-label={`${number}페이지`}
                    onClick={() => {
                      setPage(number);
                      listStart.current?.scrollIntoView({ block: "start" });
                    }}
                  >
                    {number}
                  </Button>
                ))}
              </nav>
            )}
          </>
        )}
      </section>
    </div>
  );
}
