import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/ui";
import { SampleCompetitorProducts } from "@/components/app/SampleCompetitorProducts";

export const Route = createFileRoute("/_authenticated/competitors")({
  staticData: { sitemap: false },
  head: () => ({ meta: [{ title: "경쟁제품 · 에너인프라 경영비서" }] }),
  component: CompetitorsPage,
});

function CompetitorsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="경쟁제품" />
      <SampleCompetitorProducts />
    </div>
  );
}
