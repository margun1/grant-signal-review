import { createFileRoute } from "@tanstack/react-router";
import { AuthShell } from "@/components/app/AuthShell";

export const Route = createFileRoute("/find-account")({
  staticData: { sitemap: false },
  head: () => ({ meta: [
    { title: "이메일·계정 찾기 · 주식회사 에너인프라의 경영비서" },
    { name: "description", content: "가입한 이메일을 찾는 방법을 안내합니다." },
    { property: "og:title", content: "이메일·계정 찾기 · 주식회사 에너인프라의 경영비서" },
    { property: "og:description", content: "가입한 이메일을 찾는 방법을 안내합니다." },
  ] }),
  component: () => (
    <AuthShell title="이메일·계정 찾기" links={[{ to: "/auth", label: "로그인" }, { to: "/signup", label: "회원가입" }, { to: "/forgot-password", label: "비밀번호 찾기" }]}>
      <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed">
        <li>사용 중인 메일함에서 <strong>“에너인프라”</strong> 또는 <strong>“경영비서”</strong>로 검색해 초대 안내를 찾아 주세요.</li>
        <li>초대 안내를 받은 주소가 가입 이메일입니다. Google 계정으로 가입했다면 해당 Google 주소입니다.</li>
        <li>초대 이메일을 기억하지 못하면 사내 관리자에게 문의해 주세요.</li>
      </ol>
      <p className="mt-4 text-xs text-muted-foreground">보안을 위해 이 화면에서는 계정 등록 여부를 알려드리지 않습니다.</p>
    </AuthShell>
  ),
});
