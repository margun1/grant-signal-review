import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search } from "lucide-react";
import { PageHeader, Panel } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { samplePowerboardParts } from "@/lib/sample-powerboard-parts";

export const Route = createFileRoute("/_authenticated/powerboard_/parts")({
  head: () => ({ meta: [{ title: "POWERBOARD 부품찾기 · 주식회사 에너인프라" }] }),
  component: PowerboardPartsPage,
});

const categories = ["전체", ...new Set(samplePowerboardParts.map((part) => part.category))];
const normalize = (text: string) => text.normalize("NFKC").toLowerCase().replace(/[\s-]+/g, "");
const priceFormat = new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" });

function PowerboardPartsPage() {
  const [category, setCategory] = useState("전체");
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const rows = samplePowerboardParts.filter((part) =>
    (category === "전체" || category === part.category) &&
    [part.name, part.code, part.description].some((field) => normalize(field).includes(query)),
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="POWERBOARD 부품찾기" desc="시연용 가상 부품 목록과 개당 예시 단가입니다." />
      <Panel title="부품 검색">
        <div role="group" aria-label="부품 카테고리" className="mb-4 flex flex-wrap gap-2">
          {categories.map((name) => (
            <Button key={name} type="button" variant={category === name ? "default" : "outline"}
              aria-pressed={category === name} onClick={() => setCategory(name)}>{name}</Button>
          ))}
        </div>
        <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); setQuery(normalize(input)); }}>
          <Input aria-label="부품명 또는 품번" placeholder="부품명 또는 품번 입력" value={input}
            onChange={(event) => setInput(event.target.value)} />
          <Button type="submit"><Search aria-hidden="true" />검색</Button>
        </form>
      </Panel>
      <Panel title="부품 목록" action={<span role="status" className="text-sm text-muted-foreground">{rows.length}개</span>}>
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="bg-secondary">
                <tr>{["품번", "카테고리", "부품명", "용도", "가상 단가"].map((label) => (
                  <th key={label} scope="col" className="p-3 last:text-right">{label}</th>
                ))}</tr>
              </thead>
              <tbody>
                {rows.map((part) => (
                  <tr key={part.code} className="border-b last:border-b-0">
                    <td className="p-3 whitespace-nowrap">{part.code}</td>
                    <td className="p-3">{part.category}</td>
                    <th scope="row" className="p-3 font-medium">{part.name}</th>
                    <td className="p-3">{part.description}</td>
                    <td className="p-3 text-right whitespace-nowrap">{priceFormat.format(part.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="py-6 text-center text-sm text-muted-foreground">조건에 맞는 가상 부품이 없습니다.</p>}
      </Panel>
    </div>
  );
}
