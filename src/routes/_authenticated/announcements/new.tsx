import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, Panel } from "@/components/app/ui";

export const Route = createFileRoute("/_authenticated/announcements/new")({
  head: () => ({ meta: [{ title: "새 공고 분석 · 주식회사 에너인프라의 경영비서" }, { name: "description", content: "공고 링크로 적합성 분석" }] }),
  component: NewAnn,
});

function NewAnn() {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try { const u = new URL(url); if (!/^https?:$/.test(u.protocol)) throw 0; } catch { { toast.error("공개 공고 링크(https://…)를 입력해 주세요."); return; } }
    setBusy(true);
    const { data, error } = await supabase.from("announcements").insert({ url: url.trim() }).select("id").single();
    setBusy(false);
    if (error || !data) { toast.error("공고를 저장하지 못했습니다."); return; }
    navigate({ to: "/announcements/$id", params: { id: data.id }, search: { start: true } });
  }
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="새 공고 분석" desc="공개 공고 링크를 입력하면 공고 본문과 첨부 공고문·신청 양식·평가기준표를 가져와 분석합니다." />
      <Panel>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5"><Label htmlFor="url">공고 링크</Label><Input id="url" type="url" placeholder="https://www.bizinfo.go.kr/..." required value={url} onChange={(e) => setUrl(e.target.value)} /></div>
          <Button type="submit" disabled={busy}>{busy ? "저장 중…" : "분석 시작"}</Button>
          <p className="text-xs text-muted-foreground">분석에는 1~3분 정도 걸릴 수 있습니다. 결과는 공고별로 저장되어 모든 직원이 볼 수 있습니다.</p>
        </form>
      </Panel>
    </div>
  );
}
