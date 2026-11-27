import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IntegrationStatusSettings } from "@/components/app/IntegrationStatusSettings";
import { PageHeader, Panel } from "@/components/app/ui";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({ meta: [{ title: "설정 · 주식회사 에너인프라의 경영비서" }, { name: "description", content: "회신 이메일과 카카오톡 채널 설정" }] }),
  component: Settings,
});

function Settings() {
  const { me } = useMe();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["company_settings"], queryFn: async () => (await supabase.from("company_settings").select("*").eq("id", 1).maybeSingle()).data });
  const [email, setEmail] = useState("");
  const [kakao, setKakao] = useState("");
  const [wd, setWd] = useState(1); const [hr, setHr] = useState(9);
  useEffect(() => { if (q.data) { setEmail(q.data.reply_email ?? ""); setKakao(q.data.kakao_channel_url ?? ""); setWd(q.data.report_weekday); setHr(q.data.report_hour); } }, [q.data]);
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("company_settings").upsert({ id: 1, reply_email: email.trim() || null, kakao_channel_url: kakao.trim() || null, report_weekday: wd, report_hour: hr, updated_at: new Date().toISOString() });
      if (error) throw new Error("저장하지 못했습니다.");
    },
    onSuccess: () => { toast.success("저장했습니다."); qc.invalidateQueries({ queryKey: ["company_settings"] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  if (!me?.isAdmin) return <p>관리자만 볼 수 있는 화면입니다.</p>;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="설정" desc="고객 회신 이메일과 카카오톡 채널은 언제든 이곳에서 바꿀 수 있습니다." />
      <Panel title="연락 수단" accent="primary">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <div className="space-y-1.5"><Label htmlFor="re">고객문의 회신 이메일</Label><Input id="re" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="kk">카카오톡 채널 주소</Label><Input id="kk" type="url" placeholder="채널 개설 후 입력 (예: https://pf.kakao.com/...)" value={kakao} onChange={(e) => setKakao(e.target.value)} />
            {!kakao && <p className="text-sm text-muted-foreground">아직 채널이 없습니다. 개설 후 주소를 입력하면 됩니다.</p>}</div>
          <div className="flex flex-wrap items-end gap-3"><div className="space-y-1.5"><Label htmlFor="wd">주간 리포트 요일</Label>
            <select id="wd" className="h-10 rounded-md border bg-card px-3" value={wd} onChange={(e) => setWd(Number(e.target.value))}>{["일","월","화","수","목","금","토"].map((d, i) => <option key={d} value={i}>{d}요일</option>)}</select></div>
            <div className="space-y-1.5"><Label htmlFor="hr">시간</Label><select id="hr" className="h-10 rounded-md border bg-card px-3" value={hr} onChange={(e) => setHr(Number(e.target.value))}>{Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{i}시</option>)}</select></div></div>
          <Button type="submit" disabled={save.isPending}>저장</Button>
        </form>
      </Panel>
      <IntegrationStatusSettings kakao={q.data?.kakao_channel_url ?? ""} />
    </div>
  );
}
