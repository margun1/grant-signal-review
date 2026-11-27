import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/app/ui";

const products = [
  { company: "가상업체 A", name: "홈 와트뷰", category: "전력 모니터링", description: "기존 주택의 회로별 전력 사용량을 실시간으로 확인하고 과다 사용 알림을 받는 계측기." },
  { company: "가상업체 B", name: "빌딩 미터링 허브", category: "전력 모니터링", description: "상업용 건물의 층별 전력 데이터를 한 화면에서 비교하고 월별 내역을 내보내는 장치." },
  { company: "가상업체 C", name: "세대 에너지 보드", category: "전력 모니터링", description: "공동주택 세대별 사용량과 공용부 전력 추이를 조회하는 관리용 대시보드." },
  { company: "가상업체 D", name: "피크 알림 센서", category: "에너지 절감", description: "소형 매장에서 전력 사용량이 설정한 한도를 넘을 때 담당자에게 알리는 센서." },
  { company: "가상업체 E", name: "운영 시간 리포터", category: "에너지 절감", description: "설비 가동 시간을 비교해 영업 종료 후에도 전기를 쓰는 설비를 찾는 분석 도구." },
  { company: "가상업체 F", name: "전력·탄소 리포트", category: "탄소 관리", description: "시설의 월별 전력 사용량을 바탕으로 운영 과정의 탄소배출량을 추정하는 서비스." },
  { company: "가상업체 G", name: "학교 에너지 트래커", category: "에너지 절감", description: "학교의 교실별 소비전력과 방학 중 대기전력 추이를 비교하는 도구." },
  { company: "가상업체 H", name: "드론 실내 실습 키트", category: "교육용 드론", description: "학교와 교육기관의 기초 조종 실습을 위한 교육용 기체와 수업 자료." },
  { company: "가상업체 I", name: "모듈 조립 드론 세트", category: "교육용 드론", description: "프레임과 프로펠러 가드를 교체하며 부품 역할을 배우는 조립 실습 세트." },
  { company: "가상업체 J", name: "드론 교실 관리 보드", category: "교육용 드론", description: "수업별 비행 기록과 기체 점검 주기, 예비 부품 목록을 관리하는 교사용 도구." },
];
const categories = ["전체", ...new Set(products.map(({ category }) => category))];
const pageSize = 5;
const normalize = (text: string) => text.normalize("NFKC").toLowerCase().replace(/\s+/g, "");

export function SampleCompetitorProducts() {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("전체");
  const [page, setPage] = useState(1);
  const results = products.filter((product) =>
    (category === "전체" || category === product.category) &&
    Object.values(product).some((value) => normalize(value).includes(query)),
  );
  const pages = Math.ceil(results.length / pageSize);

  return (
    <Panel title="가상 유사업체 제품 검색" accent="primary">
      <p className="mb-4 text-sm text-muted-foreground">업체명, 제품명, 기능은 모두 비교 시연을 위한 가상 예시입니다.</p>
      <div role="group" aria-label="제품 분야" className="mb-3 flex flex-wrap gap-2">
        {categories.map((value) => (
          <Button key={value} type="button" size="sm" variant={category === value ? "default" : "outline"}
            aria-pressed={category === value} onClick={() => { setCategory(value); setPage(1); }}>{value}</Button>
        ))}
      </div>
      <form role="search" aria-label="가상 유사제품 검색" className="flex gap-2"
        onSubmit={(event) => { event.preventDefault(); setQuery(normalize(input)); setPage(1); }}>
        <Input type="search" aria-label="업체명, 제품명 또는 기능" placeholder="업체명, 제품명 또는 기능"
          value={input} onChange={(event) => setInput(event.target.value)} />
        <Button type="submit"><Search aria-hidden="true" />검색</Button>
      </form>
      <p role="status" className="mt-3 text-sm text-muted-foreground">검색 결과 {results.length}건</p>
      {results.length ? (
        <ul className="mt-2 divide-y">
          {results.slice((page - 1) * pageSize, page * pageSize).map((product) => (
            <li key={product.name} className="space-y-1 py-3">
              <p className="text-xs font-medium text-muted-foreground">{product.company} · {product.category}</p>
              <h3 className="font-semibold">{product.name}</h3>
              <p className="text-sm">{product.description}</p>
            </li>
          ))}
        </ul>
      ) : <p className="py-4 text-sm">검색 조건에 맞는 가상 제품이 없습니다.</p>}
      {pages > 1 && (
        <nav aria-label="가상 제품 검색 결과 페이지" className="mt-3 flex justify-center gap-2">
          {Array.from({ length: pages }, (_, index) => index + 1).map((number) => (
            <Button key={number} type="button" size="sm" variant={page === number ? "default" : "outline"}
              aria-current={page === number ? "page" : undefined} onClick={() => setPage(number)}>{number}</Button>
          ))}
        </nav>
      )}
    </Panel>
  );
}
