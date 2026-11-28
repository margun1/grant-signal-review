import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CompanyProfile } from "@/components/company/CompanyProfile";

const ORIGIN = "https://grant-signal-review.lovable.app";

export const Route = createFileRoute("/")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "주식회사 에너인프라 · POWERBOARD 전력 사용량 모니터링" },
      {
        name: "description",
        content:
          "분전반 커버만 교체하면 전력 사용량을 바로 보여주는 POWERBOARD. 전기 공사 없이, 앱 없이, 항상 켜진 화면으로 보여줍니다. 주식회사 에너인프라가 직접 개발·제조합니다.",
      },
      { property: "og:title", content: "주식회사 에너인프라 · POWERBOARD" },
      {
        property: "og:description",
        content: "분전반 커버만 교체하면 전력 사용량을 바로 보여주는 POWERBOARD. 전기 공사 없이, 앱 없이, 항상 켜진 화면.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${ORIGIN}/` },
      { property: "og:image", content: `${ORIGIN}/powerboard-og.jpg` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: `${ORIGIN}/powerboard-og.jpg` },
    ],
    links: [{ rel: "canonical", href: `${ORIGIN}/` }],
  }),
  component: LandingPage,
});

function LandingPage() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setSignedIn(Boolean(data.session));
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#F6F7F9]">
      <header className="border-b border-[#E1E4E8] bg-white">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <img src="/enerinfra-logo.png" alt="주식회사 에너인프라" width={986} height={170} className="h-6 w-auto sm:h-7" />
          <nav className="ml-auto flex items-center gap-2">
            {signedIn ? (
              <Link
                to="/company"
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#153367] px-4 text-sm font-bold text-white hover:bg-[#10254B]"
              >
                경영비서 열기 <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            ) : (
              <>
                <Link
                  to="/auth"
                  className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-bold text-[#153367] hover:bg-[#E8EDF5]"
                >
                  로그인
                </Link>
                <Link
                  to="/signup"
                  className="inline-flex min-h-11 items-center rounded-full bg-[#153367] px-4 text-sm font-bold text-white hover:bg-[#10254B]"
                >
                  가입하기
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <div className="px-4 py-6 sm:py-10">
        <CompanyProfile />
      </div>

      <footer className="border-t border-[#E1E4E8] bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-6 text-sm">
          <Link to="/contact" className="font-semibold text-[#153367] underline">
            POWERBOARD 문의하기
          </Link>
          <Link to="/book" className="font-semibold text-[#153367] underline">
            미팅 예약
          </Link>
          <span className="ml-auto text-muted-foreground">© 주식회사 에너인프라</span>
        </div>
      </footer>
    </main>
  );
}
