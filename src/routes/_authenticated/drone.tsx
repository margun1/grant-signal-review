import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useState } from "react";
import { PageHeader, Panel } from "@/components/app/ui";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { won } from "@/lib/biz";
import { sampleDroneParts, sampleDronePartsTotal } from "@/lib/sample-drone-parts";

export const Route = createFileRoute("/_authenticated/drone")({
  head: () => ({ meta: [{ title: "드론 · 에너인프라 경영비서" }] }),
  component: DronePage,
});

function DronePage() {
  const [query, setQuery] = useState("");
  const keywords = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const parts = sampleDroneParts.filter(([, category, name]) => {
    const text = `${category} ${name}`.toLowerCase();
    return keywords.every((keyword) => text.includes(keyword));
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title="드론" desc="교육용 카메라 드론 1대 기준 부품 명세서" />
      <Panel title="부품 목록 및 가상 단가" accent="gold">
        <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
          <strong>가상 데이터 · 실제 제품 사양 및 구매 단가 아님</strong>
          <p className="mt-1">
            전체 {sampleDroneParts.length}개 품목 · 1대분 자재비 {won(sampleDronePartsTotal)} ·
            부가세, 조립 인건비, 검사비 및 배송비 제외
          </p>
        </div>

        <div className="mt-4 max-w-md space-y-2">
          <Label htmlFor="drone-parts-search">부품 찾기</Label>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="drone-parts-search"
              type="search"
              placeholder="부품명 또는 분류 (예: 모터, 카메라, ESC)"
              className="pl-9"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>
        <p role="status" className="mt-3 text-sm text-muted-foreground">
          전체 {sampleDroneParts.length}개 중 {parts.length}개 표시
        </p>

        {parts.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">검색어와 일치하는 부품이 없습니다.</p>
        ) : (
          <div
            className="mt-3 overflow-x-auto rounded-md border"
            tabIndex={0}
            aria-label="드론 부품 표"
          >
            <table className="w-full whitespace-nowrap text-sm">
              <thead className="bg-secondary text-left">
                <tr>
                  <th scope="col" className="p-2">
                    번호
                  </th>
                  <th scope="col" className="p-2">
                    분류
                  </th>
                  <th scope="col" className="p-2">
                    부품명
                  </th>
                  <th scope="col" className="p-2 text-right">
                    1대당 수량
                  </th>
                  <th scope="col" className="p-2 text-right">
                    단가
                  </th>
                  <th scope="col" className="p-2 text-right">
                    소계
                  </th>
                </tr>
              </thead>
              <tbody>
                {parts.map(([id, category, name, unit, quantity, unitPrice]) => (
                  <tr key={id} className="border-t">
                    <td className="p-2">{id}</td>
                    <td className="p-2">{category}</td>
                    <th scope="row" className="p-2 text-left font-medium">
                      {name}
                    </th>
                    <td className="p-2 text-right">
                      {quantity}
                      {unit}
                    </td>
                    <td className="p-2 text-right">{won(unitPrice)}</td>
                    <td className="p-2 text-right">{won(quantity * unitPrice)}</td>
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
