import { describe, expect, it } from "vitest";
import { assembleWeather, dailyBase, skyLabel, WEATHER_REGION, weatherBase, weatherNumber, weatherUrl } from "./weather";

describe("기상청 문서 기반 날씨", () => {
  it("남양주시 대표 격자는 첨부 엑셀의 64,128", () => { expect(WEATHER_REGION.nx).toBe(64); expect(WEATHER_REGION.ny).toBe(128); });
  it("문서의 요청 주소·변수와 JSON을 사용", () => {
    const url = weatherUrl("getVilageFcst", "test only +/=", { base_date: "20261123", base_time: "0800" });
    expect(url.origin + url.pathname).toBe("https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst");
    expect([...url.searchParams.keys()].sort()).toEqual(["serviceKey", "base_date", "base_time", "dataType", "numOfRows", "nx", "ny", "pageNo"].sort());
    expect(url.searchParams.get("dataType")).toBe("JSON");
    expect(url.searchParams.get("serviceKey")).toBe("test only +/=");
  });
  it("한국시간과 발표 후 제공 지연·자정 경계를 적용", () => {
    expect(weatherBase("getUltraSrtNcst", new Date("2026-11-22T15:05:00Z"))).toEqual({ base_date: "20261122", base_time: "2300" });
    expect(weatherBase("getUltraSrtFcst", new Date("2026-11-23T00:44:00Z"))).toEqual({ base_date: "20261123", base_time: "0830" });
    expect(weatherBase("getVilageFcst", new Date("2026-11-23T02:05:00Z"))).toEqual({ base_date: "20261123", base_time: "0800" });
    expect(dailyBase(new Date("2026-11-23T00:51:00Z"))).toEqual({ base_date: "20261123", base_time: "0200" });
  });
  it("결측은 0도로 만들지 않고 하늘·강수 코드를 해석", () => {
    expect(weatherNumber(-999)).toBeNull(); expect(weatherNumber(900)).toBeNull(); expect(weatherNumber("")).toBeNull(); expect(weatherNumber("0")).toBe(0);
    expect(skyLabel(1, 0)).toBe("맑음"); expect(skyLabel(3, 0)).toBe("구름많음"); expect(skyLabel(4, 0)).toBe("흐림"); expect(skyLabel(1, 3)).toBe("눈");
  });
  it("오늘 최저·최고만 선택하고 관측 기온과 앞으로 12시간 예보를 분리", () => {
    const row = { baseDate: "20261123", baseTime: "0200", fcstDate: "20261123", fcstTime: "1000" };
    const d = assembleWeather([{ ...row, category: "T1H", obsrValue: "2.5" }], [], [
      { ...row, category: "TMP", fcstValue: "4" }, { ...row, category: "SKY", fcstValue: "1" },
      { ...row, fcstTime: "2300", category: "TMP", fcstValue: "1" },
    ], [{ ...row, category: "TMN", fcstValue: "-2" }, { ...row, category: "TMX", fcstValue: "10" }, { ...row, fcstDate: "20261124", category: "TMN", fcstValue: "-5" }], new Date("2026-11-23T00:51:00Z"), []);
    expect(d.temperature).toBe(2.5); expect(d.minimum).toBe(-2); expect(d.maximum).toBe(10); expect(d.hourly).toHaveLength(1); expect(d.hourly[0]?.temperature).toBe(4);
  });
});