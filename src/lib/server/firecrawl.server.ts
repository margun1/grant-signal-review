const GATEWAY = "https://connector-gateway.lovable.dev/firecrawl/v2";

export type ScrapeResult =
  | { ok: true; markdown: string; title?: string; links: string[] }
  | { ok: false; reason: string };

export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  const lovable = process.env["LOVABLE_API_KEY"];
  const key = process.env["FIRECRAWL_API_KEY"];
  if (!lovable || !key) return { ok: false, reason: "자료 가져오기 연결이 설정되지 않았습니다." };
  try {
    const res = await fetch(`${GATEWAY}/scrape`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovable}`,
        "X-Connection-Api-Key": key,
      },
      body: JSON.stringify({ url, formats: ["markdown", "links"], onlyMainContent: false, timeout: 60000 }),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error(`Firecrawl failed [${res.status}]: ${text.slice(0, 500)}`);
      if (res.status === 402) return { ok: false, reason: "크레딧 부족으로 자료를 가져오지 못했습니다." };
      if (res.status === 403 || res.status === 401) return { ok: false, reason: "접근이 제한된 자료입니다." };
      return { ok: false, reason: `다운로드 실패 (${res.status})` };
    }
    const json = JSON.parse(text) as {
      data?: { markdown?: string; links?: string[]; metadata?: { title?: string; statusCode?: number } };
    };
    const md = json.data?.markdown ?? "";
    const status = json.data?.metadata?.statusCode;
    if (status && status >= 400) return { ok: false, reason: `접근 제한 또는 없는 페이지 (${status})` };
    if (md.trim().length < 40) return { ok: false, reason: "판독할 수 있는 내용이 없습니다." };
    const out: ScrapeResult = { ok: true, markdown: md, links: json.data?.links ?? [] };
    if (json.data?.metadata?.title) out.title = json.data.metadata.title;
    return out;
  } catch (e) {
    return { ok: false, reason: `다운로드 실패: ${(e as Error).message}` };
  }
}
