import { XMLParser } from "fast-xml-parser";
import { z } from "zod";

const endpoint = "https://apis.data.go.kr/B552555/getSimElecCgs";
export const rentalElectricityPageSize = 10;

const responseSchema = z.object({
  response: z.object({
    header: z.object({ resultCode: z.union([z.string(), z.number()]) }),
    body: z
      .object({
        items: z.unknown().optional(),
        totalCount: z.coerce.number().int().nonnegative().optional(),
      })
      .optional(),
  }),
});

export async function fetchRentalElectricityTariffs(key: string, page: number) {
  const url = new URL(endpoint);
  // URLSearchParams handles encoding for keys copied in either portal format.
  let serviceKey = key;
  try {
    serviceKey = decodeURIComponent(key);
  } catch {
    // Treat malformed percent escapes as part of a raw key.
  }
  url.search = new URLSearchParams({
    serviceKey,
    pageNo: String(page),
    numOfRows: String(rentalElectricityPageSize),
  }).toString();

  let response: Response;
  try {
    response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(12000) });
  } catch {
    throw new Error("공공데이터포털에 연결하지 못했습니다.");
  }
  if (response.status === 401 || response.status === 403) {
    throw new Error("공공데이터포털 인증키와 임대주택단지 전기요금제 활용 승인을 확인해 주세요.");
  }
  if (!response.ok)
    throw new Error(`임대주택단지 전기요금제 조회에 실패했습니다 (${response.status}).`);

  let payload: unknown;
  try {
    const body = await response.text();
    payload = body.trimStart().startsWith("<")
      ? new XMLParser({ parseTagValue: false }).parse(body)
      : JSON.parse(body);
  } catch {
    throw new Error("공공데이터포털 응답을 읽지 못했습니다.");
  }
  const parsed = responseSchema.safeParse(payload);
  if (!parsed.success) throw new Error("공공데이터포털 응답 형식이나 활용 승인을 확인해 주세요.");
  const { header, body } = parsed.data.response;
  if (!["0", "00", "0000"].includes(String(header.resultCode))) {
    throw new Error("공공데이터포털에서 조회를 거부했습니다. 인증키와 활용 승인을 확인해 주세요.");
  }
  const items = body?.items;
  const item = items && typeof items === "object" && "item" in items ? items.item : items;
  const rows = z
    .array(z.record(z.string(), z.unknown()))
    .safeParse(item == null || item === "" ? [] : Array.isArray(item) ? item : [item]);
  if (!rows.success) throw new Error("전기요금제 목록을 읽지 못했습니다.");
  return {
    rows: rows.data.map((row) =>
      Object.fromEntries(
        Object.entries(row).flatMap(([field, value]) =>
          /^[A-Za-z][A-Za-z0-9_]*$/.test(field) &&
          !/key|token|secret|password/i.test(field) &&
          (typeof value === "string" || typeof value === "number")
            ? [[field, String(value)] as const]
            : [],
        ),
      ),
    ),
    totalCount: body?.totalCount ?? null,
    pageSize: rentalElectricityPageSize,
  };
}
