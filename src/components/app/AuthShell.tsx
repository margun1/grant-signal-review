import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { APP_TITLE } from "@/lib/company";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

export function AuthShell({ title, children, links }: { title: string; children: ReactNode; links: { to: "/auth" | "/signup" | "/forgot-password" | "/find-account"; label: string }[] }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="text-xs font-semibold tracking-widest text-gold">ENERINFRA</div>
          <div className="mt-1 text-lg font-bold">{APP_TITLE}</div>
        </div>
        <div className="rounded-lg border border-t-4 border-t-primary bg-card p-6 md:p-8">
          <h1 className="mb-5 text-xl font-bold">{title}</h1>
          {children}
        </div>
        <nav className="mt-5 flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm">
          {links.map((l) => (
            <Link key={l.to} to={l.to} className="text-foreground underline underline-offset-4 hover:text-primary">{l.label}</Link>
          ))}
        </nav>
      </div>
    </div>
  );
}

export function GoogleButton({ label = "Google로 계속하기" }: { label?: string }) {
  async function go() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) toast.error("Google 로그인에 실패했습니다. 초대받은 이메일의 Google 계정인지 확인해 주세요.");
  }
  return (
    <button type="button" onClick={go} className="flex h-10 w-full items-center justify-center gap-2.5 rounded-md border border-google-border bg-google-bg px-3 text-sm font-medium text-google-text hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
      <svg aria-hidden="true" width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
      {label}
    </button>
  );
}

export function Divider() {
  return <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />또는<span className="h-px flex-1 bg-border" /></div>;
}
