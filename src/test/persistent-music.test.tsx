import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import { AppShell } from "@/components/app/AppShell";

const location = vi.hoisted(() => ({ pathname: "/company" }));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
  Outlet: () => <div>{location.pathname}</div>,
  useNavigate: () => vi.fn(),
  useRouterState: ({ select }: { select: (state: { location: typeof location }) => unknown }) =>
    select({ location }),
}));

vi.mock("@/hooks/use-auth", () => ({
  useMe: () => ({ me: { isStaff: true }, loading: false, session: null }),
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/components/app/YouTubeIntro", () => ({
  YouTubeIntro: () => <iframe title="테스트 유튜브 플레이어" />,
}));

it("keeps the same music iframe across navigation after the dashboard opens", () => {
  const client = new QueryClient();
  const app = () => (
    <QueryClientProvider client={client}>
      <AppShell />
    </QueryClientProvider>
  );

  const { rerender } = render(app());
  expect(screen.queryByTitle("테스트 유튜브 플레이어")).toBeNull();

  location.pathname = "/dashboard";
  rerender(app());
  const iframe = screen.getByTitle("테스트 유튜브 플레이어");
  const player = screen.getByRole("complementary", { name: "유튜브 음악" });

  for (const pathname of ["/meetings", "/company", "/dashboard"]) {
    location.pathname = pathname;
    rerender(app());
    expect(screen.getByTitle("테스트 유튜브 플레이어")).toBe(iframe);
    expect(player.classList.contains("size-[3cm]")).toBe(pathname !== "/dashboard");
  }
});
