import { XMLParser } from "fast-xml-parser";
import { z } from "zod";
import type { EscoCompany } from "../competitors";

const endpoint = "https://apis.data.go.kr/B553530/ESCO";
const pageSize = 100;
const maxPages = 30;
const record = z.record(z.string(), z.unknown());

const portalErrors: Readonly<Record<number, string>> = {
  10: "공공데이터포털이 ESCO 요청 형식을 거부했습니다. 조회 기능과 요청 항목을 확인해 주세요.",
  11: "ESCO 조회에 필요한 필수 요청 항목이 누락되었습니다.",
  12: "공공데이터포털에서 요청한 ESCO 조회 기능을 찾지 못했습니다. 상세기능의 요청 주소를 확인해 주세요.",
  20: "이 인증키에 ESCO API 이용 권한이 없습니다. 공공데이터포털에서 해당 서비스의 활용 승인을 확인해 주세요.",
  21: "이 인증키에 ESCO API 이용 권한이 없습니다. 공공데이터포털에서 해당 서비스의 활용 승인을 확인해 주세요.",
  22: "ESCO API 요청 한도를 초과했습니다. 사용량을 확인한 뒤 다시 조회해 주세요.",
  30: "공공데이터포털이 등록되지 않은 인증키로 응답했습니다. Lovable의 DATA_GO_KEY를 확인해 주세요.",
  31: "공공데이터포털 인증키의 사용 기간이 만료되었습니다.",
  32: "공공데이터포털이 등록되지 않은 IP로 응답했습니다. 해당 API의 허용 IP 설정을 확인해 주세요.",
  33: "공공데이터포털이 서명되지 않은 요청으로 응답했습니다. 서비스의 인증 방식을 확인해 주세요.",
};

function readPortalCode(root: Record<string, unknown>) {
  const envelope = record.parse(root["response"] ?? root);
  const header = record.safeParse(envelope["header"] ?? root["header"]).data;
  const errorEnvelope = record.safeParse(root["OpenAPI_ServiceResponse"]).data;
  const commonHeader = record.safeParse(errorEnvelope?.["cmmMsgHeader"] ?? root["cmmMsgHeader"]).data;
  const code = commonHeader?.["returnReasonCode"] ?? header?.["resultCode"] ?? envelope["resultCode"];
  if (typeof code !== "string" && typeof code !== "number") return null;
  const value = String(code).trim();
  return /^\d{1,4}$/.test(value) ? Number(value) : NaN;
}

function unpack(root: Record<string, unknown>) {
  const envelope = record.parse(root["response"] ?? root);
  const body = record.parse(envelope["body"] ?? envelope);
  if (!("items" in body || "data" in body || "item" in body || Number(body["totalCount"]) === 0)) {
    throw new Error("ESCO 목록이 포함된 응답을 받지 못했습니다.");
  }
  const items = body["items"] ?? body["data"] ?? body["item"];
  const item = items && typeof items === "object" && "item" in items ? items.item : items;
  const isEmptyObject = item != null && typeof item === "object" && Object.keys(item).length === 0;
  const rows = z
    .array(record)
    .parse(item == null || item === "" || isEmptyObject ? [] : Array.isArray(item) ? item : [item]);
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
  const seenPages = new Set<string>();
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
      response = await fetch(url, {
        redirect: "manual",
        headers: { Accept: format === "json" ? "application/json" : "application/xml, text/xml" },
        signal,
      });
    } catch {
      throw new Error(signal.aborted
        ? "ESCO 공공데이터 응답 시간이 초과되었습니다. 잠시 후 다시 조회해 주세요."
        : "서비스 서버에서 공공데이터포털 ESCO API에 연결하지 못했습니다. 서버의 외부 접속 상태를 확인해 주세요.");
    }
    if (response.status >= 300 && response.status < 400) {
      throw new Error("ESCO 요청 주소에서 다른 주소로 이동하라는 응답을 받았습니다. 공공데이터포털 상세기능의 요청 주소를 확인해 주세요.");
    }

    let root: Record<string, unknown> | undefined;
    try {
      const text = (await response.text()).trim();
      if (!/^<(?:!doctype\s+html|html\b)/i.test(text)) {
        root = record.safeParse(text.startsWith("<")
          ? new XMLParser({ parseTagValue: false }).parse(text)
          : JSON.parse(text)).data;
      }
    } catch {
      // Gateway and proxy errors may return content outside the API formats.
    }
    const code = root ? readPortalCode(root) : null;
    if (code === 3 && response.ok) {
      complete = true;
      break;
    }
    if (code !== null && code !== 0) {
      throw new Error(portalErrors[code] ?? "공공데이터포털에서 ESCO 요청을 처리하지 못했습니다. 잠시 후 다시 조회해 주세요.");
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error(`ESCO API가 접근을 거부했습니다 (HTTP ${response.status}). ESCO 활용 승인과 배포 서버의 접속 허용 여부를 확인해 주세요.`);
    }
    if (response.status === 404) {
      throw new Error("ESCO 조회 주소를 찾을 수 없습니다 (HTTP 404). 공공데이터포털 상세기능의 요청 주소를 확인해 주세요.");
    }
    if (response.status === 429) throw new Error("ESCO API 요청이 제한되었습니다. 잠시 후 다시 조회해 주세요.");
    if (!response.ok) throw new Error(`ESCO 목록 조회에 실패했습니다 (HTTP ${response.status}).`);
    if (!root) throw new Error("ESCO API가 JSON 또는 XML 목록을 반환하지 않았습니다.");
    const { rows, total } = unpack(root);
    const signature = JSON.stringify(rows);
    if (seenPages.has(signature)) break;
    seenPages.add(signature);
    for (const row of rows) {
      const company = companyFromRow(row);
      if (company) companies.set(JSON.stringify(company), company);
    }
    if (rows.length && companies.size === 0)
      throw new Error("ESCO 응답에서 업체명 필드를 확인하지 못했습니다.");
    scanned += rows.length;
    if (!rows.length || (total === null ? rows.length < pageSize : scanned >= total)) {
      complete = true;
      break;
    }
  }
  return { companies: [...companies.values()], complete };
}
