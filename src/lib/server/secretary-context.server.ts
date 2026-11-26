import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { comparison, kstDay, summarySchema } from "../secretary";
import { dailyBase, weatherBase, weatherNumber, skyLabel } from "../weather";
import { requestWeather } from "./weather.server";
import { z } from "zod";
import { DEFAULT_PREFERENCES, type Preferences } from "../support";
import { loadSupport } from "./support.server";

export async function externalToday(
  keys: { weather?: string; lovable?: string; firecrawl?: string },
  today: string,
  preferences: Preferences = DEFAULT_PREFERENCES,
) {
  const fetchedAt = new Date().toISOString();
  const weather = async () => {
    if (!keys.weather)
      return { fetchedAt, region: "경기도 남양주시 진접읍", days: [], error: "기록 없음" };
    try {
      const now = new Date();
      // Uploaded workbook administrative code 4136025300: Jinjeop-eup (63,130).
      const [current, latest, early] = await Promise.all([
        requestWeather("getUltraSrtNcst", keys.weather, weatherBase("getUltraSrtNcst", now), {
          nx: 63,
          ny: 130,
        }),
        requestWeather("getVilageFcst", keys.weather, weatherBase("getVilageFcst", now), {
          nx: 63,
          ny: 130,
        }),
        requestWeather("getVilageFcst", keys.weather, dailyBase(now), { nx: 63, ny: 130 }),
      ]);
      const tomorrow = new Date(today + "T00:00:00Z");
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      const days = [today, tomorrow.toISOString().slice(0, 10)].map((date) => {
        const rows = [...latest, ...early].filter((x) => x.fcstDate === date.replaceAll("-", ""));
        const value = (category: string) =>
          weatherNumber(rows.find((x) => x.category === category)?.fcstValue);
        const rainHours = new Set(
          rows
            .filter((x) => x.category === "PTY" && (weatherNumber(x.fcstValue) ?? 0) > 0)
            .map((x) => x.fcstTime),
        );
        return {
          date,
          minimum: value("TMN"),
          maximum: value("TMX"),
          sky: skyLabel(value("SKY"), value("PTY")),
          rainForecastHours: rainHours.size,
        };
      });
      return {
        fetchedAt,
        region: "경기도 남양주시 진접읍",
        currentTemperature: weatherNumber(current.find((x) => x.category === "T1H")?.obsrValue),
        days,
      };
    } catch {
      return {
        fetchedAt,
        region: "경기도 남양주시 진접읍",
        days: [],
        error: "기록 없음: 날씨 조회 실패",
      };
    }
  };
  const grants = async () => {
    if (!keys.weather) return { fetchedAt, candidates: [], error: "기록 없음" };
    try {
      const data = await loadSupport(keys.weather, preferences, "json");
      const candidates = data.recommendations.slice(0, 5).map((n) => ({
        id: n.id,
        title: n.title,
        url: n.url,
        reason: n.reason,
        missing: n.missing,
        evidence: n.evidence,
        fetchedAt,
        start: n.start,
        end: n.end,
      }));
      return {
        fetchedAt,
        candidates,
        checkedCount: data.checkedCount,
        note: "오늘 K-Startup에서 받은 접수 중 공고 후보. 새 게시일·세부 자격·지원금은 미확인, 접수 기간은 원문 재확인.",
      };
    } catch (e) {
      return {
        fetchedAt,
        candidates: [],
        error: e instanceof Error ? e.message : "기록 없음: 지원사업 조회 실패",
      };
    }
  };
  const holidays = async () => {
    if (!keys.weather) return { fetchedAt, dates: [], error: "기록 없음" };
    try {
      const url = new URL(
        "https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo",
      );
      url.search = new URLSearchParams({
        serviceKey: keys.weather,
        solYear: today.slice(0, 4),
        solMonth: today.slice(5, 7),
        _type: "json",
        numOfRows: "100",
        pageNo: "1",
      }).toString();
      const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(10000) });
      if (!response.ok) return { fetchedAt, dates: [], error: "기록 없음" };
      const parsed = z
        .object({
          response: z.object({
            header: z.object({ resultCode: z.string() }),
            body: z.object({
              items: z.union([
                z.string(),
                z.object({
                  item: z.union([
                    z.object({ locdate: z.number(), dateName: z.string(), isHoliday: z.string() }),
                    z.array(
                      z.object({
                        locdate: z.number(),
                        dateName: z.string(),
                        isHoliday: z.string(),
                      }),
                    ),
                  ]),
                }),
              ]),
            }),
          }),
        })
        .safeParse(await response.json());
      if (!parsed.success || parsed.data.response.header.resultCode !== "00")
        return { fetchedAt, dates: [], error: "기록 없음" };
      const items = parsed.data.response.body.items;
      const dates =
        typeof items === "string" ? [] : Array.isArray(items.item) ? items.item : [items.item];
      return {
        fetchedAt,
        dates: dates
          .filter((d) => d.isHoliday === "Y")
          .map((d) => ({ date: String(d.locdate), name: d.dateName })),
      };
    } catch {
      return { fetchedAt, dates: [], error: "기록 없음: 공휴일 조회 승인 확인 필요" };
    }
  };
  const [weatherData, grantData, holidayData] = await Promise.all([
    weather(),
    grants(),
    holidays(),
  ]);
  return {
    receivedDate: today,
    fetchedAt,
    weather: weatherData,
    grants: grantData,
    holidays: holidayData,
  };
}

export async function secretaryContext(
  sb: SupabaseClient<Database>,
  today: string,
  external: unknown,
) {
  const { data, error } = await sb.rpc("secretary_summary", { _today: today });
  if (error) throw new Error("요약 숫자를 불러오지 못했습니다.");
  const summary = summarySchema.parse(data);
  return {
    today,
    summary,
    comparisons: {
      weekComparable: comparison(
        summary.sales.thisWeek.revenue,
        summary.sales.lastWeekComparable.revenue,
      ),
      month: comparison(summary.sales.thisMonth.revenue, summary.sales.lastMonth.revenue),
    },
    external,
  };
}
