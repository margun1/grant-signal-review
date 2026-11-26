import { afterEach, expect, it, vi } from "vitest";
import { fetchNamyangjuHouseAverage } from "./kepco.server";

afterEach(() => vi.unstubAllGlobals());

it("requests the chosen month for Namyangju and parses the household averages", async () => {
  const fetchMock = vi.fn(async (_url: URL) =>
    Response.json({
      data: [{ houseCnt: "1,234", powerUsage: "286.5", bill: "38,920" }],
    }),
  );
  vi.stubGlobal("fetch", fetchMock);

  await expect(fetchNamyangjuHouseAverage("2026-09", "test-key")).resolves.toEqual({
    households: 1234,
    averageKwh: 286.5,
    averageBill: 38920,
  });
  const url = fetchMock.mock.calls[0]?.[0];
  expect(url?.pathname).toBe("/openapi/v1/powerUsage/houseAve.do");
  expect(Object.fromEntries(url?.searchParams ?? [])).toEqual({
    year: "2026",
    month: "09",
    metroCd: "41",
    cityCd: "360",
    returnType: "json",
    apiKey: "test-key",
  });
});

it("keeps unpublished months and rejected credentials distinct", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ data: [] }))
    .mockResolvedValueOnce(new Response(null, { status: 403 }));
  vi.stubGlobal("fetch", fetchMock);

  await expect(fetchNamyangjuHouseAverage("2026-10", "test-key")).resolves.toBeNull();
  await expect(fetchNamyangjuHouseAverage("2026-10", "test-key")).rejects.toThrow("인증키");
});
