import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "@/components/app/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/forgot-password")({
  staticData: { sitemap: false },
  head: () => ({ meta: [
    { title: "비밀번호 찾기 · 주식회사 에너인프라의 경영비서" },
    { name: "description", content: "비밀번호 재설정 안내를 요청합니다." },
    { property: "og:title", content: "비밀번호 찾기 · 주식회사 에너인프라의 경영비서" },
    { property: "og:description", content: "비밀번호 재설정 안내를 요청합니다." },
  ] }),
  component: Forgot,
});

function Forgot() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    setBusy(false);
    setDone(true); // 등록 여부와 관계없이 같은 안내
  }
  return (
    <AuthShell title="비밀번호 찾기" links={[{ to: "/auth", label: "로그인" }, { to: "/signup", label: "회원가입" }, { to: "/find-account", label: "이메일·계정 찾기" }]}>
      {done ? (
        <p className="text-sm leading-relaxed">입력하신 주소가 등록된 계정이면 재설정 안내 메일이 발송됩니다. 메일함과 스팸함을 확인해 주세요.</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5"><Label htmlFor="email">이메일</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <Button type="submit" className="w-full" disabled={busy}>재설정 안내 받기</Button>
        </form>
      )}
    </AuthShell>
  );
}
