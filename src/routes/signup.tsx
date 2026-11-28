import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { prepareSharedSignup } from "@/lib/share-invite.functions";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell, Divider, GoogleButton } from "@/components/app/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [
    { title: "회원가입 · 주식회사 에너인프라의 경영비서" },
    { name: "description", content: "누구나 이메일로 가입하고 로그인해 회사소개를 볼 수 있습니다." },
    { property: "og:title", content: "회원가입 · 주식회사 에너인프라의 경영비서" },
    { property: "og:description", content: "누구나 이메일로 가입하고 로그인해 회사소개를 볼 수 있습니다." },
  ] }),
  component: Signup,
});

function Signup() {
  const prepare = useServerFn(prepareSharedSignup);
  const [inviteToken, setInviteToken] = useState("");
  useEffect(() => {
    setInviteToken(new URLSearchParams(window.location.hash.slice(1)).get("invite") ?? "");
  }, []);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw !== pw2) { toast.error("비밀번호 확인 값이 일치하지 않습니다."); return; }
    if (pw.length < 8) { toast.error("비밀번호는 8자 이상으로 입력해 주세요."); return; }
    setBusy(true);
    try {
      if (inviteToken) await prepare({ data: { email, token: inviteToken } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "공유 링크로 가입을 준비하지 못했습니다.");
      setBusy(false);
      return;
    }
    const { error } = await supabase.auth.signUp({ email: email.trim().toLowerCase(), password: pw, options: { emailRedirectTo: window.location.origin, data: { full_name: name } } });
    setBusy(false);
    if (error) {
      if (/already|registered/i.test(error.message)) toast.error("이미 가입된 이메일입니다. 로그인해 주세요.");
      else if (/rate|security purposes/i.test(error.message)) toast.error("요청이 너무 잦습니다. 잠시 뒤 다시 시도해 주세요.");
      else toast.error("가입을 완료하지 못했습니다. 입력 내용을 확인해 주세요.");
      return;
    }
    setSent(true);
  }
  return (
    <AuthShell title="회원가입" links={[{ to: "/auth", label: "로그인" }, { to: "/find-account", label: "이메일·계정 찾기" }, { to: "/forgot-password", label: "비밀번호 찾기" }]}>
      {sent ? (
        <p className="text-sm leading-relaxed">입력하신 이메일로 인증 메일을 보냈습니다. 메일의 링크를 눌러 가입을 완료한 뒤 로그인해 주세요.</p>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            {inviteToken ? "공유 링크로 가입할 이메일을 입력해 주세요." : "누구나 가입하고 로그인해 회사소개를 볼 수 있습니다."}
          </p>
          {!inviteToken && <><GoogleButton label="Google로 가입하기" /><Divider /></>}
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5"><Label htmlFor="name">이름</Label><Input id="name" required value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="email">이메일</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="pw">비밀번호</Label><Input id="pw" type="password" autoComplete="new-password" required value={pw} onChange={(e) => setPw(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="pw2">비밀번호 확인</Label><Input id="pw2" type="password" autoComplete="new-password" required value={pw2} onChange={(e) => setPw2(e.target.value)} /></div>
            <Button type="submit" className="w-full" disabled={busy}>{busy ? "처리 중…" : "가입하기"}</Button>
          </form>
        </>
      )}
    </AuthShell>
  );
}
