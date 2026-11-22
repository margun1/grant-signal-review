import { COMPANY_PROFILE, WRITING_RULES } from "../company";
import { reportSchema } from "../schemas";
import { buildContext } from "./context.server";
import { generateStructured } from "./ai.server";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supa = any;

export async function makeReport(sb: Supa, start: string, end: string) {
  const ctx = await buildContext(sb, start, end);
  const r = await generateStructured({
    schema: reportSchema,
    instructions: `${COMPANY_PROFILE}\n${WRITING_RULES}\n경영 리포트를 작성한다. 집계 기간 ${start}~${end}. 매출, 매출총이익, 부족 재고, 미답변 문의, 주요 마감 순으로 sections를 만든다. 각 수치에 집계 기간과 자료 기준일을 쓴다. 원가 누락이나 자료가 없으면 missing에 [확인 필요] 항목으로 넣는다. 고객·구매자 이름은 쓰지 않는다.\n[업무 자료]\n${JSON.stringify(ctx)}`,
    messages: [{ role: "user", content: "리포트를 작성해 주세요." }],
  });
  return { ...r, 자료기준: ctx.자료기준 };
}
