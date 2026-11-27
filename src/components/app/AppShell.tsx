import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  FileSearch,
  Users,
  LogOut,
  Menu,
  ShieldAlert,
  TrendingUp,
  Coins,
  Boxes,
  Settings,
  ListChecks,
  Clock,
  MessageSquare,
  Wrench,
  CalendarDays,
  Bot,
  FileText,
} from "lucide-react";
import { ChevronDown } from "lucide-react";
import { productPages } from "@/components/app/product-navigation";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { YouTubeIntro } from "@/components/app/YouTubeIntro";

function AppBrand() {
  return (
    <div className="space-y-0.5">
      <div className="text-xs font-semibold tracking-wider text-gold">ENERINFRA</div>
      <div className="text-sm font-bold leading-snug text-card-foreground">주식회사 에너인프라의</div>
      <div className="flex items-center gap-2 text-base font-bold leading-snug text-card-foreground">
        <span>경영비서</span>
        <img src="/enerinfra-logo.png" alt="" width={96} height={17} className="h-auto w-24" />
      </div>
    </div>
  );
}

const NAV = [
  { to: "/company", label: "회사소개", icon: FileText },
  { to: "/assistant", label: "AI 비서", icon: Bot },
  { to: "/dashboard", label: "경영현황", icon: LayoutDashboard },
  { to: "/support", label: "지원사업", icon: FileSearch },
  { to: "/reports", label: "AI 리포트", icon: FileText },
  { to: "/sales", label: "매출·상품", icon: TrendingUp },
  { to: "/profit", label: "수익성", icon: Coins },
  { to: "/inventory", label: "재고·발주", icon: Boxes },
  { to: "/products", label: "우리회사제품", icon: Boxes },
  { to: "/checklist", label: "체크리스트", icon: ListChecks },
  { to: "/attendance", label: "출·퇴근 관리", icon: Clock },
  { to: "/inquiries", label: "고객문의", icon: MessageSquare },
  { to: "/devices", label: "기기오류", icon: Wrench },
  { to: "/meetings", label: "미팅·일정", icon: CalendarDays },
] as const;

const ADMIN_NAV = [
  { to: "/admin/invites", label: "직원 초대 관리", icon: Users },
  { to: "/admin/settings", label: "연락 설정", icon: Settings },
] as const;
const ALL_NAV = [...NAV, ...ADMIN_NAV];

function NavLinks({
  items,
  activePath,
  onNav,
}: {
  items: readonly (typeof ALL_NAV)[number][];
  activePath?: string;
  onNav: () => void;
}) {
  const productPageActive = productPages.some(({ to }) => to === activePath);
  const [productsOpen, setProductsOpen] = useState(productPageActive);

  useEffect(() => {
    if (productPageActive) setProductsOpen(true);
  }, [activePath, productPageActive]);

  function renderLink(item: (typeof ALL_NAV)[number] | (typeof productPages)[number]) {
    const active = activePath === item.to;
    return (
      <Link
        key={item.to}
        to={item.to}
        onClick={onNav}
        className={cn(
          "flex min-w-0 flex-1 items-center gap-3 rounded-md border-l-4 px-3 py-2.5 text-sm transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring",
          active ? "border-primary bg-accent font-bold" : "border-transparent text-foreground",
        )}
        aria-current={active ? "page" : undefined}
      >
        <item.icon className="size-4 shrink-0 text-taupe" aria-hidden />
        {item.label}
      </Link>
    );
  }

  return (
    <nav className="flex flex-col gap-1" aria-label="주 메뉴">
      {items.map((item) => item.to === "/products" ? (
        <Collapsible key={item.to} open={productsOpen} onOpenChange={setProductsOpen}>
          <div className="flex items-center gap-1">
            {renderLink(item)}
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 shrink-0"
                aria-label="우리회사제품 하위 메뉴"
              >
                <ChevronDown aria-hidden="true" className={cn("transition-transform", productsOpen && "rotate-180")} />
              </Button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent className="ml-5 mt-1 flex flex-col gap-1 border-l pl-2">
            {productPages.map(renderLink)}
          </CollapsibleContent>
        </Collapsible>
      ) : renderLink(item))}
    </nav>
  );
}

export function AppShell() {
  const { me, loading, session } = useMe();
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const path = useRouterState({ select: (state) => state.location.pathname });
  const isDashboard = path.replace(/\/+$/, "") === "/dashboard";
  const [musicOpened, setMusicOpened] = useState(isDashboard);

  useEffect(() => {
    if (isDashboard) setMusicOpened(true);
  }, [isDashboard]);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (loading) return <div className="p-10 text-muted-foreground">불러오는 중…</div>;
  if (!me?.isStaff)
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md rounded-lg border bg-card p-8 text-center">
          <ShieldAlert className="mx-auto mb-3 size-8 text-destructive" aria-hidden />
          <h1 className="text-lg font-bold">접근 권한이 없습니다</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            초대받은 활성 직원 계정만 사용할 수 있습니다. 사내 관리자에게 문의하세요.
          </p>
          <Button variant="outline" className="mt-5" onClick={signOut}>
            로그아웃
          </Button>
        </div>
      </div>
    );

  const items = me.isAdmin ? ALL_NAV : NAV;
  const currentPage = [...items, ...productPages].find(({ to }) => path === to || path.startsWith(`${to}/`));
  const side = (
    <div className="flex min-h-full flex-col gap-6 p-4">
      <div className="rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
        <AppBrand />
      </div>
      <NavLinks items={items} activePath={currentPage?.to ?? ""} onNav={() => setOpen(false)} />
      <div className="mt-auto border-t pt-4 text-sm">
        <div className="truncate font-medium">{me.profile?.display_name}</div>
        <div className="truncate text-xs text-muted-foreground">{session?.user.email}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {me.isAdmin ? "관리자" : me.isManager ? "실장" : "직원"}
        </div>
        <Button variant="outline" size="sm" className="mt-3 w-full" onClick={signOut}>
          <LogOut aria-hidden /> 로그아웃
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen md:pointer-fine:flex">
      <aside className="hidden w-64 shrink-0 border-r bg-sidebar md:pointer-fine:sticky md:pointer-fine:top-0 md:pointer-fine:block md:pointer-fine:h-dvh md:pointer-fine:overflow-y-auto">
        {side}
      </aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <header className="sticky top-0 z-40 border-b bg-card px-4 pt-3 shadow-sm md:pointer-fine:hidden">
          <div className="flex items-center justify-between gap-3 pb-3">
            <AppBrand />
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="size-14 shrink-0 rounded-xl [&_svg]:size-7"
                aria-label="메뉴 열기"
              >
                <Menu aria-hidden="true" />
              </Button>
            </SheetTrigger>
          </div>
          {currentPage && (
            <p role="status" className="border-t py-2 text-sm font-bold text-card-foreground">
              {currentPage.label}
            </p>
          )}
        </header>
        <SheetContent side="left" className="h-dvh w-72 max-w-[90vw] overflow-hidden bg-sidebar p-0">
          <SheetTitle className="sr-only">메뉴</SheetTitle>
          <div
            role="region"
            aria-label="메뉴 목록"
            tabIndex={0}
            className="h-full touch-pan-y overflow-y-auto overscroll-y-contain pb-[env(safe-area-inset-bottom)]"
          >
            {side}
          </div>
        </SheetContent>
      </Sheet>
      <main className="min-w-0 flex-1 p-4 md:p-8">
        <Outlet />
        {(isDashboard || musicOpened) && (
          <aside
            aria-label="유튜브 음악"
            className={cn(
              "mx-auto mt-6",
              isDashboard ? "w-full max-w-6xl" : "relative size-[3cm] overflow-hidden rounded-lg bg-muted",
            )}
          >
            {/* Scale the visible player while keeping the YouTube iframe at a usable viewport. */}
            <div className={isDashboard ? undefined : "absolute top-1/2 left-1/2 w-[360px] -translate-1/2 scale-[0.31]"}>
              <YouTubeIntro />
            </div>
          </aside>
        )}
      </main>
    </div>
  );
}
