import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Panel } from "@/components/app/ui";
import { Input } from "@/components/ui/input";
import { SampleSalesPanel } from "@/components/app/SampleSalesPanel";
import { SampleCompetitorProducts } from "@/components/app/SampleCompetitorProducts";
import { DroneEducationStatistics } from "@/components/app/DroneEducationStatistics";
import { samplePowerboardParts } from "@/lib/sample-powerboard-parts";
import { sampleDroneParts } from "@/lib/sample-drone-parts";
import { sampleCustomerInquiries } from "@/lib/sample-customer-inquiries";
import { samplePurchaseOrders } from "@/lib/sample-inventory";
import { sampleDronePilot } from "@/lib/sample-drone-pilot";
import { pilotSeries } from "@/lib/powerboard";

export const guestGroups = [
  { title: "회사·AI", pages: [["company", "회사소개"], ["assistant", "AI 비서"], ["reports", "AI 리포트"]] },
  { title: "경영·운영", pages: [["dashboard", "경영현황"], ["sales", "매출·상품"], ["inventory", "재고·발주"], ["profit", "수익성"], ["checklist", "체크리스트"], ["meetings", "미팅·일정"], ["support", "지원사업"], ["attendance", "출·퇴근 관리"], ["inquiries", "고객문의"]] },
  { title: "우리회사제품", pages: [["products", "우리회사제품"], ["powerboard", "POWERBOARD"], ["powerboard-parts", "POWERBOARD 부품찾기"], ["drone", "드론"], ["drone-parts", "드론 부품찾기"], ["competitors", "경쟁제품"], ["devices", "기기오류"]] },
  { title: "설정", pages: [["settings", "설정"], ["invites", "직원 초대 관리"]] },
] as const;

type GuestPage = (typeof guestGroups)[number]["pages"][number][0];
export const guestPages: readonly (readonly [GuestPage, string])[] = guestGroups.flatMap(
  ({ pages }): readonly (readonly [GuestPage, string])[] => pages,
);

const demos = {
  dashboard: {
    columns: ["오늘 처리할 일", "요약"],
    rows: [["오늘 일정·체크리스트", "실증 준비 회의 · 계측 누락 확인"], ["미확정 미팅 요청", "2건"], ["미답변 문의", "4건"], ["부족한 재고", "POWERBOARD 계측기 외 2종"]],
  },
  reports: {
    columns: ["항목", "주간 보고서 예시"],
    rows: [["매출", "POWERBOARD 판매 흐름 확인"], ["재고", "전류 센서와 교육용 드론 보충 검토"], ["고객문의", "문의 유형별 표준 답변 업데이트"]],
  },
  meetings: {
    columns: ["요일·시간", "구분", "일정"],
    rows: [["월 10:00", "내부회의", "주간 업무회의"], ["수 14:00", "확정미팅", "교육용 드론 실증 준비"], ["금 17:00", "지원사업 마감", "에너지 절감 실증 신청서 제출"]],
  },
  support: {
    columns: ["예시 공고", "추천 이유", "확인 필요"],
    rows: [["에너지 절감 실증 지원 예시", "전력 모니터링 장치 실증 분야와 관련", "지원 지역·업력"], ["하드웨어 시제품 고도화 예시", "시제품 검증과 성능 개선 분야에 해당", "매출 조건"], ["교육용 기술 보급 예시", "교육용 드론 운영 사례와 관련", "참여 기관 자격"]],
  },
  checklist: {
    columns: ["항목", "주기", "상태"],
    rows: [["POWERBOARD 계측 누락 확인", "매일", "진행 중"], ["미답변 문의 확인", "매일", "완료"], ["드론 부품 재고 점검", "매주 수요일", "예정"]],
  },
  attendance: {
    columns: ["날짜", "직원", "출근", "퇴근"],
    rows: [["2026-11-27", "예시 직원 A", "09:02", "18:01"], ["2026-11-27", "예시 직원 B", "08:56", "17:59"]],
  },
  devices: {
    columns: ["기기", "오류 유형", "상태"],
    rows: [["POWERBOARD", "실시간 계측값 갱신 지연", "해결중"], ["드론", "조종기 연결 불안정", "해결완료"]],
  },
  settings: {
    columns: ["외부 연동", "예시 상태"],
    rows: [["홈페이지 문의", "연결"], ["Google 캘린더", "확인 필요"], ["카카오톡 채널", "미설정"]],
  },
  invites: {
    columns: ["이메일", "역할", "상태"],
    rows: [["review-staff@example.com", "사원", "가입 완료"], ["review-lead@example.com", "팀장", "가입 대기"]],
  },
} satisfies Partial<Record<GuestPage, { columns: string[]; rows: string[][] }>>;

function DemoTable({ title, columns, rows }: {
  title: string;
  columns: readonly string[];
  rows: readonly (readonly (string | number)[])[];
}) {
  return (
    <Panel title={title}>
      <div className="max-h-96 overflow-auto">
        <table className="w-full min-w-[26rem] text-left text-sm">
          <thead className="sticky top-0 bg-secondary"><tr>{columns.map((column) => <th key={column} scope="col" className="p-3">{column}</th>)}</tr></thead>
          <tbody>{rows.map((row, index) => <tr key={index} className="border-t">
            {row.map((cell, cellIndex) => <td key={cellIndex} className="p-3">{cell}</td>)}
          </tr>)}</tbody>
        </table>
        {!rows.length && <p className="p-3 text-sm text-muted-foreground">검색 결과가 없습니다.</p>}
      </div>
    </Panel>
  );
}

function GuestParts({ drone }: { drone: boolean }) {
  const [query, setQuery] = useState("");
  const rows = drone
    ? sampleDroneParts.map(([id, category, name, model, , , , , , price]) => [id, category, name, model, price])
    : samplePowerboardParts.map(({ code, category, name, description, price }) => [code, category, name, description, price]);
  const keyword = query.replace(/\s/g, "").toLowerCase();
  const matching = rows.filter((row) => row.join(" ").replace(/\s/g, "").toLowerCase().includes(keyword));
  return (
    <>
      <Input type="search" aria-label="부품 검색" placeholder="부품명, 품번 또는 카테고리" value={query}
        onChange={(event) => setQuery(event.target.value)} />
      <DemoTable title={`가상 부품 목록 · ${matching.length}건`}
        columns={["품번", "카테고리", "부품명", drone ? "모델" : "용도", "가상 단가(원)"]} rows={matching} />
    </>
  );
}

export function GuestWorkPage({ page }: { page: GuestPage }) {
  switch (page) {
    case "sales": return <SampleSalesPanel />;
    case "profit": return <SampleSalesPanel profitability />;
    case "powerboard-parts": return <GuestParts key={page} drone={false} />;
    case "drone-parts": return <GuestParts key={page} drone />;
    case "competitors": return <SampleCompetitorProducts />;
    case "inventory": return <DemoTable title="가상 발주 기록" columns={["품목", "수량", "상태"]}
      rows={samplePurchaseOrders.map(({ item, quantity, status }) => [item, quantity, status])} />;
    case "powerboard": return <DemoTable title="월별 가상 실증" columns={["기준월", "수집률(%)", "보정 사용량 절감률(%)"]}
      rows={pilotSeries("전체").map(({ month, collection, saving }) => [month, collection?.toFixed(1) ?? "—", saving?.toFixed(1) ?? "—"])} />;
    case "drone": return <>
      <DemoTable title="교육용 드론 가상 실증" columns={["기준월", "실증 장소", "시험", "완료"]}
        rows={sampleDronePilot.map(({ month, site, attempts, completed }) => [month, site, attempts, completed])} />
      <DroneEducationStatistics />
    </>;
    case "inquiries": return <DemoTable title="가상 문의 목록" columns={["채널", "문의 내용", "처리 상태"]}
      rows={sampleCustomerInquiries.map(({ channel, content, status }) => [channel, content, status])} />;
    case "products": return <Panel title="제품과 관련 기능">
      <ul className="space-y-2">{guestGroups[2].pages.slice(1).map(([key, label]) => (
        <li key={key}><Link to="/guest" search={{ page: key }} className="underline">{label}</Link></li>
      ))}</ul>
    </Panel>;
    case "company":
    case "assistant": return null;
    default: return <DemoTable title="시연 기록" {...demos[page]} />;
  }
}
