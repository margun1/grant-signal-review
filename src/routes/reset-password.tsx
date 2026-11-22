import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "@/components/app/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [
    { title: "새 비밀번호 설정 · 주식회사 에너인프라의 경영비서" },
    { name: "description", content: "새 비밀번호를 설정합니다." },
    { property: "og:title", content: "새 비밀번호 설정 · 주식회사 에너인프라의 경영비서" },
    { property: "og:description", content: "새 비밀번호를 설정합니다." },
  ] }),
  component: Reset,
});

function Reset() {
  const navigate = useNavigate();
  const [valid, setValid] = useState<boolean | null>(null);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  useEffect(() => {
    const hash = window.location.hash;
    if (/error/.test(hash)) return setValid(false);
    const { data } = supabase.auth.onAuthStateChange((e) => { if (e === "PASSWORD_RECOVERY") setValid(true); });
    const t = setTimeout(() => supabase.auth.getSession().then(({ data }) => setValid((v) => v ?? !!data.session)), 1500);
    return () => { data.subscription.unsubscribe(); clearTimeout(t); };
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw !== pw2) { toast.error("비밀번호 확인 값이 일치하지 않습니다."); return; }
    if (pw.length < 8) { toast.error("비밀번호는 8자 이상으로 입력해 주세요."); return; }
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) { toast.error("변경하지 못했습니다. 비밀번호 찾기에서 다시 요청해 주세요."); return; }
    await supabase.auth.signOut();
    toast.success("비밀번호를 변경했습니다. 새 비밀번호로 로그인해 주세요.");
    navigate({ to: "/auth", replace: true });
  }
  return (
    <AuthShell title="새 비밀번호 설정" links={[{ to: "/auth", label: "로그인" }, { to: "/forgot-password", label: "비밀번호 찾기" }]}>
      {valid === null && <p className="text-sm text-muted-foreground">링크를 확인하는 중…</p>}
      {valid === false && <p className="text-sm leading-relaxed">링크가 만료되었거나 이미 사용되었습니다. 비밀번호 찾기에서 재설정 안내를 다시 요청해 주세요.</p>}
      {valid && (
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5"><Label htmlFor="pw">새 비밀번호</Label><Input id="pw" type="password" autoComplete="new-password" required value={pw} onChange={(e) => setPw(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="pw2">새 비밀번호 확인</Label><Input id="pw2" type="password" autoComplete="new-password" required value={pw2} onChange={(e) => setPw2(e.target.value)} /></div>
          <Button type="submit" className="w-full">비밀번호 변경</Button>
        </form>
      )}
    </AuthShell>
  );
}
