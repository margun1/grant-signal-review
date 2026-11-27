import { supabase } from "@/integrations/supabase/client";

const initialTasks = [
  { id: "040dd8d3-65b6-447b-9a8f-9031ceaa106a", title: "POWERBOARD 실증 현장별 점검 담당자와 연락 창구 정리" },
  { id: "27ba0e19-57aa-4c8f-bf4f-7b339008ae4c", title: "드론 주요 예비 부품의 최소 재고 기준 정하기" },
  { id: "36bef32e-8ddb-4fe7-9021-14171f283316", title: "지원사업 신청 공통서류 목록과 최신본 보관 위치 정리" },
  { id: "c17ecf68-4b10-4fa1-94b9-dc7156783bc6", title: "POWERBOARD·드론 고객문의 유형별 표준 답변 초안 작성" },
];

const recurringTasks = [
  { id: "319220c2-48cb-43eb-82b6-7835637543e7", title: "고객 미답변 문의와 처리 중인 기기오류 확인", frequency: "매일", weekday: null },
  { id: "e80c50e9-ee08-48dc-b2d2-ca29c04cc1d6", title: "POWERBOARD 실증 현장의 계측 누락과 이상값 확인", frequency: "매일", weekday: null },
  { id: "a9176e3f-02e3-4b20-971f-c07fe8a0c016", title: "이번 주 미팅 일정과 준비 자료 확인", frequency: "매주", weekday: 1 },
  { id: "749be6b6-5ac2-43ca-bcf3-4f804cda2f82", title: "에너지·탄소중립 지원사업 공고와 신청 마감일 검토", frequency: "매주", weekday: 2 },
  { id: "4fd0d585-43d9-4fdc-9cba-17ee610b6469", title: "드론 부품과 POWERBOARD 재고·발주 필요 수량 확인", frequency: "매주", weekday: 3 },
  { id: "3ef9fd19-d109-40eb-b9f5-64b5099b2f84", title: "주간 매출·원가와 다음 주 우선 업무 정리", frequency: "매주", weekday: 5 },
];

export async function registerCompanyChecklist(today: string) {
  // Stable IDs make retries safe and preserve completed tasks and paused templates.
  const options = { onConflict: "id", ignoreDuplicates: true };
  const [tasks, templates] = await Promise.all([
    supabase.from("tasks").upsert(initialTasks.map((task) => ({ ...task, due_date: today })), options),
    supabase.from("checklist_templates").upsert(recurringTasks, options),
  ]);
  if (tasks.error || templates.error) throw new Error("기본 체크리스트를 등록하지 못했습니다.");
}
