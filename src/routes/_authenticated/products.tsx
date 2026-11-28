import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { productPages } from "@/components/app/product-navigation";
import { PageHeader } from "@/components/app/ui";

export const Route = createFileRoute("/_authenticated/products")({
  staticData: { sitemap: false },
  head: () => ({ meta: [{ title: "우리회사제품 · 에너인프라 경영비서" }] }),
  component: ProductsPage,
});

function ProductsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="우리회사제품" />
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {productPages.map(({ to, label, icon: Icon, description }) => (
          <li key={to}>
            <Link
              to={to}
              className="flex h-full items-start gap-3 rounded-xl border bg-card p-4 hover:bg-accent"
            >
              <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-taupe" />
              <div className="min-w-0 flex-1">
                <h2 className="font-bold">{label}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{description}</p>
              </div>
              <ArrowRight aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
