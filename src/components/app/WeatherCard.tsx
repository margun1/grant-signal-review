import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Cloud, CloudRain, CloudSun, MapPin, RefreshCw, Snowflake, Sun, Thermometer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getWeather } from "@/lib/weather.functions";
import { WEATHER_REGION } from "@/lib/weather";

function WeatherIcon({ sky }: { sky: string }) {
  const Icon = sky.includes("눈") ? Snowflake : sky.includes("비") || sky === "소나기" ? CloudRain : sky === "맑음" ? Sun : sky === "구름많음" ? CloudSun : Cloud;
  return <Icon className="size-10 shrink-0 text-primary" aria-hidden />;
}
const degree = (value: number | null) => value === null ? "—" : `${value.toLocaleString("ko-KR")}°C`;
const hm = (at: string) => new Date(at).toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false });

export function WeatherCard() {
  const fetchWeather = useServerFn(getWeather);
  const q = useQuery({ queryKey: ["weather", WEATHER_REGION.nx, WEATHER_REGION.ny], queryFn: () => fetchWeather(), staleTime: 300000, refetchInterval: 300000, retry: false });
  const d = q.data?.ok ? q.data.data : null;
  return (
    <section aria-label="남양주시 날씨" className="rounded-lg border bg-card p-4 md:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-bold"><MapPin className="size-4 text-taupe" aria-hidden />{WEATHER_REGION.name}</h2>
        <Button variant="ghost" size="icon" aria-label="날씨 새로고침" title="날씨 새로고침" disabled={q.isFetching} onClick={() => void q.refetch()}><RefreshCw className={q.isFetching ? "animate-spin" : ""} /></Button>
      </div>
      {q.isPending ? <p className="py-6 text-sm text-muted-foreground" role="status">날씨를 불러오는 중…</p> : !d ? <p className="py-4 text-sm text-warning" role="alert">{q.data && !q.data.ok ? q.data.error : "날씨를 불러오지 못했습니다. 다시 시도해 주세요."}</p> : <>
        <div className="mt-2 flex flex-wrap items-center gap-x-8 gap-y-3">
          <div className="flex items-center gap-3"><WeatherIcon sky={d.sky} /><div><p className="text-3xl font-bold tabular-nums">{degree(d.temperature)}</p><p className="mt-1 text-sm text-muted-foreground">{d.sky}</p></div></div>
          <div className="flex items-center gap-2 text-sm"><Thermometer className="size-4 text-taupe" aria-hidden /><span>오늘 최저 <strong className="tabular-nums">{degree(d.minimum)}</strong> · 최고 <strong className="tabular-nums">{degree(d.maximum)}</strong></span></div>
        </div>
        {d.warnings.map((warning) => <p key={warning} className="mt-3 text-sm text-warning" role="alert">{warning}</p>)}
        <div className="mt-4 border-t pt-3">
          <h3 className="mb-3 text-xs font-semibold text-muted-foreground">시간별 기온 · 앞으로 12시간</h3>
          {d.hourly.length ? <ul className="grid grid-cols-3 gap-y-4 sm:grid-cols-6 xl:grid-cols-12">{d.hourly.map((h) => <li key={h.at} className="space-y-1 text-center text-sm"><time dateTime={h.at} className="text-xs text-muted-foreground">{hm(h.at)}</time><p className="font-semibold tabular-nums">{degree(h.temperature)}</p><p className="text-xs text-muted-foreground">{h.sky}</p></li>)}</ul> : <p className="text-sm text-muted-foreground">시간별 예보 확인 필요</p>}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">기상청 · {d.observedAt ? `${hm(d.observedAt)} 관측` : "관측 자료 확인 필요"} · 하늘 상태는 최신 예보 기준</p>
      </>}
    </section>
  );
}