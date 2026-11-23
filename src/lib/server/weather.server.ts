import { z } from "zod";
import { assembleWeather, dailyBase, weatherBase, weatherUrl, type WeatherData, type WeatherMethod } from "../weather";

const itemSchema = z.object({ category: z.string(), baseDate: z.string(), baseTime: z.string(), fcstDate: z.string().optional(), fcstTime: z.string().optional(), fcstValue: z.union([z.string(), z.number()]).optional(), obsrValue: z.union([z.string(), z.number()]).optional() }).transform((x) => ({
  category: x.category, baseDate: x.baseDate, baseTime: x.baseTime,
  ...(x.fcstDate === undefined ? {} : { fcstDate: x.fcstDate }),
  ...(x.fcstTime === undefined ? {} : { fcstTime: x.fcstTime }),
  ...(x.fcstValue === undefined ? {} : { fcstValue: x.fcstValue }),
  ...(x.obsrValue === undefined ? {} : { obsrValue: x.obsrValue }),
}));
const responseSchema = z.object({ response: z.object({ header: z.object({ resultCode: z.union([z.string(), z.number()]) }), body: z.object({ items: z.object({ item: z.array(itemSchema) }) }).optional() }) });
let cache: { until: number; data: WeatherData } | undefined;
let pending: Promise<WeatherData> | undefined;

class WeatherFailure extends Error {
  constructor(readonly reason: "auth" | "nodata" | "unavailable") { super(reason); }
}

export async function requestWeather(method: WeatherMethod, key: string, stamp: { base_date: string; base_time: string }, grid?: { nx: number; ny: number }) {
  // Never log fetch exceptions, URLs or raw provider messages: they may contain the credential.
  let response: Response;
  try { response = await fetch(weatherUrl(method, key, stamp, grid), { headers: { Accept: "application/json" }, redirect: "manual", signal: AbortSignal.timeout(15000) }); }
  catch { throw new WeatherFailure("unavailable"); }
  if (!response.ok) throw new WeatherFailure(response.status === 401 || response.status === 403 ? "auth" : "unavailable");
  let payload: unknown;
  try { payload = await response.json(); } catch { throw new WeatherFailure("unavailable"); }
  const parsed = responseSchema.safeParse(payload);
  if (!parsed.success) throw new WeatherFailure("unavailable");
  const code = String(parsed.data.response.header.resultCode).padStart(2, "0");
  if (["20", "21", "30", "31", "32", "33"].includes(code)) throw new WeatherFailure("auth");
  if (code !== "00") throw new WeatherFailure(code === "03" ? "nodata" : "unavailable");
  const rows = parsed.data.response.body?.items.item;
  if (!rows?.length) throw new WeatherFailure("nodata");
  return rows;
}

export async function loadWeather(key: string): Promise<WeatherData> {
  if (cache && cache.until > Date.now()) return cache.data;
  if (pending) return pending;
  pending = (async () => {
    const now = new Date();
    const warnings: string[] = [];
    const specs = [
      ["getUltraSrtNcst", weatherBase("getUltraSrtNcst", now)],
      ["getUltraSrtFcst", weatherBase("getUltraSrtFcst", now)],
      ["getVilageFcst", weatherBase("getVilageFcst", now)],
      ["getVilageFcst", dailyBase(now)],
    ] as const;
    const results = await Promise.all(specs.map(async ([method, stamp]) => {
      try { return await requestWeather(method, key, stamp); }
      catch (e) {
        const message = e instanceof WeatherFailure && e.reason === "auth"
          ? "공공데이터포털이 인증을 거부했습니다. 단기예보 조회서비스의 활용 승인과 DATA_GO_KEY 등록을 확인해 주세요."
          : "일부 기상청 자료를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";
        if (!warnings.includes(message)) warnings.push(message);
        return [];
      }
    }));
    const data = assembleWeather(results[0] ?? [], results[1] ?? [], results[2] ?? [], results[3] ?? [], now, warnings);
    cache = { until: Date.now() + (warnings.length ? 30000 : 300000), data };
    return data;
  })();
  try { return await pending; } finally { pending = undefined; }
}