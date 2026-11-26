import { afterEach, expect, it, vi } from "vitest";
import { fetchRentalElectricityTariffs } from "./rental-electricity.server";

afterEach(() => vi.unstubAllGlobals());

it("requests the configured public endpoint and reads a paginated XML response", async () => {
  const fetchMock = vi.fn(
    async (_url: URL) =>
      new Response(
        "<response><header><resultCode>00</resultCode></header><body><totalCount>11</totalCount><items><item><hsmpNm>테스트 단지</hsmpNm><elecCgs>단일계약</elecCgs></item></items></body></response>",
      ),
  );
  vi.stubGlobal("fetch", fetchMock);
  await expect(fetchRentalElectricityTariffs("mock%2Bkey", 2)).resolves.toEqual({
    rows: [{ hsmpNm: "테스트 단지", elecCgs: "단일계약" }],
    totalCount: 11,
    pageSize: 10,
  });
  const url = fetchMock.mock.calls[0]?.[0];
  expect(url?.origin).toBe("https://apis.data.go.kr");
  expect(url?.pathname).toBe("/B552555/getSimElecCgs");
  expect(Object.fromEntries(url?.searchParams ?? [])).toEqual({
    serviceKey: "mock+key",
    pageNo: "2",
    numOfRows: "10",
  });
});

it("reports an upstream rejection instead of displaying it as an empty list", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        response: { header: { resultCode: "30" } },
      }),
    ),
  );
  await expect(fetchRentalElectricityTariffs("test-key", 1)).rejects.toThrow("활용 승인");
});
