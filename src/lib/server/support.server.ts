import { XMLParser } from "fast-xml-parser";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  noticeFromRow,
  recommendSupport,
  supportUrl,
  type Preferences,
  type SupportNotice,
} from "../support";

function unpack(value: unknown): { rows: Record<string, unknown>[]; count: number | null } {
  const root = z.record(z.string(), z.unknown()).safeParse(value);
  if (!root.success) throw new Error("K-Startup 응답을 읽지 못했습니다.");
  const r = root.data;
  if (r["results"]) return unpack(r["results"]);
  if (r["data"]) {
    const data = r["data"];
    const container = z.record(z.string(), z.unknown()).safeParse(data);
    const rows = Array.isArray(data) ? data : container.success ? container.data["item"] : [];
    const normalized = rows
      ? z
          .array(z.record(z.string(), z.unknown()))
          .parse(Array.isArray(rows) ? rows : [rows])
          .map((row) => {
            if (!row["col"]) return row;
            const cols = z
              .array(
                z.object({
                  "@_name": z.string(),
                  "#text": z.union([z.string(), z.number()]).optional(),
                }),
              )
              .parse(Array.isArray(row["col"]) ? row["col"] : [row["col"]]);
            return Object.fromEntries(cols.map((col) => [col["@_name"], col["#text"] ?? ""]));
          })
      : [];
    return { rows: normalized, count: Number(r["matchCount"] ?? r["totalCount"]) || null };
  }
  if (r["items"]) {
    const items = z.record(z.string(), z.unknown()).parse(r["items"]);
    const row = items["item"];
    return {
      rows: row
        ? z.array(z.record(z.string(), z.unknown())).parse(Array.isArray(row) ? row : [row])
        : [],
      count: Number(r["matchCount"] ?? r["totalCount"]) || null,
    };
  }
  if (r["response"]) return unpack(r["response"]);
  if (r["body"]) return unpack(r["body"]);
  if (Number(r["currentCount"]) === 0) return { rows: [], count: 0 };
  throw new Error("K-Startup 조회 권한이나 응답 형식을 확인해 주세요.");
}
async function fetchNotices(key: string, format: "json" | "xml", now = new Date()) {
  const notices: SupportNotice[] = [];
  let complete = false;
  const signal = AbortSignal.timeout(25000);
  for (let page = 1; page <= 30; page++) {
    let response: Response;
    try {
      response = await fetch(supportUrl(key, format, page), {
        redirect: "manual",
        signal,
      });
    } catch {
      throw new Error("K-Startup 연결이 지연되고 있습니다. 잠시 후 다시 조회해 주세요.");
    }
    if (!response.ok)
      throw new Error(
        `K-Startup 조회 실패 (${response.status}). 공공데이터포털에서 이 서비스의 활용 승인을 확인해 주세요.`,
      );
    const text = await response.text();
    let value: unknown;
    try {
      value = text.trim().startsWith("<")
        ? new XMLParser({ ignoreAttributes: false, parseTagValue: false }).parse(text)
        : JSON.parse(text);
    } catch {
      throw new Error("K-Startup 응답을 읽지 못했습니다.");
    }
    const { rows, count } = unpack(value);
    notices.push(...rows.map(noticeFromRow));
    if (!rows.length || rows.length < 100 || (count !== null && notices.length >= count)) {
      complete = true;
      break;
    }
  }
  const unique = [...new Map(notices.map((n) => [n.id || n.url, n])).values()];
  return {
    fetchedAt: now.toISOString(),
    format,
    notices: unique,
    complete,
  };
}

type StorageClient = SupabaseClient<Database>;
const snapshotPath = "support/kstartup-announcements.json";
const snapshotSchema = z.object({
  fetchedAt: z.iso.datetime(),
  complete: z.boolean(),
  notices: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      content: z.string(),
      target: z.string(),
      region: z.string(),
      tenure: z.string(),
      field: z.string(),
      start: z.string(),
      end: z.string(),
      recruiting: z.string(),
      url: z.string().refine((url) => !url || /^https?:\/\//i.test(url)),
    }),
  ),
});

export function supportServiceKey() {
  return process.env["DATA_GO_KEY"]?.trim();
}

function requireSupportKey(key: string | undefined) {
  if (!key)
    throw new Error("공공데이터포털 K-Startup 활용 승인과 DATA_GO_KEY 설정을 확인해 주세요.");
  return key;
}

async function readSnapshot(client: StorageClient) {
  const { data, error } = await client.storage.from("documents").download(snapshotPath);
  if (error || !data) return null;
  const parsed = snapshotSchema.safeParse(
    await data
      .text()
      .then(JSON.parse)
      .catch(() => null),
  );
  return parsed.success ? parsed.data : null;
}

export async function loadSupport(
  key: string | undefined,
  preferences: Preferences,
  format: "json" | "xml",
  now = new Date(),
  client?: StorageClient,
) {
  const snapshot = client && format === "json" ? await readSnapshot(client) : null;
  const data = snapshot ?? (await fetchNotices(requireSupportKey(key), format, now));
  return {
    fetchedAt: data.fetchedAt,
    format,
    recommendations: recommendSupport(data.notices, preferences, now),
    checkedCount: data.notices.length,
    complete: data.complete,
    scheduled: snapshot !== null,
  };
}

export async function refreshSupportSnapshot(admin: StorageClient, now = new Date()) {
  const hour = (now.getUTCHours() + 9) % 24;
  if (hour !== 10 && hour !== 14) return "skip";
  const key = supportServiceKey();
  if (!key) return "missing-key";

  const existing = await readSnapshot(admin);
  const startOfHour = Math.floor(now.getTime() / 3600000) * 3600000;
  if (existing && Date.parse(existing.fetchedAt) >= startOfHour) return "already-refreshed";

  const snapshot = await fetchNotices(key, "json", now);
  const { error } = await admin.storage
    .from("documents")
    .upload(snapshotPath, new Blob([JSON.stringify(snapshot)], { type: "application/json" }), {
      upsert: true,
      cacheControl: "0",
      contentType: "application/json",
    });
  if (error) throw new Error("K-Startup 공고를 저장하지 못했습니다.");
  return "refreshed";
}
