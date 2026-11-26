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
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
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
  { to: "/powerboard", label: "POWERBOARD 실증", icon: TrendingUp },
  { to: "/checklist", label: "체크리스트", icon: ListChecks },
  { to: "/attendance", label: "출퇴근", icon: Clock },
  { to: "/inquiries", label: "고객문의", icon: MessageSquare },
  { to: "/devices", label: "기기오류", icon: Wrench },
  { to: "/meetings", label: "미팅·일정", icon: CalendarDays },
] as const;

function NavLinks({ isAdmin, onNav }: { isAdmin: boolean; onNav?: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const items = [
    ...NAV,
    ...(isAdmin
      ? [
          { to: "/admin/invites", label: "직원 초대 관리", icon: Users } as const,
          { to: "/admin/settings", label: "연락 설정", icon: Settings } as const,
        ]
      : []),
  ];
  return (
    <nav className="flex flex-col gap-1" aria-label="주 메뉴">
      {items.map((it) => {
        const active = path.startsWith(it.to);
        return (
          <Link
            key={it.to}
            to={it.to}
            onClick={onNav}
            className={cn(
              "flex items-center gap-3 rounded-md border-l-4 px-3 py-2.5 text-sm transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring",
              active ? "border-primary bg-accent font-bold" : "border-transparent text-foreground",
            )}
            aria-current={active ? "page" : undefined}
          >
            <it.icon className="size-4 text-taupe" aria-hidden />
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell() {
  const { me, loading, session } = useMe();
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const isDashboard = useRouterState({ select: (state) => state.location.pathname === "/dashboard" });
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

  const side = (
    <div className="flex h-full flex-col gap-6 p-4">
      <div className="rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
        <AppBrand />
      </div>
      <NavLinks isAdmin={me.isAdmin} onNav={() => setOpen(false)} />
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
    <div className="min-h-screen md:flex">
      <aside className="hidden w-64 shrink-0 border-r bg-sidebar md:block md:sticky md:top-0 md:h-screen">{side}</aside>
      <header className="sticky top-0 z-40 flex items-center justify-between border-b bg-card px-4 py-3 md:hidden">
        <AppBrand />
        <Button variant="outline" size="icon" onClick={() => setOpen(true)} aria-label="메뉴 열기">
          <Menu />
        </Button>
      </header>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 bg-sidebar p-0">
          <SheetTitle className="sr-only">메뉴</SheetTitle>
          {side}
        </SheetContent>
      </Sheet>
      <main className="min-w-0 flex-1 p-4 md:p-8">
        <Outlet />
        {(isDashboard || musicOpened) && (
          <aside
            aria-label="유튜브 음악"
            className={cn("mx-auto mt-6", isDashboard ? "max-w-6xl" : "max-w-sm")}
          >
            <YouTubeIntro />
          </aside>
        )}
      </main>
    </div>
  );
}
