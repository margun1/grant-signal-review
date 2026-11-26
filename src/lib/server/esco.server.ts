import { XMLParser } from "fast-xml-parser";
import { z } from "zod";
import type { EscoCompany } from "../competitors";

const endpoint = "https://apis.data.go.kr/B553530/ESCO";
const pageSize = 100;
const maxPages = 30;
const record = z.record(z.string(), z.unknown());

function unpack(value: unknown) {
  const root = record.parse(value);
  const envelope = record.parse(root["response"] ?? root);
  const header = record.parse(envelope["header"] ?? {});
  const code = header["resultCode"] ?? envelope["resultCode"];
  if (code !== undefined && !["0", "00", "0000"].includes(String(code))) {
    throw new Error("공공데이터포털의 ESCO 활용 승인과 DATA_GO_KEY를 확인해 주세요.");
  }
  const body = record.parse(envelope["body"] ?? envelope);
  if (!("items" in body || "data" in body || "item" in body || Number(body["totalCount"]) === 0)) {
    throw new Error("ESCO 목록이 포함된 응답을 받지 못했습니다.");
  }
  const items = body["items"] ?? body["data"] ?? body["item"];
  const item = items && typeof items === "object" && "item" in items ? items.item : items;
  const rows = z
    .array(record)
    .parse(item == null || item === "" ? [] : Array.isArray(item) ? item : [item]);
  const count = Number(body["totalCount"]);
  return { rows, total: Number.isFinite(count) && count >= 0 ? count : null };
}

function companyFromRow(row: Record<string, unknown>): EscoCompany | null {
  const fields = new Map(
    Object.entries(row).map(([key, value]) => [key.toLowerCase().replaceAll("_", ""), value]),
  );
  const field = (...keys: string[]) => {
    for (const key of keys) {
      const value = fields.get(key);
      if (typeof value === "string" && value.trim()) return value.trim();
      if (typeof value === "number") return String(value);
    }
    return "";
  };
  const name = field(
    "entname",
    "entnm",
    "corpname",
    "corpnm",
    "cmpnynm",
    "companyname",
    "companynm",
    "bizplcnm",
    "bplcnm",
    "entrpsnm",
    "entrpsname",
    "esconm",
    "conm",
    "bsnsnm",
    "nm",
    "업체명",
    "기업명",
    "상호",
  );
  if (!name) return null;
  return {
    name,
    product: field("productnm", "productname", "prdctnm", "goodsnm", "제품명"),
    description: field(
      "businessdesc",
      "bizcn",
      "bizdc",
      "bsnscont",
      "productdesc",
      "prdctdc",
      "srvccn",
      "사업내용",
      "제품설명",
    ),
    industry: field("induty", "indutynm", "biztype", "industry", "bizkind", "업종"),
    region: field(
      "region",
      "sido",
      "sidonm",
      "addr",
      "address",
      "adres",
      "roadnmaddr",
      "지역",
      "주소",
      "소재지",
    ),
    years: field("businessyears", "bizyears", "업력"),
    revenue: field("annualrevenue", "annualsales", "연매출", "연매출액"),
  };
}

export async function fetchEscoCompanies(key: string, format: "json" | "xml") {
  const companies = new Map<string, EscoCompany>();
  const signal = AbortSignal.timeout(25000);
  let serviceKey = key;
  try {
    serviceKey = decodeURIComponent(key);
  } catch {
    /* Raw portal key. */
  }

  let complete = false;
  let scanned = 0;
  for (let page = 1; page <= maxPages; page++) {
    const url = new URL(endpoint);
    url.search = new URLSearchParams({
      serviceKey,
      pageNo: String(page),
      numOfRows: String(pageSize),
      type: format,
      _type: format,
    }).toString();
    let response: Response;
    try {
      response = await fetch(url, { redirect: "error", signal });
    } catch {
      throw new Error("한국에너지공단 ESCO 목록에 연결하지 못했습니다.");
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error("공공데이터포털의 ESCO 활용 승인과 DATA_GO_KEY를 확인해 주세요.");
    }
    if (!response.ok) throw new Error(`ESCO 목록 조회에 실패했습니다 (${response.status}).`);
    let payload: unknown;
    try {
      const text = await response.text();
      payload = text.trimStart().startsWith("<")
        ? new XMLParser({ parseTagValue: false }).parse(text)
        : JSON.parse(text);
    } catch {
      throw new Error("ESCO 응답을 읽지 못했습니다.");
    }
    const { rows, total } = unpack(payload);
    const previousSize = companies.size;
    for (const row of rows) {
      const company = companyFromRow(row);
      if (company) companies.set(JSON.stringify(company), company);
    }
    if (rows.length && companies.size === 0)
      throw new Error("ESCO 응답에서 업체명 필드를 확인하지 못했습니다.");
    scanned += rows.length;
    if (!rows.length || (total === null ? rows.length < pageSize : scanned >= total)) {
      complete = !rows.length || companies.size > previousSize;
      break;
    }
    if (companies.size === previousSize) break;
  }
  return { companies: [...companies.values()], complete };
}
