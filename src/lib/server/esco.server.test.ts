import { afterEach, expect, it, vi } from "vitest";
import { defaultCompetitorProfile, rankCompetitors } from "../competitors";
import { fetchEscoCompanies } from "./esco.server";

afterEach(() => vi.unstubAllGlobals());

it("normalizes ESCO JSON rows and ranks explicit energy monitoring above an address match", async () => {
  const fetchMock = vi.fn(async (_url: URL) =>
    Response.json({
      response: {
        header: { resultCode: "00" },
        body: {
          totalCount: 2,
          items: [
            { entNm: "지역 업체", adres: "경기도 남양주시" },
            { entNm: "계측 업체", productNm: "전력 모니터링", bizCn: "에너지 사용량 계측" },
          ],
        },
      },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);

  const response = await fetchEscoCompanies("test%2Bkey", "json");
  expect(response.complete).toBe(true);
  const url = fetchMock.mock.calls[0]?.[0];
  expect(url?.pathname).toBe("/B553530/ESCO");
  expect(url?.searchParams.get("serviceKey")).toBe("test+key");
  expect(url?.searchParams.get("_type")).toBe("json");
  const ranked = rankCompetitors(response.companies, defaultCompetitorProfile);
  expect(ranked.map((company) => company.name)).toEqual(["계측 업체", "지역 업체"]);
  expect(ranked[1]?.product).toBe("");
});

it("reads the XML form without inferring product names", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          "<response><header><resultCode>00</resultCode></header><body><totalCount>1</totalCount><items><item><entrpsNm>업체</entrpsNm></item></items></body></response>",
        ),
    ),
  );
  await expect(fetchEscoCompanies("test-key", "xml")).resolves.toMatchObject({
    complete: true,
    companies: [{ name: "업체", product: "" }],
  });
});

it("reports an ESCO permission error from the portal XML wrapper even in JSON mode", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(
    "<OpenAPI_ServiceResponse><cmmMsgHeader><returnReasonCode>20</returnReasonCode></cmmMsgHeader></OpenAPI_ServiceResponse>",
    { status: 500 },
  )));
  await expect(fetchEscoCompanies("test-key", "json")).rejects.toThrow("ESCO API 이용 권한이 없습니다");
});

it("reports a missing registered key from a portal error returned with HTTP 200", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ response: { header: { resultCode: "30" } } })));
  await expect(fetchEscoCompanies("test-key", "json")).rejects.toThrow("등록되지 않은 인증키");
});

it("accepts a valid empty ESCO response with an empty items object", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({
    response: { header: { resultCode: "00" }, body: { totalCount: 0, items: {} } },
  })));
  await expect(fetchEscoCompanies("test-key", "json")).resolves.toEqual({ complete: true, companies: [] });
});

it("does not forward the service key on redirects", async () => {
  const mock = vi.fn(async (_url: URL, _init: RequestInit) =>
    new Response(null, { status: 302, headers: { location: "https://example.com/" } }),
  );
  vi.stubGlobal("fetch", mock);
  await expect(fetchEscoCompanies("test-key", "json")).rejects.toThrow("상세기능의 요청 주소");
  expect(mock).toHaveBeenCalledTimes(1);
  expect(mock.mock.calls[0]?.[1].redirect).toBe("manual");
});
