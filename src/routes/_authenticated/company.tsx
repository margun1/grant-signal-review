import { createFileRoute, Link } from "@tanstack/react-router";
import { useMe } from "@/hooks/use-auth";
import { ArrowRight } from "lucide-react";
import { CompanyProfile } from "@/components/company/CompanyProfile";

export const Route = createFileRoute("/_authenticated/company")({
  staticData: { sitemap: false },
  head: () => ({ meta: [{ title: "회사소개 · 주식회사 에너인프라" }] }),
  component: CompanyPage,
});

function CompanyPage() {
  const { me } = useMe();
  return (
    <div className="space-y-5">
      <CompanyProfile />
      {me?.isStaff && (
        <Link
          to="/assistant"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          AI 비서 열기 <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      )}
    </div>
  );
}
