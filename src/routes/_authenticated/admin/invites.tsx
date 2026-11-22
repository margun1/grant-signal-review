import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, Panel, StatusBadge, kst } from "@/components/app/ui";

export const Route = createFileRoute("/_authenticated/admin/invites")({
  head: () => ({ meta: [{ title: "직원 초대 관리 · 주식회사 에너인프라의 경영비서" }, { name: "description", content: "직원 초대와 역할 관리" }] }),
  component: Invites,
});

type Role = "admin" | "manager" | "staff";
const ROLE_LABEL: Record<Role, string> = { admin: "관리자", manager: "실장", staff: "직원" };

function Invites() {
  const { me } = useMe();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("staff");
  const invites = useQuery({ queryKey: ["invites"], enabled: !!me?.isAdmin, queryFn: async () => (await supabase.from("invitations").select("*").order("created_at", { ascending: false })).data ?? [] });
  const people = useQuery({
    queryKey: ["people"], enabled: !!me?.isAdmin,
    queryFn: async () => {
      const [{ data: p }, { data: r }] = await Promise.all([supabase.from("profiles").select("*").order("created_at"), supabase.from("user_roles").select("user_id,role")]);
      return (p ?? []).map((x) => ({ ...x, roles: (r ?? []).filter((y) => y.user_id === x.id).map((y) => y.role as Role) }));
    },
  });
  const invite = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("invitations").insert({ email: email.trim().toLowerCase(), role, invited_by: me?.profile?.id ?? null });
      if (error) throw new Error(error.message.includes("duplicate") ? "이미 초대한 이메일입니다." : "초대하지 못했습니다.");
    },
    onSuccess: () => { toast.success("초대했습니다. 직원에게 회원가입 화면에서 이 이메일로 가입하도록 안내해 주세요."); setEmail(""); qc.invalidateQueries({ queryKey: ["invites"] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  const revoke = useMutation({
    mutationFn: async (id: string) => { await supabase.from("invitations").update({ revoked: true }).eq("id", id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invites"] }),
  });
  const toggleRole = useMutation({
    mutationFn: async (v: { uid: string; role: Role; on: boolean }) => {
      const { error } = await supabase.rpc("set_user_role", { _user_id: v.uid, _role: v.role, _enabled: v.on });
      if (error) throw new Error("역할을 바꾸지 못했습니다.");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["people"] }),
    onError: (e) => toast.error((e as Error).message),
  });
  const toggleActive = useMutation({
    mutationFn: async (v: { uid: string; active: boolean }) => { await supabase.from("profiles").update({ active: v.active }).eq("id", v.uid); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["people"] }),
  });

  if (!me?.isAdmin) return <p>관리자만 볼 수 있는 화면입니다.</p>;
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="직원 초대 관리" desc="초대한 이메일만 가입할 수 있습니다. 이메일·Google 가입 모두 같은 초대를 사용합니다." />
      <Panel title="직원 초대" accent="primary">
        <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); invite.mutate(); }}>
          <div className="min-w-64 flex-1 space-y-1.5"><Label htmlFor="em">직원 이메일</Label><Input id="em" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>역할</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}><SelectTrigger className="w-32 bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>{(Object.keys(ROLE_LABEL) as Role[]).map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}</SelectContent></Select>
          </div>
          <Button type="submit" disabled={invite.isPending}>초대</Button>
        </form>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-secondary text-left"><tr><th className="p-2">이메일</th><th className="p-2">역할</th><th className="p-2">상태</th><th className="p-2">초대일</th><th className="p-2"></th></tr></thead>
            <tbody>{(invites.data ?? []).map((i) => (
              <tr key={i.id} className="border-t"><td className="p-2">{i.email}</td><td className="p-2">{ROLE_LABEL[i.role as Role]}</td>
                <td className="p-2"><StatusBadge label={i.revoked ? "취소됨" : i.accepted_at ? "가입 완료" : "가입 대기"} tone={i.revoked ? "bad" : i.accepted_at ? "good" : "warn"} /></td>
                <td className="p-2">{kst(i.created_at)}</td>
                <td className="p-2 text-right">{!i.revoked && !i.accepted_at && <Button size="sm" variant="outline" onClick={() => revoke.mutate(i.id)}>초대 취소</Button>}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </Panel>
      <Panel title="직원 역할·계정 상태">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-secondary text-left"><tr><th className="p-2">이름</th><th className="p-2">이메일</th><th className="p-2">관리자</th><th className="p-2">실장</th><th className="p-2">활성</th></tr></thead>
            <tbody>{(people.data ?? []).map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-2">{p.display_name}</td><td className="p-2">{p.email}</td>
                {(["admin", "manager"] as Role[]).map((r) => (
                  <td key={r} className="p-2"><Switch aria-label={`${ROLE_LABEL[r]} 역할`} checked={p.roles.includes(r)} disabled={p.id === me.profile?.id && r === "admin"} onCheckedChange={(on) => toggleRole.mutate({ uid: p.id, role: r, on })} /></td>
                ))}
                <td className="p-2"><Switch aria-label="계정 활성" checked={p.active} disabled={p.id === me.profile?.id} onCheckedChange={(on) => toggleActive.mutate({ uid: p.id, active: on })} /></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">직원 역할은 관리자·실장 스위치를 모두 끈 상태입니다. 비활성 계정은 사내 화면과 자료에 접근할 수 없습니다.</p>
      </Panel>
    </div>
  );
}
