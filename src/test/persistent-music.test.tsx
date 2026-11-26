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
  useMe: () => ({ me: { isStaff: true, isAdmin: true }, loading: false, session: null }),
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

  for (const pathname of ["/meetings", "/company", "/dashboard", "/dashboard/"]) {
    location.pathname = pathname;
    rerender(app());
    expect(screen.getByTitle("테스트 유튜브 플레이어")).toBe(iframe);
    expect(player.classList.contains("size-[3cm]")).toBe(!pathname.startsWith("/dashboard"));
  }
});

it("shows the current menu page in the sticky compact header", () => {
  location.pathname = "/company";
  const client = new QueryClient();
  const app = () => (
    <QueryClientProvider client={client}>
      <AppShell />
    </QueryClientProvider>
  );
  const { rerender } = render(app());
  const header = screen.getByRole("banner");
  expect(header).toHaveClass("sticky", "top-0", "xl:pointer-fine:hidden");
  expect(screen.getByRole("button", { name: "메뉴 열기" })).toHaveClass("size-14");
  expect(screen.getByRole("status")).toHaveTextContent("회사소개");
  for (const [pathname, label] of [
    ["/meetings", "미팅·일정"],
    ["/dashboard/", "경영현황"],
    ["/admin/invites", "직원 초대 관리"],
    ["/admin/settings", "연락 설정"],
  ] as const) {
    location.pathname = pathname;
    rerender(app());
    expect(screen.getByRole("banner")).toBe(header);
    expect(screen.getByRole("status")).toHaveTextContent(label);
  }
});
