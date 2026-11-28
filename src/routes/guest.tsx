import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, ArrowDown, Bot, Boxes } from "lucide-react";
import { guestGroups, guestPages, GuestWorkPage } from "@/components/app/GuestWorkPages";
import { Panel } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { filterPilot, summarizePilot } from "@/lib/powerboard";
import { sampleDronePilot, summarizeDronePilot } from "@/lib/sample-drone-pilot";
import { sampleInventoryItems, sampleInventorySnaps } from "@/lib/sample-inventory";

export const Route = createFileRoute("/guest")({
  head: () => ({
    meta: [
      { title: "심사용 미리보기 · 에너인프라 경영비서" },
      { name: "description", content: "에너인프라 회사소개와 경영비서 데모를 로그인 없이 둘러볼 수 있습니다." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    page: guestPages.find(([id]) => id === search.page)?.[0] ?? "company",
  }),
  component: GuestPage,
});

const powerboard = summarizePilot(filterPilot("전체", "전체"));
const drone = summarizeDronePilot(sampleDronePilot);
const inventoryDate = sampleInventorySnaps.at(-1)?.as_of;
const inventory = sampleInventorySnaps.filter((row) => row.as_of === inventoryDate);
const format = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 });
const percent = (value: number | null) => value === null ? "기록 없음" : `${format.format(value)}%`;

function GuestPage() {
  const { page } = Route.useSearch();
  const title = guestPages.find(([id]) => id === page)?.[1];
  return (
    <div className="min-h-screen">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <img src="/enerinfra-logo.png" alt="ENERINFRA" width={986} height={170} className="h-auto w-36" />
          <Button asChild variant="outline" size="sm"><Link to="/auth">직원 로그인</Link></Button>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <nav aria-label="심사용 전체 메뉴" className="space-y-4 self-start rounded-xl border bg-card p-3">
          {guestGroups.map(({ title, pages }) => (
            <div key={title}>
              <p className="mb-1 px-2 text-xs font-semibold text-muted-foreground">{title}</p>
              <ul className="flex flex-wrap gap-1 lg:flex-col">
                {pages.map(([id, label]) => (
                  <li key={id}>
                    <Link to="/guest" search={{ page: id }} aria-current={page === id ? "page" : undefined}
                      className={`block rounded-md px-2 py-2 text-sm hover:bg-accent ${page === id ? "bg-accent font-bold" : ""}`}>
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <main className="min-w-0 space-y-6">
          {page !== "company" && (
            <div>
              <h1 className="text-2xl font-bold">{title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">심사용 읽기 전용 화면</p>
            </div>
          )}
        {page === "company" && (
        <section aria-labelledby="guest-title" className="grid overflow-hidden rounded-3xl border bg-card lg:grid-cols-[1fr_1fr]">
          <div className="flex flex-col justify-center p-6 sm:p-9">
            <p className="text-sm font-semibold text-gold">심사용 게스트 모드</p>
            <h1 id="guest-title" className="mt-2 break-keep text-3xl font-extrabold tracking-tight sm:text-4xl">
              에너인프라 경영비서
            </h1>
            <p className="mt-4 max-w-prose break-keep leading-relaxed text-muted-foreground">
              주식회사 에너인프라는 기존 건물의 전기 사용량을 실시간으로 보여주는 POWERBOARD를 개발합니다.
              경영비서의 업무 브리핑, 제품 실증, 재고 관리 화면을 시연용 데이터로 둘러보세요.
            </p>
            <nav aria-label="심사 화면 바로가기" className="mt-6 flex flex-wrap gap-2">
              <Button asChild><Link to="/guest" search={{ page: "assistant" }}>AI 비서 <ArrowDown aria-hidden="true" /></Link></Button>
              <Button asChild variant="outline"><Link to="/guest" search={{ page: "powerboard" }}>제품 실증</Link></Button>
              <Button asChild variant="outline"><Link to="/guest" search={{ page: "inventory" }}>재고·발주</Link></Button>
            </nav>
          </div>
          <img src="/powerboard-family.jpg" alt="POWERBOARD 전력 사용량 화면을 함께 보는 아이와 보호자"
            width={1305} height={860} className="h-full w-full object-cover" />
        </section>

        )}
        {(page === "assistant") && (
        <section id="guest-briefing" className="scroll-mt-5 space-y-3" aria-labelledby="guest-briefing-title">
          <h2 id="guest-briefing-title" className="flex items-center gap-2 text-xl font-bold">
            <Bot aria-hidden="true" className="size-5" />AI 비서 · 오늘의 브리핑 예시
          </h2>
          <div className="grid gap-3 md:grid-cols-3">
            <Panel title="오늘의 할 일"><p className="text-sm">POWERBOARD 계측 누락 확인 및 드론 예비 부품 재고 점검</p></Panel>
            <Panel title="이번 주 미팅 일정"><p className="text-sm">수요일 14:00 · 교육용 드론 실증 준비 회의</p></Panel>
            <Panel title="이번 주 지원사업"><p className="text-sm">에너지 절감 실증 지원 공고의 대상과 제출 서류 확인</p></Panel>
          </div>
        </section>

        )}
        {(page === "powerboard" || page === "drone") && (
        <section id="guest-pilot" className="scroll-mt-5 space-y-3" aria-labelledby="guest-pilot-title">
          <h2 id="guest-pilot-title" className="flex items-center gap-2 text-xl font-bold">
            <Activity aria-hidden="true" className="size-5" />제품 실증 · 가상 데이터
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {page === "powerboard" && <Panel title="POWERBOARD">
              <dl className="grid grid-cols-2 gap-3">
                <Metric label="가상 설치처" value={`${powerboard.sites}곳`} />
                <Metric label="유효 수집률" value={percent(powerboard.collection)} />
                <Metric label="보정 사용량 절감률" value={percent(powerboard.saving)} />
              </dl>
            </Panel>}
            {page === "drone" && <Panel title="교육용 드론">
              <dl className="grid grid-cols-2 gap-3">
                <Metric label="가상 시험" value={`${drone.attempts}회`} />
                <Metric label="정상 완료율" value={percent(drone.completion)} />
                <Metric label="평균 비행 시간" value={`${format.format(drone.averageMinutes)}분`} />
              </dl>
            </Panel>}
          </div>
        </section>

        )}
        {(page === "inventory") && (
        <section id="guest-stock" className="scroll-mt-5 space-y-3" aria-labelledby="guest-stock-title">
          <h2 id="guest-stock-title" className="flex items-center gap-2 text-xl font-bold">
            <Boxes aria-hidden="true" className="size-5" />재고·발주 · 가상 데이터
          </h2>
          <Panel title="품목별 재고 예시">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[25rem] text-left text-sm">
                <thead className="bg-secondary">
                  <tr>{["품목", "현재 재고", "최소 재고", "상태"].map((label) => <th key={label} scope="col" className="p-2">{label}</th>)}</tr>
                </thead>
                <tbody>
                  {inventory.map((row) => {
                    const minimum = sampleInventoryItems.find(({ name }) => name === row.item)?.min_stock ?? 0;
                    return (
                      <tr key={row.item} className="border-t">
                        <th scope="row" className="p-2 font-medium">{row.item}</th>
                        <td className="p-2">{row.quantity}개</td><td className="p-2">{minimum}개</td>
                        <td className="p-2">{row.quantity < minimum ? "부족" : "정상"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        </section>
        )}
          <GuestWorkPage page={page} />
        </main>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-lg font-bold">{value}</dd>
    </div>
  );
}
