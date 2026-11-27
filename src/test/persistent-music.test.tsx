import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
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
  expect(header).toHaveClass("sticky", "top-0", "md:pointer-fine:hidden");
  expect(screen.getByRole("button", { name: "메뉴 열기" })).toHaveClass("size-14");
  expect(screen.getByRole("status")).toHaveTextContent("회사소개");
  for (const [pathname, label] of [
    ["/meetings", "미팅·일정"],
    ["/dashboard/", "경영현황"],
    ["/admin/invites", "직원 초대 관리"],
    ["/admin/settings", "설정"],
  ] as const) {
    location.pathname = pathname;
    rerender(app());
    expect(screen.getByRole("banner")).toBe(header);
    expect(screen.getByRole("status")).toHaveTextContent(label);
  }
});

it("puts every compact-menu link and sign-out inside the scrollable drawer", () => {
  location.pathname = "/company";
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AppShell />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "메뉴 열기" }));
  const dialog = screen.getByRole("dialog", { name: "메뉴" });
  const scrollArea = within(dialog).getByRole("region", { name: "메뉴 목록" });

  expect(dialog).toHaveClass("h-dvh");
  expect(scrollArea).toHaveClass("h-full", "overflow-y-auto", "touch-pan-y");
  expect(within(scrollArea).getByRole("link", { name: "설정" })).toBeInTheDocument();
  expect(within(scrollArea).queryByRole("link", { name: "직원 초대 관리" })).toBeNull();
  fireEvent.click(within(scrollArea).getByRole("button", { name: "설정 하위 메뉴" }));
  expect(within(scrollArea).getByRole("link", { name: "직원 초대 관리" })).toHaveAttribute(
    "href",
    "/admin/invites",
  );
  expect(within(scrollArea).getByRole("button", { name: "로그아웃" })).toBeInTheDocument();
});

it("expands the product links in the compact navigation", () => {
  location.pathname = "/company";
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AppShell />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "메뉴 열기" }));
  const menu = within(screen.getByRole("dialog", { name: "메뉴" }));
  const toggle = menu.getByRole("button", { name: "우리회사제품 하위 메뉴" });
  expect(menu.getByRole("link", { name: "우리회사제품" })).toHaveAttribute("href", "/products");
  expect(menu.queryByRole("link", { name: "기기오류" })).toBeNull();
  expect(menu.queryByRole("link", { name: "재고·발주" })).toBeNull();
  expect(menu.queryByRole("link", { name: "드론" })).toBeNull();

  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-expanded", "true");
  const links = menu.getAllByRole("link").map((link) => link.getAttribute("href"));
  const productIndex = links.indexOf("/products");
  expect(links.slice(productIndex + 1, productIndex + 5)).toEqual([
    "/powerboard",
    "/drone",
    "/competitors",
    "/devices",
  ]);
  expect(menu.getByRole("link", { name: "POWERBOARD" })).toHaveAttribute("href", "/powerboard");
  expect(menu.getByRole("link", { name: "드론" })).toHaveAttribute("href", "/drone");
  expect(menu.getByRole("link", { name: "경쟁제품" })).toHaveAttribute("href", "/competitors");

  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(menu.queryByRole("link", { name: "드론" })).toBeNull();
});

it("opens AI report under the AI secretary without opening the products group", () => {
  location.pathname = "/assistant";
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AppShell />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "메뉴 열기" }));
  const menu = within(screen.getByRole("dialog", { name: "메뉴" }));
  const toggle = menu.getByRole("button", { name: "AI 비서 하위 메뉴" });
  expect(menu.queryByRole("link", { name: "AI 리포트" })).toBeNull();

  fireEvent.click(toggle);
  expect(menu.getByRole("link", { name: "AI 리포트" })).toHaveAttribute("href", "/reports");
  expect(menu.getByRole("button", { name: "우리회사제품 하위 메뉴" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );

  fireEvent.click(toggle);
  expect(menu.queryByRole("link", { name: "AI 리포트" })).toBeNull();
});

it("places meetings above the dashboard and expands its submenu in order", () => {
  location.pathname = "/company";
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AppShell />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "메뉴 열기" }));
  const menu = within(screen.getByRole("dialog", { name: "메뉴" }));
  expect(menu.queryByRole("link", { name: "매출·상품" })).toBeNull();
  expect(menu.queryByRole("link", { name: "체크리스트" })).toBeNull();
  const toggle = menu.getByRole("button", { name: "경영현황 하위 메뉴" });
  fireEvent.click(toggle);
  const links = menu.getAllByRole("link").map((link) => link.getAttribute("href"));
  const dashboardIndex = links.indexOf("/dashboard");
  expect(links[dashboardIndex - 1]).toBe("/meetings");
  expect(links.slice(dashboardIndex + 1, dashboardIndex + 5)).toEqual([
    "/sales",
    "/inventory",
    "/profit",
    "/checklist",
  ]);
});
