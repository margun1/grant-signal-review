import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "주식회사 에너인프라의 경영비서" },
    { name: "description", content: "정부지원사업 공고 적합성 판단과 사업계획서 검토를 돕는 에너인프라 사내 경영비서" },
    { property: "og:title", content: "주식회사 에너인프라의 경영비서" },
    { property: "og:description", content: "정부지원사업 공고 적합성 판단과 사업계획서 검토를 돕는 에너인프라 사내 경영비서" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => navigate({ to: data.session ? "/assistant" : "/auth", replace: true }));
  }, [navigate]);
  return <div className="p-10 text-muted-foreground">이동 중…</div>;
}
