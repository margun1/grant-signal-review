import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader, Panel, StatusBadge, kst, todayKst } from "@/components/app/ui";
import { AssigneeSelect } from "@/components/app/AssigneeSelect";
import { useStaff } from "@/hooks/use-staff";

export const Route = createFileRoute("/_authenticated/devices")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "기기오류 · 주식회사 에너인프라의 경영비서" },
      { name: "description", content: "현장 제품·사내 장비 오류 접수와 조치 이력" },
    ],
  }),
  component: DevicesPage,
});
const issueTypes = {
  POWERBOARD: [
    "전원 불량",
    "화면 표시 오류",
    "전력 계측값 이상",
    "통신·데이터 전송 오류",
    "센서·배선 오류",
    "설치·고정 문제",
    "기타",
  ],
  드론: [
    "전원·배터리 오류",
    "모터·프로펠러 오류",
    "조종기 연결 오류",
    "비행 자세 이상",
    "GPS·위치 오류",
    "카메라·영상 오류",
    "기체 파손",
    "기타",
  ],
} as const;
type Device = keyof typeof issueTypes;
const initialForm = () => ({
  device: "POWERBOARD" as Device,
  category: "",
  location: "",
  occurred_on: todayKst(),
  symptom: "",
  assignee: null as string | null,
});
const statusOptions = [
  { value: "처리 중", label: "해결중" },
  { value: "완료", label: "해결완료" },
] as const;
type Issue = {
  id: string;
  category: string;
  device: string;
  location: string | null;
  occurred_on: string | null;
  symptom: string;
  photo_path: string | null;
  assignee: string | null;
  status: string;
  inquiry_id: string | null;
  created_at: string;
};

function DevicesPage() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["issues"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("device_issues")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw new Error("등록한 오류를 불러오지 못했습니다.");
      return data ?? [];
    },
  });
  const [f, setF] = useState(initialForm);
  const [photo, setPhoto] = useState<File | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const add = useMutation({
    mutationFn: async () => {
      const symptom = f.symptom.trim();
      if (!f.category || !symptom) throw new Error("오류 구분을 선택하고 증상을 입력해 주세요.");
      let photo_path: string | null = null;
      if (photo) {
        photo_path = `issues/${crypto.randomUUID()}-${photo.name.replace(/[^\w.-]/g, "_")}`;
        const { error } = await supabase.storage.from("photos").upload(photo_path, photo);
        if (error) throw new Error("사진을 올리지 못했습니다.");
      }
      // The database category tracks issue origin, so keep the detailed type with the symptom.
      const { data, error } = await supabase
        .from("device_issues")
        .insert({
          category: "고객·실증 현장 제품",
          device: f.device,
          location: f.location.trim() || null,
          occurred_on: f.occurred_on || null,
          symptom: `[오류 구분: ${f.category}]\n${symptom}`,
          assignee: f.assignee,
          photo_path,
          status: "처리 중",
        })
        .select("*")
        .single();
      if (error || !data) throw new Error("등록하지 못했습니다.");
      return data;
    },
    onSuccess: (record) => {
      qc.setQueryData<Issue[]>(["issues"], (previous) =>
        [record, ...(previous ?? []).filter((entry) => entry.id !== record.id)].slice(0, 200),
      );
      setF(initialForm());
      setPhoto(null);
      if (photoInput.current) photoInput.current.value = "";
      void qc.invalidateQueries({ queryKey: ["issues"] });
      toast.success("등록했습니다.");
    },
    onError: (error) => toast.error(error.message),
  });
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="기기오류" desc="POWERBOARD와 드론의 오류 및 해결 상태를 관리합니다." />
      <Panel title="오류 등록" accent="primary">
        <form
          className="grid gap-3 md:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!add.isPending) add.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="issue-device">기기</Label>
            <Select
              value={f.device}
              disabled={add.isPending}
              onValueChange={(device: Device) => setF({ ...f, device, category: "" })}
            >
              <SelectTrigger id="issue-device" className="bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="POWERBOARD">POWERBOARD</SelectItem>
                <SelectItem value="드론">드론</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="issue-type">구분</Label>
            <Select
              value={f.category}
              disabled={add.isPending}
              onValueChange={(category) => setF({ ...f, category })}
            >
              <SelectTrigger id="issue-type" className="bg-card">
                <SelectValue placeholder="오류 유형 선택" />
              </SelectTrigger>
              <SelectContent>
                {issueTypes[f.device].map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lc">발생 장소</Label>
            <Input
              id="lc"
              value={f.location}
              onChange={(e) => setF({ ...f, location: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="od">발생일</Label>
            <Input
              id="od"
              type="date"
              className="bg-card"
              value={f.occurred_on}
              onChange={(e) => setF({ ...f, occurred_on: e.target.value })}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="sy">증상</Label>
            <Textarea
              id="sy"
              value={f.symptom}
              onChange={(e) => setF({ ...f, symptom: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ph">사진 (선택)</Label>
            <Input
              ref={photoInput}
              id="ph"
              type="file"
              accept="image/*"
              className="bg-card"
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>담당자</Label>
            <AssigneeSelect
              value={f.assignee}
              onChange={(a) => setF({ ...f, assignee: a })}
              className="w-full"
            />
          </div>
          <div>
            <Button type="submit" disabled={add.isPending}>
              등록
            </Button>
          </div>
        </form>
      </Panel>
      <Panel title="등록한 오류" accent="gold">
        {list.isPending ? (
          <p role="status" className="text-sm text-muted-foreground">
            등록한 오류를 불러오는 중…
          </p>
        ) : list.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {list.error.message}
          </p>
        ) : list.data.length ? (
          <div className="space-y-3">
            {list.data.map((issue) => (
              <IssueCard key={issue.id} i={issue} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">등록된 오류가 없습니다.</p>
        )}
      </Panel>
    </div>
  );
}

function IssueCard({ i }: { i: Issue }) {
  const qc = useQueryClient();
  const { nameOf } = useStaff();
  const [note, setNote] = useState("");
  const logs = useQuery({
    queryKey: ["issue-logs", i.id],
    queryFn: async () =>
      (
        await supabase
          .from("device_issue_logs")
          .select("*")
          .eq("issue_id", i.id)
          .order("created_at")
      ).data ?? [],
  });
  const photo = useQuery({
    queryKey: ["photo", i.photo_path],
    enabled: !!i.photo_path,
    queryFn: async () =>
      (await supabase.storage.from("photos").createSignedUrl(i.photo_path!, 600)).data?.signedUrl ??
      null,
  });
  const upd = useMutation({
    mutationFn: async (values: Pick<Partial<Issue>, "assignee" | "status">) => {
      const { data, error } = await supabase
        .from("device_issues")
        .update(values)
        .eq("id", i.id)
        .select("*")
        .single();
      if (error || !data) throw new Error("변경 내용을 저장하지 못했습니다.");
      return data;
    },
    onSuccess: (updated) => {
      qc.setQueryData<Issue[]>(["issues"], (previous) =>
        previous?.map((issue) => (issue.id === updated.id ? updated : issue)),
      );
      void qc.invalidateQueries({ queryKey: ["issues"] });
    },
    onError: (error) => toast.error(error.message),
  });
  const addLog = useMutation({
    mutationFn: async () => {
      if (!note.trim()) return;
      await supabase.from("device_issue_logs").insert({ issue_id: i.id, note: note.trim() });
    },
    onSuccess: () => {
      setNote("");
      qc.invalidateQueries({ queryKey: ["issue-logs", i.id] });
    },
  });
  const details = /^\[오류 구분: ([^\]\n]+)\]\r?\n([\s\S]*)$/.exec(i.symptom);
  const status = statusOptions.find((option) => option.value === i.status);
  return (
    <Panel
      title={
        <span>
          {i.device}{" "}
          <span className="text-sm font-normal text-muted-foreground">
            · {details?.[1] ?? i.category}
          </span>
        </span>
      }
      action={
        <div className="ml-auto flex items-center gap-2">
          <StatusBadge
            label={status?.label ?? i.status}
            tone={i.status === "완료" ? "good" : i.status === "처리 중" ? "warn" : "bad"}
          />
          <Select
            value={status?.value ?? ""}
            disabled={upd.isPending}
            onValueChange={(value) => upd.mutate({ status: value })}
          >
            <SelectTrigger className="w-32 bg-card" aria-label={`${i.device} 해결 상태`}>
              <SelectValue placeholder="상태 선택" />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
    >
      <div className="flex flex-wrap gap-4">
        {photo.data && (
          <a href={photo.data} target="_blank" rel="noreferrer">
            <img
              src={photo.data}
              alt={`${i.device} 사진`}
              className="h-28 w-28 rounded-md object-cover"
            />
          </a>
        )}
        <div className="flex-1 space-y-1 text-sm">
          <p>
            장소: {i.location ?? "-"} · 발생일: {i.occurred_on ?? "-"} · 등록: {kst(i.created_at)}
            {i.inquiry_id && " · 고객문의에서 등록"}
          </p>
          <p className="whitespace-pre-wrap">{details?.[2] ?? i.symptom}</p>
        </div>
      </div>
      <div className="mt-3">
        <AssigneeSelect value={i.assignee} onChange={(assignee) => upd.mutate({ assignee })} />
      </div>
      <div className="mt-3">
        <p className="text-sm font-semibold">조치 이력</p>
        <ul className="mt-1 space-y-1 text-sm">
          {(logs.data ?? []).map((l) => (
            <li key={l.id}>
              <span className="text-muted-foreground">
                {kst(l.created_at)} · {nameOf(l.created_by)}
              </span>{" "}
              — {l.note}
            </li>
          ))}
        </ul>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            addLog.mutate();
          }}
        >
          <Input
            aria-label="조치 내용"
            placeholder="조치 내용"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="bg-card"
          />
          <Button type="submit" size="sm">
            기록
          </Button>
        </form>
      </div>
    </Panel>
  );
}
