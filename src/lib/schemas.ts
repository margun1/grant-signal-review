import { z } from "zod";

export const sourceSchema = z.object({
  url: z.string().describe("원본 링크. 첨부 업로드 자료면 빈 문자열"),
  document: z.string().describe("문서명 또는 웹 공고 본문"),
  location: z.string().describe("PDF 쪽수(예: 3쪽) 또는 웹 본문 항목명"),
});

export const analysisSchema = z.object({
  title: z.string().nullable(),
  organizer: z.string().nullable(),
  deadline: z.string().nullable().describe("YYYY-MM-DD, 불명확하면 null"),
  deadline_text: z.string().nullable(),
  eligibility: z.array(
    z.object({
      condition: z.string().describe("지역·업종·업력 등 조건 이름"),
      requirement: z.string(),
      company_fact: z.string(),
      result: z.enum(["충족", "미충족", "확인 필요"]),
      source: sourceSchema,
    }),
  ),
  fit_level: z.enum(["우선 검토", "추가 확인", "낮은 우선순위"]),
  fit_reasons: z.array(z.object({ text: z.string(), source: sourceSchema })),
  support: z.object({
    items: z.string(),
    limit: z.string(),
    payment_method: z.string(),
    direct_payment: z.enum(["예", "아니오", "확인 필요"]),
    source: sourceSchema,
  }),
  powerboard_links: z.array(z.object({ text: z.string(), source: sourceSchema })),
  ceo_questions: z.array(z.string()),
  unverified: z.array(z.string()).describe("자료 부족으로 확인하지 못한 항목"),
});
export type Analysis = z.infer<typeof analysisSchema>;

export const reviewSchema = z.object({
  criteria_status: z.enum(["공식 평가기준 확보", "공개 평가기준 확인 불가"]),
  unreadable_pages: z.string().nullable().describe("판독 불가한 초안 페이지. 없으면 null"),
  summary: z.string(),
  rows: z.array(
    z.object({
      question: z.string().describe("공식 문항명"),
      criteria: z.string().describe("평가기준 또는 작성 요구사항"),
      criteria_source: z.string().describe("문서명과 쪽수 또는 항목명"),
      draft_location: z.string().describe("초안 쪽수와 문단·표, 없으면 '해당 없음'"),
      result: z.enum(["충족", "보완 필요", "누락", "확인 필요"]),
      gap: z.string().describe("AI가 찾은 빠진 근거나 답하지 못한 부분"),
      suggestion: z.string().describe("붙여 넣을 수정 문장. 미확인 사실은 [확인 필요: 항목]"),
    }),
  ),
  manager_checks: z.array(z.string()).describe("실장이 확인할 사실"),
});
export type Review = z.infer<typeof reviewSchema>;

export const reportSchema = z.object({ summary: z.string(), sections: z.array(z.object({ title: z.string(), body: z.string() })), missing: z.array(z.string()) });
