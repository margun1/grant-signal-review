export const sampleDronePilot = [
  { month: "2026-08", site: "교육기관 A", category: "조종 교육", attempts: 24, completed: 20, minutes: 9.1, checks: 2 },
  { month: "2026-08", site: "실내 시험장 B", category: "기체 점검", attempts: 18, completed: 15, minutes: 10.2, checks: 2 },
  { month: "2026-09", site: "교육기관 A", category: "조종 교육", attempts: 28, completed: 25, minutes: 9.8, checks: 2 },
  { month: "2026-09", site: "실내 시험장 B", category: "기체 점검", attempts: 22, completed: 20, minutes: 10.7, checks: 1 },
  { month: "2026-10", site: "교육기관 C", category: "조종 교육", attempts: 32, completed: 30, minutes: 10.2, checks: 1 },
  { month: "2026-10", site: "실내 시험장 B", category: "기체 점검", attempts: 24, completed: 23, minutes: 11.1, checks: 1 },
  { month: "2026-11", site: "교육기관 C", category: "조종 교육", attempts: 36, completed: 35, minutes: 10.6, checks: 1 },
  { month: "2026-11", site: "실내 시험장 B", category: "기체 점검", attempts: 26, completed: 25, minutes: 11.4, checks: 0 },
];

export function summarizeDronePilot(rows: typeof sampleDronePilot) {
  const attempts = rows.reduce((sum, row) => sum + row.attempts, 0);
  const completed = rows.reduce((sum, row) => sum + row.completed, 0);
  const minutes = rows.reduce((sum, row) => sum + row.minutes * row.completed, 0);
  return {
    attempts,
    completed,
    completion: attempts ? 100 * completed / attempts : 0,
    averageMinutes: completed ? minutes / completed : 0,
    checks: rows.reduce((sum, row) => sum + row.checks, 0),
    sites: new Set(rows.map((row) => row.site)).size,
  };
}
