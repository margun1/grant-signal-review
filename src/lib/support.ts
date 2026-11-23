import { z } from "zod";

export const INTERESTS = ["판로", "마케팅", "자금", "교육"] as const;
export const preferencesSchema = z.object({
  industry: z.string().trim().max(80),
  region: z.string().trim().max(100),
  business_years: z.number().min(0).max(200).nullable(),
  annual_revenue: z.number().min(0).max(1e15).nullable(),
  interests: z.array(z.enum(INTERESTS)).max(4),
});
export type Preferences = z.infer<typeof preferencesSchema>;
export const DEFAULT_PREFERENCES: Preferences = {
  industry: "제조업",
  region: "경기도 남양주시 진접읍",
  business_years: null,
  annual_revenue: null,
  interests: [],
};
export const KSTARTUP_API =
  "https://apis.data.go.kr/B552735/kisedKstartupService01/getAnnouncementInformation01";
export type SupportNotice = {
  id: string;
  title: string;
  content: string;
  target: string;
  region: string;
  tenure: string;
  field: string;
  start: string;
  end: string;
  recruiting: string;
  url: string;
};
export type SupportRecommendation = {
  id: string;
  title: string;
  reason: string;
  missing: string[];
  evidence: string[];
  field: string;
  region: string;
  start: string;
  end: string;
  url: string;
  score: number;
};
export function supportUrl(key: string, format: "json" | "xml", page: number) {
  const url = new URL(KSTARTUP_API);
  // Rcrt_prgs_yn is documented, but the live API only filters through its data API condition.
  url.search = new URLSearchParams({
    ServiceKey: key,
    page: String(page),
    perPage: "100",
    returnType: format,
    Rcrt_prgs_yn: "Y",
    "cond[rcrt_prgs_yn::EQ]": "Y",
  }).toString();
  return url;
}
function plain(value: unknown) {
  return value === undefined || value === null
    ? ""
    : String(value)
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
export function noticeFromRow(row: Record<string, unknown>): SupportNotice {
  const r: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) r[k.toLowerCase()] = v;
  let url = plain(r["detl_pg_url"]);
  if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") url = "";
  } catch {
    url = "";
  }
  return {
    id: plain(r["pbanc_sn"]),
    title: plain(r["biz_pbanc_nm"]),
    content: plain(r["pbanc_ctnt"]) + " " + plain(r["support_ctnt"]),
    target: plain(r["aply_trgt_ctnt"]) + " " + plain(r["aply_trgt"]),
    region: plain(r["supt_regin"]),
    tenure: plain(r["biz_enyy"]),
    field: plain(r["supt_biz_clsfc"]),
    start: plain(r["pbanc_rcpt_bgng_dt"]),
    end: plain(r["pbanc_rcpt_end_dt"]),
    recruiting: plain(r["rcrt_prgs_yn"]),
    url,
  };
}
function noticeTime(value: string, end: boolean): number | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length < 8) return null;
  const date = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  const time =
    digits.length >= 12
      ? `${digits.slice(8, 10)}:${digits.slice(10, 12)}:${digits.slice(12, 14) || "00"}`
      : end
        ? "23:59:59"
        : "00:00:00";
  const ms = new Date(`${date}T${time}+09:00`).getTime();
  return Number.isFinite(ms) ? ms : null;
}
export function isReceiving(notice: SupportNotice, now: Date) {
  if (notice.recruiting.toUpperCase() !== "Y") return false;
  const start = noticeTime(notice.start, false),
    end = noticeTime(notice.end, true);
  return (start === null || start <= now.getTime()) && (end === null || end >= now.getTime());
}
function tenureFits(raw: string, years: number | null): boolean | null {
  if (years === null || !raw.trim()) return null;
  if (/제한\s*없|무관/.test(raw)) return true;
  const ranges = [...raw.matchAll(/(\d+(?:\.\d+)?)\s*년\s*(미만|이하|이상|초과)/g)];
  if (ranges.length)
    return ranges.some((m) => {
      const n = Number(m[1]);
      return m[2] === "미만"
        ? years < n
        : m[2] === "이하"
          ? years <= n
          : m[2] === "이상"
            ? years >= n
            : years > n;
    });
  if (/예비창업자/.test(raw) && !/기업|년/.test(raw)) return false;
  return null;
}
const interestWords: Record<(typeof INTERESTS)[number], RegExp> = {
  판로: /판로|수출|유통|판매|글로벌/,
  마케팅: /마케팅|홍보|광고|브랜드/,
  자금: /자금|융자|사업화|투자|보증/,
  교육: /교육|훈련|강좌/,
};
export function recommendSupport(
  notices: SupportNotice[],
  prefs: Preferences,
  now: Date,
): SupportRecommendation[] {
  return notices
    .filter((n) => n.title && n.url && isReceiving(n, now))
    .flatMap((n) => {
      const evidence: string[] = [],
        missing: string[] = [];
      let score = 0;
      const text = `${n.title} ${n.content} ${n.target}`;
      if (prefs.industry && text.includes(prefs.industry.replace(/업$/, ""))) {
        evidence.push(`업종: 공고에 '${prefs.industry.replace(/업$/, "")}' 명시`);
        score += 4;
      } else missing.push("업종 적합성");
      const regionTerm = prefs.region.startsWith("경기")
        ? "경기"
        : (prefs.region.split(" ")[0]?.replace(/특별시|광역시|특별자치도|도$/, "") ?? "");
      if (/전국/.test(n.region)) {
        evidence.push("지역: 전국 모집");
        score += 2;
      } else if (regionTerm && n.region.includes(regionTerm)) {
        evidence.push(`지역: ${n.region}`);
        score += 3;
      } else if (!n.region || !prefs.region) missing.push("지역 조건");
      else return [];
      const tenure = tenureFits(n.tenure, prefs.business_years);
      if (tenure === false) return [];
      if (tenure === true) {
        evidence.push(`업력: 공고 '${n.tenure}' 범위에 해당`);
        score += 2;
      } else missing.push("업력 조건");
      // Revenue is not a dedicated field in this API. Only explicit revenue limits count as evidence.
      const revenueRule = text.match(
        /(?:연\s*)?매출(?:액|규모)?[^\d]{0,12}(\d+(?:\.\d+)?)\s*(억|만)?\s*원?\s*(이하|미만|이상|초과)/,
      );
      if (revenueRule && prefs.annual_revenue !== null) {
        const limit =
          Number(revenueRule[1]) *
          (revenueRule[2] === "억" ? 1e8 : revenueRule[2] === "만" ? 1e4 : 1);
        const allowed =
          revenueRule[3] === "이하"
            ? prefs.annual_revenue <= limit
            : revenueRule[3] === "미만"
              ? prefs.annual_revenue < limit
              : revenueRule[3] === "이상"
                ? prefs.annual_revenue >= limit
                : prefs.annual_revenue > limit;
        if (!allowed) return [];
        evidence.push(`매출 조건: '${revenueRule[0]}' 범위에 해당`);
        score += 2;
      } else missing.push("연 매출 조건");
      const interests = prefs.interests.filter((i) => interestWords[i].test(n.field + " " + text));
      if (interests.length) {
        evidence.push(`관심 분야: ${interests.join("·")}`);
        score += interests.length * 3;
      } else missing.push(prefs.interests.length ? "관심 분야 일치" : "관심 분야 미입력");
      if (!n.start || !n.end) missing.push("접수 기간");
      missing.push("세부 신청자격·제외대상", "지원 금액");
      return [
        {
          id: n.id,
          title: n.title,
          reason: evidence.length
            ? evidence.slice(0, 2).join(" · ")
            : "모집 중 공고이며 조건 적합성은 확인 필요",
          missing,
          evidence,
          field: n.field,
          region: n.region,
          start: n.start,
          end: n.end,
          url: n.url,
          score,
        },
      ];
    })
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, 5);
}
