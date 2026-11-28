import { createFileRoute, Link } from "@tanstack/react-router";
import { useMe } from "@/hooks/use-auth";
import { ArrowRight, ArrowUpRight, Check, Zap } from "lucide-react";

export const Route = createFileRoute("/_authenticated/company")({
  head: () => ({ meta: [{ title: "회사소개 · 주식회사 에너인프라" }] }),
  component: CompanyPage,
});

function CompanyPage() {
  const { me } = useMe();
  return (
    <article className="mx-auto max-w-4xl space-y-5">
      <section aria-labelledby="powerboard-intro" className="grid overflow-hidden rounded-3xl border border-[#E1E4E8] bg-[#F6F7F9] text-[#101722] xl:pointer-fine:grid-cols-[0.9fr_1.1fr]">
        <div className="flex flex-col justify-center p-5 sm:p-8 xl:pointer-fine:p-10">
          <p className="mb-4 w-fit rounded-full bg-[#FFF0D5] px-3 py-1 text-xs font-bold tracking-wider text-[#805000]">
            <span aria-hidden="true" className="mr-2 inline-block size-1.5 rounded-full bg-[#E69713] align-middle" />EVERYDAY
          </p>
          <h2 id="powerboard-intro" className="break-keep text-[clamp(1.65rem,4vw,2.6rem)] leading-tight font-extrabold tracking-tight">
            아이가 먼저<br />콘센트를 뽑습니다.
          </h2>
          <p className="mt-4 break-keep text-sm leading-relaxed text-[#526071] sm:text-base">
            아이가 있는 실증 9가정 모두, 아이가 먼저 콘센트를 뽑았습니다.
            숫자를 몰라도 색과 표정으로 알 수 있습니다.
          </p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <a href="https://enerinfra.github.io/product.html?lang=ko"
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#153367] px-4 text-sm font-bold text-white hover:bg-[#10254B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#153367]">
              자세히 보기 <ArrowRight aria-hidden="true" className="size-4" />
            </a>
            <Link to="/contact"
              className="inline-flex min-h-11 items-center rounded-full border border-[#B8C0CC] bg-white px-4 text-sm font-bold hover:bg-[#E8EDF5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#153367]">
              문의하기
            </Link>
          </div>
          <ul className="mt-6 flex flex-wrap gap-x-4 gap-y-2 border-t border-[#DCE0E6] pt-4 text-sm font-semibold">
            {["전기 공사 없이", "앱 없이", "항상 켜진 화면"].map((feature) => (
              <li key={feature} className="flex items-center gap-1.5">
                <Check aria-hidden="true" className="size-4 rounded-full bg-[#F5A51A] p-0.5" />
                {feature}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative aspect-[3/2] min-h-0 xl:pointer-fine:aspect-auto">
          <img src="/powerboard-family.jpg" width={1305} height={860} fetchPriority="high"
            alt="벽에 설치된 POWERBOARD 전력 사용량 화면을 함께 보는 아이와 보호자"
            className="absolute inset-0 size-full object-cover object-center" />
        </div>
      </section>
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
        <h1 className="mt-3 whitespace-nowrap text-[clamp(1rem,5vw,1.875rem)] font-bold tracking-tight sm:text-4xl">
          전기를 보이게 만드는 회사
        </h1>
        <p className="mt-4 leading-relaxed text-muted-foreground">
          주식회사 에너인프라는 이미 지어진 집과 건물에서 전기사용량을 바로 볼 수 있게 하는{" "}
          <span className="whitespace-nowrap">장치를 만듭니다.</span>
        </p>
        <blockquote className="mt-6 border-l-2 border-primary pl-4 font-medium leading-relaxed">
          <p>“참으라고 말하지 않습니다. 지금 얼마를 쓰고 있는지를 보여줍니다.”</p>
          <cite className="mt-1 block text-center text-sm not-italic text-muted-foreground">
            - EnerInfra -
          </cite>
        </blockquote>
        {me?.isStaff && (
          <Link
            to="/assistant"
            className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            AI 비서 열기 <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        )}
      </header>

      <section aria-labelledby="company-overview" className="rounded-2xl border bg-card p-6 sm:p-8">
        <h2 id="company-overview" className="text-xl font-bold">
          회사개요
        </h2>
        <div className="mt-4 space-y-3 leading-relaxed">
          <p>주식회사 에너인프라는 2026년 7월 경기도 남양주시에서 설립된 하드웨어 스타트업입니다.</p>
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
            href="https://enerinfra.github.io/meet/?lang=ko"
            className="inline-flex items-center gap-1 rounded-md border border-[#CCD9E9] bg-[#E8EFF8] text-[#153367] hover:bg-[#DBE6F5] px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            EnerInfra — POWERBOARD <ArrowUpRight aria-hidden="true" className="size-4" />
          </a>
          <a
            href="https://enerinfra.github.io/?lang=ko"
            className="inline-flex items-center gap-1 rounded-md border border-[#F0C5A4] bg-[#FCE6D5] text-[#542E17] hover:bg-[#F8D5BA] px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            POWERBOARD 제품 소개 <ArrowUpRight aria-hidden="true" className="size-4" />
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
              경기도 남양주시 진접읍 경복대로 425-80
              <br />
              경복대학교 충효관 4층 6418호
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
