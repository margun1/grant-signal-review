import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Panel } from "@/components/app/ui";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getIntegrationNotes,
  saveIntegrationNotes,
  type IntegrationNotes,
} from "@/lib/integration-notes.functions";

const notesKey = ["integration-notes"];
const services = [
  ["google_calendar", "구글 캘린더"],
  ["notion", "노션"],
  ["kakao", "카카오톡 채널"],
  ["email", "회신 이메일 발송"],
] as const;

export function IntegrationStatusSettings({ kakao }: { kakao: string }) {
  const [draft, setDraft] = useState<IntegrationNotes | null>(null);
  const client = useQueryClient();
  const loadNotes = useServerFn(getIntegrationNotes);
  const saveNotes = useServerFn(saveIntegrationNotes);
  const notes = useQuery({ queryKey: notesKey, queryFn: () => loadNotes() });
  const status = useQuery({
    queryKey: ["integration_status", "google_calendar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integration_status")
        .select("*")
        .eq("name", "google_calendar")
        .maybeSingle();
      if (error) throw new Error("구글 캘린더 자동 상태를 불러오지 못했습니다.");
      return data;
    },
  });
  const save = useMutation({
    mutationFn: (data: IntegrationNotes) => saveNotes({ data }),
    onSuccess: (saved) => {
      client.setQueryData(notesKey, saved);
      setDraft(null);
      toast.success("외부 연동 상태를 저장했습니다.");
    },
  });
  const calendar = status.data;
  const calendarSuccess = calendar?.last_success
    ? new Date(calendar.last_success).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })
    : "없음";
  const calendarError =
    calendar?.last_error &&
    calendar.last_error_at &&
    (!calendar.last_success ||
      Date.parse(calendar.last_error_at) > Date.parse(calendar.last_success))
      ? calendar.last_error
      : null;
  const descriptions = {
    google_calendar: status.isPending
      ? "자동 상태를 불러오는 중…"
      : (status.error?.message ?? `마지막 성공: ${calendarSuccess}`),
    notion: "연결 안 됨 (연결하면 상품 정보·참고 재고를 읽어옵니다)",
    kakao: kakao ? "주소 등록됨 · 답변 연동은 채널 권한 확인 후 연결" : "미개설",
    email: "미연결 (발송용 도메인 설정 필요)",
  };

  return (
    <Panel
      title="외부 연동 상태"
      action={
        !draft &&
        notes.data && (
          <Button variant="outline" size="sm" onClick={() => setDraft(notes.data)}>
            수정
          </Button>
        )
      }
    >
      {notes.isPending && (
        <p role="status" className="text-sm text-muted-foreground">
          저장된 상태를 불러오는 중…
        </p>
      )}
      {notes.isError && (
        <p role="alert" className="mb-3 text-sm text-destructive">
          {notes.error.message}
        </p>
      )}
      {draft ? (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!save.isPending) save.mutate(draft);
          }}
        >
          <p className="text-sm text-muted-foreground">
            화면에 표시할 상태 문구를 입력하세요. 빈칸은 기본 상태를 표시합니다.
          </p>
          {services.map(([id, label]) => (
            <div key={id} className="space-y-1">
              <Label htmlFor={`integration-${id}`}>{label}</Label>
              <Textarea
                id={`integration-${id}`}
                value={draft[id]}
                placeholder={descriptions[id]}
                maxLength={300}
                rows={2}
                disabled={save.isPending}
                onChange={(event) => setDraft({ ...draft, [id]: event.target.value })}
              />
            </div>
          ))}
          {save.error && (
            <p role="alert" className="text-sm text-destructive">
              {save.error.message}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "저장 중…" : "저장"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={save.isPending}
              onClick={() => {
                save.reset();
                setDraft(null);
              }}
            >
              취소
            </Button>
          </div>
        </form>
      ) : (
        <ul className="space-y-3 text-sm">
          {services.map(([id, label]) => (
            <li key={id}>
              <b>{label}</b>
              <p className="whitespace-pre-wrap break-words">
                {notes.data?.[id] || descriptions[id]}
              </p>
              {id === "google_calendar" && (
                <>
                  {notes.data?.[id] && (
                    <p className="text-xs text-muted-foreground">{descriptions[id]}</p>
                  )}
                  {calendarError && <p className="text-destructive">최근 오류: {calendarError}</p>}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
