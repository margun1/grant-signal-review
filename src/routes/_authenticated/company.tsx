import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight, Zap } from "lucide-react";

export const Route = createFileRoute("/_authenticated/company")({
  head: () => ({ meta: [{ title: "회사소개 · 주식회사 에너인프라" }] }),
  component: CompanyPage,
});

const office = "경기도 남양주시 진접읍 경복대로 425-80, 경복대학교 충효관 4층 6418호";

function CompanyPage() {
  return (
    <article className="mx-auto max-w-4xl space-y-5">
      <header className="rounded-2xl border bg-card p-6 sm:p-9">
        <div className="flex items-center gap-2 text-sm font-semibold text-gold">
          <Zap aria-hidden="true" className="size-4 shrink-0" />
          <span>에너인프라 회사소개</span>
          <img
            src="/enerinfra-logo.png"
            alt=""
            width={986}
            height={170}
            className="ml-auto h-auto w-24 shrink-0 sm:w-40"
          />
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          전기를 보이게 만드는 회사
        </h1>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          (주)에너인프라는 이미 지어진 집과 건물에서 전기사용량을 바로 볼 수 있게 하는{" "}
          <span className="whitespace-nowrap">장치를 만듭니다.</span>
        </p>
        <blockquote className="mt-6 border-l-2 border-primary pl-4 font-medium leading-relaxed">
          <p>“참으라고 말하지 않습니다. 지금 얼마를 쓰고 있는지를 보여줍니다.”</p>
          <cite className="mt-1 block text-center text-sm not-italic text-muted-foreground">
            - EnerInfra -
          </cite>
        </blockquote>
        <Link
          to="/assistant"
          className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          AI 비서 열기 <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </header>

      <section aria-labelledby="company-overview" className="rounded-2xl border bg-card p-6 sm:p-8">
        <h2 id="company-overview" className="text-xl font-bold">
          회사개요
        </h2>
        <div className="mt-4 space-y-3 leading-relaxed">
          <p>㈜에너인프라는 2026년 7월 경기도 남양주시에서 설립된 하드웨어 스타트업입니다.</p>
          <p>
            첫 제품 <strong>POWERBOARD</strong>는 분전반 커버를 교체하는 것만으로 전력 사용량을
            실시간으로 보여주는 장치입니다.
          </p>
          <p>
            회로 설계, 기판, 펌웨어, 기구 설계는 사내에서 직접 개발하고, 제조와 설치는 국내 전문
            파트너와 함께합니다.
          </p>
          <p>
            환경부 에코스타트업 지원사업을 통해 시제품을 완성했고, 경복대학교 창업보육센터를
            거점으로 2026년 하반기 국내 실증과 일본 시장 진입을 준비하고 있습니다.
          </p>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <a
            href="https://enerinfra.github.io/?lang=ko"
            className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm font-semibold hover:bg-muted"
          >
            POWERBOARD 제품 소개 <ArrowUpRight aria-hidden="true" className="size-4" />
          </a>
          <a
            href="https://enerinfra.github.io/meet/?lang=ko"
            className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm font-semibold hover:bg-muted"
          >
            EnerInfra — POWERBOARD <ArrowUpRight aria-hidden="true" className="size-4" />
          </a>
        </div>
      </section>

      <section aria-labelledby="company-details" className="rounded-2xl border bg-card p-6 sm:p-8">
        <h2 id="company-details" className="text-xl font-bold">
          회사 정보
        </h2>
        <dl className="mt-4 grid gap-x-8 gap-y-4 text-sm leading-relaxed sm:grid-cols-2">
          <div>
            <dt className="font-semibold">상호</dt>
            <dd>주식회사 에너인프라 (EnerInfra Inc.)</dd>
          </div>
          <div>
            <dt className="font-semibold">대표자</dt>
            <dd>유완재</dd>
          </div>
          <div>
            <dt className="font-semibold">설립</dt>
            <dd>
              <time dateTime="2026-07-01">2026년 7월 1일</time>
            </dd>
          </div>
          <div>
            <dt className="font-semibold">사업</dt>
            <dd>전력 모니터링 장치 개발·제조, 산업용 로봇·무인시스템</dd>
          </div>
          <div>
            <dt className="font-semibold">소재지·사무실</dt>
            <dd>
              경복대학교 창업보육센터
              <br />
              {office}
            </dd>
          </div>
          <div>
            <dt className="font-semibold">이메일</dt>
            <dd>
              <a className="underline" href="mailto:dbdhkswo@naver.com">
                dbdhkswo@naver.com
              </a>
            </dd>
          </div>
        </dl>
      </section>
    </article>
  );
}
