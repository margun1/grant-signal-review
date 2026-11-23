// Source: uploaded KMA grid workbook, final update 20260930, administrative code 4136000000.
export const WEATHER_REGION = { name: "경기도 남양주시", nx: 64, ny: 128 } as const;
export const WEATHER_API = "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0";
export type WeatherMethod = "getUltraSrtNcst" | "getUltraSrtFcst" | "getVilageFcst";
export type WeatherItem = { category: string; baseDate: string; baseTime: string; fcstDate?: string; fcstTime?: string; fcstValue?: string | number; obsrValue?: string | number };
export type WeatherHour = { at: string; temperature: number; sky: string };
export type WeatherData = { region: string; temperature: number | null; sky: string; minimum: number | null; maximum: number | null; observedAt: string | null; fetchedAt: string; hourly: WeatherHour[]; warnings: string[] };

function kst(now: Date) { return new Date(now.getTime() + 9 * 3600000); }
function base(d: Date) { return { base_date: d.toISOString().slice(0, 10).replaceAll("-", ""), base_time: `${String(d.getUTCHours()).padStart(2, "0")}${String(d.getUTCMinutes()).padStart(2, "0")}` }; }

export function weatherBase(method: WeatherMethod, now: Date) {
  const d = kst(now);
  if (method === "getUltraSrtNcst") {
    if (d.getUTCMinutes() <= 10) d.setUTCHours(d.getUTCHours() - 1);
    d.setUTCMinutes(0, 0, 0);
  } else if (method === "getUltraSrtFcst") {
    if (d.getUTCMinutes() <= 45) d.setUTCHours(d.getUTCHours() - 1);
    d.setUTCMinutes(30, 0, 0);
  } else {
    d.setUTCMinutes(d.getUTCMinutes() - 11);
    const h = [23, 20, 17, 14, 11, 8, 5, 2].find((h) => h <= d.getUTCHours());
    if (h === undefined) { d.setUTCDate(d.getUTCDate() - 1); d.setUTCHours(23); }
    else d.setUTCHours(h);
    d.setUTCMinutes(0, 0, 0);
  }
  return base(d);
}

export function dailyBase(now: Date) {
  const d = kst(now);
  if (d.getUTCHours() < 2 || (d.getUTCHours() === 2 && d.getUTCMinutes() <= 10)) {
    d.setUTCDate(d.getUTCDate() - 1); d.setUTCHours(23, 0, 0, 0);
  } else d.setUTCHours(2, 0, 0, 0);
  return base(d);
}

// User chose the data.go.kr endpoint and the guide's parameter-table name serviceKey.
// URLSearchParams encodes the saved decoding value exactly once, and this URL never leaves the server.
export function weatherUrl(method: WeatherMethod, key: string, stamp: { base_date: string; base_time: string }, grid: { nx: number; ny: number } = WEATHER_REGION) {
  const url = new URL(`${WEATHER_API}/${method}`);
  url.search = new URLSearchParams({ serviceKey: key, numOfRows: "2000", pageNo: "1", dataType: "JSON", ...stamp, nx: String(grid.nx), ny: String(grid.ny) }).toString();
  return url;
}

export function weatherNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && Math.abs(n) < 900 ? n : null;
}
export function skyLabel(sky: number | null, rain: number | null) {
  const precipitation: Record<number, string> = { 1: "비", 2: "비/눈", 3: "눈", 4: "소나기", 5: "빗방울", 6: "빗방울눈날림", 7: "눈날림" };
  if (rain !== null && precipitation[rain]) return precipitation[rain];
  return sky === 1 ? "맑음" : sky === 3 ? "구름많음" : sky === 4 ? "흐림" : "하늘 상태 확인 필요";
}
export function weatherIso(date: string, time: string) {
  return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${time.slice(0, 2)}:${time.slice(2, 4)}:00+09:00`;
}

export function assembleWeather(ncst: WeatherItem[], ultra: WeatherItem[], village: WeatherItem[], daily: WeatherItem[], now: Date, warnings: string[]): WeatherData {
  const today = kst(now).toISOString().slice(0, 10).replaceAll("-", "");
  const hours = new Map<string, { temperature: number | null; sky: number | null; rain: number | null }>();
  for (const item of [...village, ...ultra]) {
    if (!item.fcstDate || !item.fcstTime) continue;
    const at = weatherIso(item.fcstDate, item.fcstTime);
    const h = hours.get(at) ?? { temperature: null, sky: null, rain: null };
    const value = weatherNumber(item.fcstValue);
    if (value === null) continue;
    if (item.category === "TMP" || item.category === "T1H") h.temperature = value;
    if (item.category === "SKY") h.sky = value;
    if (item.category === "PTY") h.rain = value;
    hours.set(at, h);
  }
  const sorted = [...hours].sort(([a], [b]) => a.localeCompare(b));
  const currentHour = sorted.find(([at]) => new Date(at).getTime() >= now.getTime())?.[1];
  const obs = ncst.find((x) => x.category === "T1H");
  const rain = weatherNumber(ncst.find((x) => x.category === "PTY")?.obsrValue);
  const dayValue = (category: string) => weatherNumber([...daily, ...village].find((x) => x.category === category && x.fcstDate === today)?.fcstValue);
  return {
    region: WEATHER_REGION.name, temperature: weatherNumber(obs?.obsrValue), sky: skyLabel(currentHour?.sky ?? null, rain ?? currentHour?.rain ?? null),
    minimum: dayValue("TMN"), maximum: dayValue("TMX"), observedAt: obs ? weatherIso(obs.baseDate, obs.baseTime) : null,
    fetchedAt: now.toISOString(), warnings,
    hourly: sorted.filter(([at]) => new Date(at).getTime() > now.getTime() && new Date(at).getTime() <= now.getTime() + 12 * 3600000)
      .flatMap(([at, h]) => h.temperature === null ? [] : [{ at, temperature: h.temperature, sky: skyLabel(h.sky, h.rain) }]),
  };
}