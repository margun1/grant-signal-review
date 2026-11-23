import { describe, expect, it } from "vitest";
import {
  DEFAULT_PREFERENCES,
  isReceiving,
  noticeFromRow,
  recommendSupport,
  supportUrl,
  type SupportNotice,
} from "./support";
const now = new Date("2026-11-23T01:00:00Z");
const notice: SupportNotice = {
  id: "1",
  title: "제조업 마케팅 지원",
  content: "제조기업 마케팅",
  target: "제조기업",
  field: "사업화",
  region: "경기",
  tenure: "7년미만",
  start: "20261101",
  end: "20261130",
  recruiting: "Y",
  url: "https://www.k-startup.go.kr/example",
};
describe("K-Startup 추천 규칙", () => {
  it("첨부 문서의 주소와 변수, 실제 모집 필터를 사용", () => {
    const url = supportUrl("test only +/=", "xml", 2);
    expect(url.origin + url.pathname).toBe(
      "https://apis.data.go.kr/B552735/kisedKstartupService01/getAnnouncementInformation01",
    );
    expect(url.searchParams.get("ServiceKey")).toBe("test only +/=");
    expect(url.searchParams.get("returnType")).toBe("xml");
    expect(url.searchParams.get("cond[rcrt_prgs_yn::EQ]")).toBe("Y");
  });
  it("모집 Y이며 현재 접수 기간인 공고만 허용", () => {
    expect(isReceiving(notice, now)).toBe(true);
    expect(isReceiving({ ...notice, recruiting: "N" }, now)).toBe(false);
    expect(isReceiving({ ...notice, start: "20261201" }, now)).toBe(false);
    expect(isReceiving({ ...notice, end: "20261122" }, now)).toBe(false);
  });
  it("추천은 최대 다섯 개", () => {
    expect(
      recommendSupport(
        Array.from({ length: 8 }, (_, i) => ({ ...notice, id: String(i) })),
        DEFAULT_PREFERENCES,
        now,
      ),
    ).toHaveLength(5);
  });
  it("확인되지 않은 연매출과 업력을 확인 필요로 표시", () => {
    const rec = recommendSupport([notice], DEFAULT_PREFERENCES, now)[0];
    expect(rec?.missing).toContain("연 매출 조건");
    expect(rec?.missing).toContain("업력 조건");
  });
  it("명시된 다른 지역과 업력 범위 밖 공고는 제외", () => {
    expect(
      recommendSupport([{ ...notice, region: "부산" }], DEFAULT_PREFERENCES, now),
    ).toHaveLength(0);
    expect(
      recommendSupport([notice], { ...DEFAULT_PREFERENCES, business_years: 7 }, now),
    ).toHaveLength(0);
  });
  it("관심 분야가 공고에 명시되면 높은 순서", () => {
    const rec = recommendSupport(
      [
        { ...notice, id: "1", title: "제조 교육", content: "교육", field: "창업교육" },
        { ...notice, id: "2" },
      ],
      { ...DEFAULT_PREFERENCES, interests: ["마케팅"] },
      now,
    );
    expect(rec[0]?.id).toBe("2");
    expect(rec[0]?.evidence).toContain("관심 분야: 마케팅");
  });
  it("XML과 JSON의 대소문자 차이를 정규화하고 위험한 URL은 제외", () => {
    expect(
      noticeFromRow({ Rcrt_prgs_yn: "Y", detl_pg_url: "www.k-startup.go.kr/a" }).recruiting,
    ).toBe("Y");
    expect(noticeFromRow({ detl_pg_url: "javascript:alert(1)" }).url).toBe("");
  });
});
