import { z } from "zod";

const houseAverageUrl = "https://bigdata.kepco.co.kr/openapi/v1/powerUsage/houseAve.do";

const numeric = z
  .union([z.number(), z.string()])
  .nullish()
  .transform((raw) => {
    if (raw == null || (typeof raw === "string" && !raw.trim())) return null;
    const value = Number(typeof raw === "string" ? raw.replaceAll(",", "") : raw);
    return Number.isFinite(value) && value >= 0 ? value : null;
  });
const houseAverageResponse = z.object({
  data: z.array(
    z.object({
      houseCnt: numeric,
      powerUsage: numeric,
      bill: numeric,
    }),
  ),
});

export async function fetchNamyangjuHouseAverage(month: string, key: string) {
  const [year, monthNumber] = month.split("-");
  const url = new URL(houseAverageUrl);
  url.search = new URLSearchParams({
    year: year!,
    month: monthNumber!,
    metroCd: "41",
    cityCd: "360",
    apiKey: key,
    returnType: "json",
  }).toString();

  let response: Response;
  try {
    response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(12000) });
  } catch {
    throw new Error("한전 전력데이터에 연결하지 못했습니다. 잠시 후 다시 조회해 주세요.");
  }
  if (response.status === 401 || response.status === 403) {
    throw new Error("한전 전력데이터 인증키와 가구평균 전력사용량 API 사용 권한을 확인해 주세요.");
  }
  if (!response.ok) throw new Error("한전 전력데이터 조회에 실패했습니다.");

  const parsed = houseAverageResponse.safeParse(await response.json().catch(() => null));
  if (!parsed.success)
    throw new Error("한전 전력데이터 응답을 읽지 못했습니다. API 사용 권한을 확인해 주세요.");
  if (parsed.data.data.length === 0) return null;
  const [row] = parsed.data.data;
  if (parsed.data.data.length !== 1 || !row || (row.powerUsage === null && row.bill === null)) {
    throw new Error("선택한 지역과 월의 한전 집계 자료를 확인하지 못했습니다.");
  }
  return { households: row.houseCnt, averageKwh: row.powerUsage, averageBill: row.bill };
}
