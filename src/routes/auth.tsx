import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell, Divider, GoogleButton } from "@/components/app/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [
    { title: "로그인 · 주식회사 에너인프라의 경영비서" },
    { name: "description", content: "에너인프라 직원 전용 경영비서 로그인" },
    { property: "og:title", content: "로그인 · 주식회사 에너인프라의 경영비서" },
    { property: "og:description", content: "에너인프라 직원 전용 경영비서 로그인" },
  ] }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => data.session && navigate({ to: "/company", replace: true }));
    const { data } = supabase.auth.onAuthStateChange((e, s) => { if (e === "SIGNED_IN" && s) navigate({ to: "/company", replace: true }); });
    return () => data.subscription.unsubscribe();
  }, [navigate]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    setBusy(false);
    if (error) toast.error(error.message.includes("confirmed") ? "이메일 인증을 먼저 완료해 주세요." : "이메일 또는 비밀번호가 올바르지 않습니다.");
  }
  return (
    <AuthShell title="로그인" links={[{ to: "/signup", label: "회원가입" }, { to: "/find-account", label: "이메일·계정 찾기" }, { to: "/forgot-password", label: "비밀번호 찾기" }]}>
      <GoogleButton />
      <Divider />
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5"><Label htmlFor="email">이메일</Label><Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="pw">비밀번호</Label><Input id="pw" type="password" autoComplete="current-password" required value={pw} onChange={(e) => setPw(e.target.value)} /></div>
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "로그인 중…" : "로그인"}</Button>
      </form>
    </AuthShell>
  );
}
