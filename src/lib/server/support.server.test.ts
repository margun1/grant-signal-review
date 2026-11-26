
import { Blob as NodeBlob } from "node:buffer";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, expect, it, vi } from "vitest";
import type { Database } from "@/integrations/supabase/types";
import { DEFAULT_PREFERENCES } from "../support";
import { loadSupport, refreshSupportSnapshot } from "./support.server";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("refreshes at both scheduled KST hours and serves the saved recommendations", async () => {
  let saved: NodeBlob | undefined;
  const upload = vi.fn(async (_path: string, blob: NodeBlob) => {
    saved = blob;
    return { error: null };
  });
  const download = vi.fn(async () => ({
    data: saved,
  }));
  const client = {
    storage: { from: () => ({ upload, download }) },
  } as unknown as SupabaseClient<Database>;
  const fetchMock = vi.fn(async () =>
    Response.json({
      data: [
        {
          pbanc_sn: "1",
          biz_pbanc_nm: "제조기업 시제품 지원",
          supt_biz_clsfc: "cmrczn_tab6",
          supt_regin: "경기도",
          rcrt_prgs_yn: "Y",
          pbanc_rcpt_end_dt: "20261130",
          detl_pg_url: "https://www.k-startup.go.kr/example",
        },
      ],
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("Blob", NodeBlob);
  vi.stubEnv("DATA_GO_KEY", "mock%2Bkey");

  expect(await refreshSupportSnapshot(client, new Date("2026-11-26T00:00:00Z"))).toBe("skip");
  expect(await refreshSupportSnapshot(client, new Date("2026-11-26T01:00:00Z"))).toBe("refreshed");
  expect(await refreshSupportSnapshot(client, new Date("2026-11-26T01:05:00Z"))).toBe(
    "already-refreshed",
  );
  expect(await refreshSupportSnapshot(client, new Date("2026-11-26T05:00:00Z"))).toBe("refreshed");
  expect(upload).toHaveBeenCalledTimes(2);
  expect(fetchMock).toHaveBeenCalledTimes(2);

  const current = await loadSupport(
    undefined,
    DEFAULT_PREFERENCES,
    "json",
    new Date("2026-11-26T05:05:00Z"),
    client,
  );
  expect(current.fetchedAt).toBe("2026-11-26T05:00:00.000Z");
  expect(current.scheduled).toBe(true);
  expect(current.recommendations).toMatchObject([
    { title: "제조기업 시제품 지원", field: "기술개발 R&D" },
  ]);
  expect(fetchMock).toHaveBeenCalledTimes(2);

  const expired = await loadSupport(
    undefined,
    DEFAULT_PREFERENCES,
    "json",
    new Date("2026-12-01T00:00:00Z"),
    client,
  );
  expect(expired.recommendations).toEqual([]);
});
