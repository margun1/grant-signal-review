import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useRef, useState } from "react";
import { PageHeader, Panel } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { won } from "@/lib/biz";
import { sampleDroneParts } from "@/lib/sample-drone-parts";

export const Route = createFileRoute("/_authenticated/drone")({
  head: () => ({ meta: [{ title: "드론 · 에너인프라 경영비서" }] }),
  component: DronePage,
});

const partNames = [...new Set(sampleDroneParts.map(([, , name]) => name))];

function DronePage() {
  const [query, setQuery] = useState("");
  const [selectedPart, setSelectedPart] = useState<string | null>(null);
  const results = useRef<HTMLParagraphElement>(null);
  const keywords = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const compactQuery = keywords.join("");
  const parts = sampleDroneParts.filter((part) => {
    if (selectedPart !== null && part[2] !== selectedPart) return false;
    const text = part.join(" ").toLowerCase().replace(/\s+/g, "");
    return text.includes(compactQuery) || keywords.every((keyword) => text.includes(keyword));
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="드론" desc="드론 조립용 가상 부품 카탈로그" />
      <Panel title="부품 목록 및 가상 단가" accent="gold">
        <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
          <strong>가상 데이터 · 실제 제품 사양 및 구매 단가 아님</strong>
          <p className="mt-1">
            51개 부품 유형 · {sampleDroneParts.length}개 가상 모델. 규격·재고·보관 위치는
            시연용이며, 모델 조합의 호환성은 확인되지 않았습니다. 재고 금액은 모델별 재고 ×
            단가입니다.
          </p>
        </div>

        <fieldset className="mt-4">
          <legend className="mb-2 text-sm font-semibold">부품명으로 보기</legend>
          <div className="flex max-h-56 flex-wrap content-start gap-2 overflow-y-auto rounded-md border p-2">
            {[null, ...partNames].map((name) => (
              <Button
                key={name ?? "all"}
                type="button"
                size="sm"
                variant={selectedPart === name ? "default" : "outline"}
                aria-pressed={selectedPart === name}
                className="h-auto min-h-8 whitespace-normal text-left"
                onClick={() => {
                  setSelectedPart(name);
                  setQuery("");
                }}
              >
                {name ?? "전체"}
              </Button>
            ))}
          </div>
        </fieldset>

        <form
          role="search"
          className="mt-4 max-w-md space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            results.current?.focus();
          }}
        >
          <Label htmlFor="drone-parts-search">부품 찾기</Label>
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="drone-parts-search"
                type="search"
                placeholder="부품명, 모델명, 번호, 규격 등 (예: 프레임키트)"
                className="pl-9"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <Button type="submit">검색</Button>
          </div>
        </form>
        <p ref={results} role="status" tabIndex={-1} className="mt-3 text-sm text-muted-foreground">
          전체 {sampleDroneParts.length}개 중 {parts.length}개 표시
        </p>

        {parts.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">검색어와 일치하는 부품이 없습니다.</p>
        ) : (
          <div
            className="mt-3 max-h-[65dvh] overflow-auto rounded-md border"
            tabIndex={0}
            aria-label="드론 부품 표"
          >
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-secondary text-left">
                <tr>
                  {[
                    "부품 번호",
                    "카테고리",
                    "부품명",
                    "가상 모델명",
                    "필요 구분",
                    "가상 규격",
                    "조립 참고 수량",
                    "단위",
                    "가상 재고",
                    "가상 단가",
                    "재고 금액",
                    "호환 확인 사항",
                    "가상 보관 위치",
                    "원본 유형 번호",
                  ].map((label) => (
                    <th key={label} scope="col" className="whitespace-nowrap p-2">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parts.map(
                  ([
                    id,
                    category,
                    name,
                    model,
                    requirement,
                    specification,
                    quantity,
                    unit,
                    stock,
                    unitPrice,
                    stockValue,
                    compatibility,
                    ,
                    ,
                    location,
                    partType,
                  ]) => (
                    <tr key={id} className="border-t bg-card align-top">
                      <td className="whitespace-nowrap p-2">{id}</td>
                      <td className="whitespace-nowrap p-2">{category}</td>
                      <th scope="row" className="min-w-36 p-2 text-left font-medium">
                        {name}
                      </th>
                      <td className="whitespace-nowrap p-2">{model}</td>
                      <td className="whitespace-nowrap p-2">{requirement}</td>
                      <td className="min-w-52 p-2">{specification}</td>
                      <td className="whitespace-nowrap p-2">{quantity}</td>
                      <td className="whitespace-nowrap p-2">{unit}</td>
                      <td className="whitespace-nowrap p-2 text-right">
                        {stock.toLocaleString("ko-KR")}
                      </td>
                      <td className="whitespace-nowrap p-2 text-right">{won(unitPrice)}</td>
                      <td className="whitespace-nowrap p-2 text-right">{won(stockValue)}</td>
                      <td className="min-w-48 p-2">{compatibility}</td>
                      <td className="whitespace-nowrap p-2">{location}</td>
                      <td className="whitespace-nowrap p-2">{partType}</td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
