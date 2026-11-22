// 매시 실행: 반복 체크리스트 생성 + 지정 요일·시간의 주간 리포트 (관리자 권한 클라이언트 사용)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supa = any;
export async function runHourly(admin: Supa) {
  const k = new Date(Date.now() + 9 * 3600000); const today = k.toISOString().slice(0, 10); const dow = k.getUTCDay(); const hour = k.getUTCHours();
  const { data: tpls } = await admin.from("checklist_templates").select("*").eq("active", true);
  const rows = (tpls ?? []).filter((t: { frequency: string; weekday: number | null }) => t.frequency === "매일" || t.weekday === dow).map((t: { id: string; title: string; assignee: string | null }) => ({ title: t.title, assignee: t.assignee, due_date: today, template_id: t.id }));
  if (rows.length) await admin.from("tasks").upsert(rows, { onConflict: "template_id,due_date", ignoreDuplicates: true });
  const { data: s } = await admin.from("company_settings").select("report_weekday,report_hour").eq("id", 1).maybeSingle();
  let report = "skip";
  if (s && s.report_weekday === dow && s.report_hour === hour) {
    const end = new Date(k); end.setUTCDate(end.getUTCDate() - 1); const start = new Date(end); start.setUTCDate(start.getUTCDate() - 6);
    const week = today;
    const { data: exists } = await admin.from("ai_reports").select("id").eq("week_key", week).maybeSingle();
    if (!exists) {
      const { makeReport } = await import("./report.server");
      const content = await makeReport(admin, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10));
      await admin.from("ai_reports").upsert({ kind: "주간", period_start: start.toISOString().slice(0, 10), period_end: end.toISOString().slice(0, 10), week_key: week, content }, { onConflict: "week_key", ignoreDuplicates: true });
      report = "created";
    }
  }
  return { tasks: rows.length, report };
}
