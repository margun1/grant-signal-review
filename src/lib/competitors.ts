import { z } from "zod";

export const competitorProfileSchema = z.object({
  industry: z.string().trim().max(100),
  region: z.string().trim().max(100),
  years: z
    .string()
    .trim()
    .regex(/^(?:\d{1,3}(?:\.\d+)?)?$/),
  revenue: z
    .string()
    .trim()
    .regex(/^\d{0,16}$/),
  product: z.string().trim().max(150),
  description: z.string().trim().max(1500),
});
export type CompetitorProfile = z.infer<typeof competitorProfileSchema>;
export const defaultCompetitorProfile: CompetitorProfile = {
  industry: "제조업",
  region: "경기도 남양주시",
  years: "",
  revenue: "",
  product: "POWERBOARD",
  description: "분전반 커버를 교체해 전기사용량을 실시간으로 보여주는 전력·에너지 모니터링 장치",
};

export type EscoCompany = {
  name: string;
  product: string;
  description: string;
  industry: string;
  region: string;
  years: string;
  revenue: string;
};

const subjects = [
  [
    "전력·에너지 모니터링",
    /(?:에너지|전력|전기)\s*(?:모니터링|계측|관리|사용량)|분전반|전력량계|\b(?:FEMS|BEMS|EMS|AMI)\b/i,
    10,
  ],
  ["에너지 절감", /(?:에너지|전력|전기)\s*(?:절약|절감|효율)|고효율|절전/, 5],
  ["탄소중립", /탄소\s*중립|온실\s*가스\s*감축|탈탄소/, 3],
] as const;

export function rankCompetitors(companies: EscoCompany[], profile: CompetitorProfile) {
  const focus = `${profile.product} ${profile.description}`;
  const normalize = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const keywords = [
    ...new Set(profile.description.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []),
  ];
  return companies
    .map((company) => {
      const details = `${company.product} ${company.description} ${company.industry}`;
      const productTerms = profile.product.toLowerCase().trim();
      const region = normalize(profile.region.split(/\s+/)[0] ?? "").replace(
        /(?:특별자치도|특별시|광역시|도)$/,
        "",
      );
      const industry = normalize(profile.industry).replace(/업$/, "");
      const reasons: string[] = [];
      let score = 0;
      if (productTerms && details.toLowerCase().includes(productTerms)) {
        score += 12;
        reasons.push("제품명 일치");
      }
      for (const [label, pattern, weight] of subjects) {
        if (pattern.test(focus) && pattern.test(details)) {
          score += weight;
          reasons.push(label);
        }
      }
      const matchedTerms = keywords.filter((term) => details.toLowerCase().includes(term));
      if (matchedTerms.length) {
        score += Math.min(matchedTerms.length, 4);
        reasons.push(`제품 설명: ${matchedTerms.slice(0, 3).join(", ")}`);
      }
      if (industry && normalize(company.industry).includes(industry)) {
        score += 3;
        reasons.push("업종 유사");
      }
      if (region && normalize(company.region).includes(region)) {
        score += 2;
        reasons.push("지역 일치");
      }
      const years = company.years.match(/^(\d+(?:\.\d+)?)\s*년?$/)?.[1];
      if (profile.years && years && Math.abs(Number(profile.years) - Number(years)) <= 2) {
        score += 1;
        reasons.push("공개 업력 유사");
      }
      const revenue = company.revenue
        .replaceAll(",", "")
        .match(/^(\d+(?:\.\d+)?)\s*(억 원|억원|만 원|만원|원)$/);
      if (Number(profile.revenue) > 0 && revenue?.[1] && revenue[2]) {
        const amount =
          Number(revenue[1]) *
          (revenue[2].startsWith("억") ? 1e8 : revenue[2].startsWith("만") ? 1e4 : 1);
        const ratio = amount / Number(profile.revenue);
        if (ratio >= 0.5 && ratio <= 2) {
          score += 1;
          reasons.push("공개 매출 규모 유사");
        }
      }
      return { ...company, score, reasons };
    })
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "ko"));
}
