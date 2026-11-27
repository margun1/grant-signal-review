import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createStaffShareInvite } from "@/lib/share-invite.functions";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-auth";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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

const ROLES = ["admin", "manager", "staff"] as const;
type Role = (typeof ROLES)[number];
const ROLE_LABEL: Record<Role, string> = { admin: "관리자", manager: "실장", staff: "직원" };
const INVITE_ROLES = {
  ceo: { label: "대표이사", role: "admin" },
  director: { label: "실장", role: "manager" },
  teamLead: { label: "팀장", role: "staff" },
  employee: { label: "사원", role: "staff" },
  guest: { label: "게스트", role: null },
  studentWorker: { label: "근로학생", role: "staff" },
} as const satisfies Record<string, { label: string; role: Role | null }>;

type InviteRole = keyof typeof INVITE_ROLES;
const inviteRoleOptions = Object.entries(INVITE_ROLES);
const labelForRole: Record<Role, InviteRole> = {
  admin: "ceo",
  manager: "director",
  staff: "employee",
};

const inviteLabelsKey = "enerinfra:invitation-role-labels:v1";

function readInviteLabels(): Record<string, InviteRole> {
  try {
    const labels: unknown = JSON.parse(window.localStorage.getItem(inviteLabelsKey) ?? "{}");
    if (!labels || typeof labels !== "object" || Array.isArray(labels)) return {};
    return Object.fromEntries(Object.entries(labels).filter(([, choice]) =>
      typeof choice === "string" && Object.hasOwn(INVITE_ROLES, choice),
    ));
  } catch {
    return {};
  }
}

function InviteRoleOptions() {
  return inviteRoleOptions.map(([value, { label }]) => (
    <SelectItem key={value} value={value}>{label}</SelectItem>
  ));
}

function Invites() {
  const { me } = useMe();
  const qc = useQueryClient();
  const createShareInvite = useServerFn(createStaffShareInvite);
  const [shareUrl, setShareUrl] = useState("");
  const share = useMutation({
    mutationFn: () => createShareInvite(),
    onSuccess: ({ token }) => {
      const url = new URL("/signup", window.location.origin);
      url.hash = new URLSearchParams({ invite: token }).toString();
      setShareUrl(url.href);
    },
    onError: () => toast.error("공유 가입 링크를 만들지 못했습니다."),
  });
  const [inviteToDelete, setInviteToDelete] = useState<{ id: string; email: string } | null>(null);
  const [inviteLabels, setInviteLabels] = useState(readInviteLabels);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<InviteRole>("employee");
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
      const role = INVITE_ROLES[inviteRole].role;
      if (!role) throw new Error("게스트를 저장하려면 Lovable에서 별도 게스트 권한을 설정해야 합니다.");
      const { error } = await supabase.from("invitations").insert({
        email: email.trim().toLowerCase(),
        role,
        invited_by: me?.profile?.id ?? null,
      });
      if (error) throw new Error(error.message.includes("duplicate") ? "이미 초대한 이메일입니다." : "초대하지 못했습니다.");
    },
    onSuccess: () => { toast.success("초대했습니다. 직원에게 회원가입 화면에서 이 이메일로 가입하도록 안내해 주세요."); setEmail(""); qc.invalidateQueries({ queryKey: ["invites"] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  const changeInviteRole = useMutation({
    mutationFn: async ({ id, choice }: { id: string; choice: InviteRole }) => {
      const role = INVITE_ROLES[choice].role;
      if (!role) throw new Error("게스트를 저장하려면 Lovable에서 별도 게스트 권한을 설정해야 합니다.");
      const { data: invitation, error } = await supabase.from("invitations")
        .select("id,email,accepted_at,role").eq("id", id).single();
      if (error || !invitation) throw new Error("초대 정보를 다시 불러오지 못했습니다.");

      if (invitation.accepted_at) {
        const { data: profile, error: profileError } = await supabase.from("profiles")
          .select("id").eq("email", invitation.email).maybeSingle();
        if (profileError || !profile) throw new Error("가입한 계정을 찾지 못했습니다.");
        if (profile.id === me?.profile?.id) throw new Error("내 계정의 역할은 이 목록에서 바꿀 수 없습니다.");

        const { data: existing, error: roleError } = await supabase.from("user_roles")
          .select("role").eq("user_id", profile.id);
        if (roleError) throw new Error("가입한 계정의 현재 권한을 확인하지 못했습니다.");

        const desired: readonly Role[] = role === "admin" ? ["admin", "manager"] : [role];
        const assigned = new Set(existing.map(({ role }) => role));
        const changes = [
          ...ROLES.filter((value) => assigned.has(value) && !desired.includes(value))
            .map((value) => ({ value, enabled: false })),
          ...desired.filter((value) => !assigned.has(value)).map((value) => ({ value, enabled: true })),
        ];
        for (const { value, enabled } of changes) {
          const { error: changeError } = await supabase.rpc("set_user_role", {
            _user_id: profile.id, _role: value, _enabled: enabled,
          });
          if (changeError) throw new Error("계정 권한 변경을 완료하지 못했습니다. 현재 권한을 확인하고 다시 시도해 주세요.");
        }
      }

      let update = supabase.from("invitations").update({ role }).eq("id", id).eq("role", invitation.role);
      update = invitation.accepted_at ? update.eq("accepted_at", invitation.accepted_at) : update.is("accepted_at", null);
      const { data: updated, error: updateError } = await update.select("id").maybeSingle();
      if (updateError || !updated) throw new Error("초대 역할을 저장하지 못했습니다. 목록을 확인하고 다시 시도해 주세요.");
    },
    onSuccess: (_, { id, choice }) => {
      const role = INVITE_ROLES[choice].role;
      if (!role) return;

      const labels = { ...inviteLabels, ...readInviteLabels(), [id]: choice };
      setInviteLabels(labels);
      try {
        window.localStorage.setItem(inviteLabelsKey, JSON.stringify(labels));
      } catch {
        // Keep the display label in memory when storage is unavailable.
      }
      qc.setQueryData<typeof invites.data>(["invites"], (rows) =>
        rows?.map((row) => row.id === id ? { ...row, role } : row),
      );
      toast.success("역할을 변경했습니다.");
    },
    onError: (error) => toast.error(error.message),
    onSettled: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["invites"] }),
        qc.invalidateQueries({ queryKey: ["people"] }),
      ]);
    },
  });
  function displayedInviteRole(id: string, role: Role) {
    if (changeInviteRole.isPending && changeInviteRole.variables.id === id) {
      return changeInviteRole.variables.choice;
    }
    const choice = inviteLabels[id];
    return choice && INVITE_ROLES[choice].role === role ? choice : labelForRole[role];
  }

  const deleteInvite = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.from("invitations").delete().eq("id", id).select("id").maybeSingle();
      if (error || !data) throw new Error("초대 기록을 삭제하지 못했습니다.");
    },
    onSuccess: async () => {
      setInviteToDelete(null);
      toast.success("초대 기록을 삭제했습니다.");
      await qc.invalidateQueries({ queryKey: ["invites"] });
    },
    onError: (error) => toast.error(error.message),
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
      <PageHeader title="직원 초대 관리" desc="개별 이메일 초대 또는 공유 가입 링크를 사용할 수 있습니다." />
      <Panel title="공유 가입 링크">
        <p className="mb-3 text-sm text-muted-foreground">링크를 받은 사람은 24시간 동안 본인 이메일로 가입해 직원 권한을 받을 수 있습니다.</p>
        <Button type="button" variant="outline" disabled={share.isPending} onClick={() => share.mutate()}>
          공유 링크 만들기
        </Button>
        {shareUrl && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Input className="min-w-0 flex-1" aria-label="공유 가입 링크" readOnly value={shareUrl}
              onFocus={(event) => event.currentTarget.select()} />
            <Button type="button" onClick={async () => {
              try {
                await navigator.clipboard.writeText(shareUrl);
                toast.success("공유 가입 링크를 복사했습니다.");
              } catch {
                toast.error("링크를 선택해 직접 복사해 주세요.");
              }
            }}>링크 복사</Button>
          </div>
        )}
      </Panel>
      <Panel title="직원 초대" accent="primary">
        <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); invite.mutate(); }}>
          <div className="min-w-64 flex-1 space-y-1.5"><Label htmlFor="em">직원 이메일</Label><Input id="em" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-role">역할</Label>
            <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as InviteRole)}>
              <SelectTrigger id="invite-role" className="w-36 bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                <InviteRoleOptions />
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={invite.isPending}>초대</Button>
        </form>
        <p className="mt-2 text-xs text-muted-foreground">
          대표이사는 관리자 권한, 실장은 실장 권한으로 등록됩니다. 팀장·사원·근로학생은 같은 직원 권한이며, 선택한 표시 이름은 이 브라우저에 저장됩니다. 게스트를 저장하려면 Lovable에서 별도 게스트 권한을 설정해야 합니다.
        </p>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-secondary text-left"><tr><th className="p-2">이메일</th><th className="p-2">역할</th><th className="p-2">상태</th><th className="p-2">초대일</th><th className="p-2"></th></tr></thead>
            <tbody>{(invites.data ?? []).map((i) => (
              <tr key={i.id} className="border-t"><td className="p-2">{i.email}</td><td className="p-2">
                <Select value={displayedInviteRole(i.id, i.role)} disabled={changeInviteRole.isPending}
                  onValueChange={(value) => changeInviteRole.mutate({ id: i.id, choice: value as InviteRole })}>
                  <SelectTrigger aria-label={`${i.email} 역할`} className="h-8 w-28 bg-card"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <InviteRoleOptions />
                  </SelectContent>
                </Select>
              </td>
                <td className="p-2"><StatusBadge label={i.revoked ? "취소됨" : i.accepted_at ? "가입 완료" : "가입 대기"} tone={i.revoked ? "bad" : i.accepted_at ? "good" : "warn"} /></td>
                <td className="p-2">{kst(i.created_at)}</td>
                <td className="p-2">
                  <div className="flex justify-end gap-2">
                    {!i.revoked && !i.accepted_at && <Button size="sm" variant="outline" onClick={() => revoke.mutate(i.id)}>초대 취소</Button>}
                    <Button type="button" size="sm" variant="outline" className="text-destructive"
                      aria-label={`${i.email} 초대 기록 삭제`} onClick={() => setInviteToDelete(i)}>삭제</Button>
                  </div>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Panel>
      <AlertDialog open={inviteToDelete !== null} onOpenChange={(open) => {
        if (!open && !deleteInvite.isPending) setInviteToDelete(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>초대 기록을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription className="break-words">
              {inviteToDelete?.email}의 초대 기록을 삭제합니다. 이미 가입한 직원은 계정과 권한을 유지합니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteInvite.isPending}>취소</AlertDialogCancel>
            <Button type="button" variant="destructive" disabled={deleteInvite.isPending}
              onClick={() => { if (inviteToDelete) deleteInvite.mutate(inviteToDelete.id); }}>
              {deleteInvite.isPending ? "삭제 중…" : "삭제"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
