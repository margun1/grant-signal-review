import { createFileRoute, Link } from "@tanstack/react-router";
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { RefreshCw, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { supabase } from "@/integrations/supabase/client";
import {
  ensureSecretaryBriefing,
  getSecretaryScreen,
  getTodayBriefingTasks,
} from "@/lib/secretary.functions";
import { briefingSourcesSchema, kstWeekRange, shortAnswer, type BriefRow } from "@/lib/secretary";
import { getGoogleEvents } from "@/lib/calendar.functions";
import { supportPreferencesOptions, useSupportRecommendations } from "@/lib/support.queries";
import { useMe } from "@/hooks/use-auth";

const screenOptions = queryOptions({
  queryKey: ["secretary-screen"],
  queryFn: () => getSecretaryScreen(),
  staleTime: 30000,
  retry: false,
});
export const Route = createFileRoute("/_authenticated/assistant")({
  loader: ({ context }) => context.queryClient.ensureQueryData(screenOptions),
  head: () => ({
    meta: [
      { title: "AI 비서 · 에너인프라 오늘의 브리핑" },
      {
        name: "description",
        content: "에너인프라 오늘의 업무·매출·날씨·지원사업 브리핑과 저장되는 AI 대화",
      },
      { property: "og:title", content: "AI 비서 · 에너인프라" },
      { property: "og:description", content: "오늘의 브리핑과 근거 숫자로 답하는 경영비서" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AssistantPage,
});
const QUICK = ["이번 주 뭘 준비할까?", "지난달과 비교해줘", "비 온 날 매출은?"];

const meetingTime = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "numeric",
  day: "numeric",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const meetingDay = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "numeric",
  day: "numeric",
  weekday: "short",
});

function BriefingSection({
  title,
  items,
  empty,
  footer,
}: {
  title: string;
  items: ReactNode[];
  empty: string;
  footer?: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-xl border bg-card p-4">
      <h3 className="mb-2 text-sm font-bold">{title}</h3>
      {items.length > 0 ? (
        <ul className="list-disc space-y-1.5 ps-4 text-sm leading-relaxed wrap-break-word">
          {items}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{empty}</p>
      )}
      {footer}
    </section>
  );
}

function BriefingSections({ sources, today }: { sources: BriefRow["sources"]; today: string }) {
  const parsed = briefingSourcesSchema.safeParse(sources);
  const summary = parsed.data?.summary;
  const preferences = useQuery(supportPreferencesOptions);
  const grants = useSupportRecommendations(preferences.data, "json");
  const recommendations = grants.data?.recommendations.slice(0, 5) ?? [];
  const grantsMessage =
    preferences.isError || grants.isError
      ? "추천 공고를 불러오지 못했습니다."
      : grants.isPending
        ? "추천 공고를 불러오는 중…"
        : "현재 조회된 자료에 조건에 맞는 접수 중 공고가 없습니다.";
  const fetchTasks = useServerFn(getTodayBriefingTasks);
  const checklist = useQuery({
    queryKey: ["tasks", "briefing", today],
    queryFn: () => fetchTasks(),
    retry: false,
  });
  const tasks = checklist.data?.tasks ?? [];
  const meetings = summary?.weekMeetings ?? [];
  const range = kstWeekRange(today);
  const fetchGoogleEvents = useServerFn(getGoogleEvents);
  const calendar = useQuery({
    queryKey: ["briefing-google-calendar", range],
    queryFn: () => fetchGoogleEvents({ data: range }),
    staleTime: 60_000,
    retry: false,
  });
  const calendarStatus = calendar.isPending
    ? "Google 캘린더 일정을 불러오는 중…"
    : calendar.isError || calendar.data?.ok === false
      ? "Google 캘린더 일정을 불러오지 못했습니다."
      : null;
  const schedule = [
    ...meetings.map((meeting, index) => ({
      key: `meeting-${index}`,
      title: meeting.title || meeting.kind,
      start: meeting.start_at,
      allDay: false,
      google: false,
    })),
    ...(calendar.data?.events ?? []).map((event) => ({
      key: `google-${event.id}`,
      title: event.title,
      start: event.start,
      allDay: event.allDay,
      google: true,
    })),
  ].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const moreTasks = (checklist.data?.count ?? tasks.length) - tasks.length;
  const moreMeetings = (summary?.weekMeetingCount ?? 0) - meetings.length;

  return (
    <div className="mb-4 grid grid-cols-1 gap-3">
      <BriefingSection
        title="오늘의 할 일"
        empty={
          checklist.isPending
            ? "오늘의 체크리스트를 불러오는 중…"
            : (checklist.error?.message ?? "남은 할 일이 없습니다.")
        }
        items={[
          ...tasks.map((task) => (
            <li key={task.id}>
              {shortAnswer(task.title)}
              {task.recurring && <span className="ml-2 text-xs text-muted-foreground">반복</span>}
            </li>
          )),
          ...(moreTasks > 0 ? [<li key="more">외 {moreTasks}건</li>] : []),
        ]}
      />
      <BriefingSection
        title="이번 주 미팅 일정"
        empty={calendarStatus ?? "표시할 이번 주 일정이 없습니다."}
        items={[
          ...schedule.map((event) => (
            <li key={event.key}>
              {shortAnswer(event.title)}
              <time dateTime={event.start} className="block text-xs text-muted-foreground">
                {(event.allDay ? meetingDay : meetingTime).format(new Date(event.start))}
                {event.allDay && " · 종일"}
                {event.google && " · Google 캘린더"}
              </time>
            </li>
          )),
          ...(moreMeetings > 0 ? [<li key="more">외 {moreMeetings}건</li>] : []),
        ]}
        footer={
          calendarStatus &&
          schedule.length > 0 && (
            <p role="status" className="mt-2 text-xs text-muted-foreground">
              {calendarStatus}
            </p>
          )
        }
      />
      <BriefingSection
        title="이번 주 지원사업"
        empty={grantsMessage}
        items={recommendations.map((grant) => (
          <li key={grant.id || grant.url}>
            <a href={grant.url} target="_blank" rel="noreferrer" className="underline">
              {grant.title}
            </a>
          </li>
        ))}
        footer={
          <Link to="/support" className="mt-3 inline-block text-xs font-semibold underline">
            지원사업 추천 공고 보기
          </Link>
        }
      />
    </div>
  );
}

function AssistantPage() {
  const { data } = useSuspenseQuery(screenOptions);
  const qc = useQueryClient();
  const ensure = useServerFn(ensureSecretaryBriefing);
  const [requestKey] = useState(() => crypto.randomUUID());
  const attempted = useRef(false);
  const [briefError, setBriefError] = useState("");
  const mutation = useMutation({
    mutationFn: ({ force, key }: { force: boolean; key: string }) =>
      ensure({ data: { force, requestKey: key } }),
    onSuccess: (brief) => {
      qc.setQueryData(screenOptions.queryKey, { ...data, brief });
      setBriefError("");
    },
    onError: (e) => setBriefError(e.message),
  });
  const start = mutation.mutate;
  useEffect(() => {
    if (!data.brief && data.isAdmin && !attempted.current) {
      attempted.current = true;
      start({ force: false, key: requestKey });
    }
  }, [data.brief, data.isAdmin, requestKey, start]);
  useEffect(() => {
    if (data.brief?.status !== "generating") return;
    const timer = setInterval(
      () => void qc.invalidateQueries({ queryKey: screenOptions.queryKey }),
      2500,
    );
    return () => clearInterval(timer);
  }, [data.brief?.status, qc]);
  const { session } = useMe();
  const initialMessages: UIMessage[] = data.messages.map((m) => ({
    id: m.client_id,
    role: m.role === "assistant" ? "assistant" : "user",
    parts: z.array(z.object({ type: z.literal("text"), text: z.string() })).parse(m.parts),
  }));
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-6rem)] max-w-4xl flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b pb-5">
        <div className="flex items-center gap-3">
          <div
            className="flex size-10 items-center justify-center rounded-md bg-primary font-bold text-primary-foreground"
            aria-hidden
          >
            EI
          </div>
          <div>
            <h1 className="text-xl font-bold">에너인프라 경영비서</h1>
            <p className="mt-1 text-xs text-muted-foreground">Lovable AI · {data.today}</p>
          </div>
        </div>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1 text-sm font-semibold underline"
        >
          경영현황
          <ArrowUpRight className="size-4" />
        </Link>
      </header>
      <section aria-label="오늘의 브리핑" className="border-b py-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-bold">오늘의 브리핑</h2>
          {data.isAdmin && (
            <Button
              variant="outline"
              size="sm"
              disabled={mutation.isPending || data.brief?.status === "generating"}
              onClick={() => mutation.mutate({ force: true, key: crypto.randomUUID() })}
            >
              <RefreshCw className="size-3.5" />
              다시 만들기
            </Button>
          )}
        </div>
        <BriefingSections sources={data.brief?.sources ?? null} today={data.today} />
        {data.brief?.content && (
          <Message from="assistant">
            <MessageContent>
              <MessageResponse className="whitespace-pre-line leading-relaxed">
                {shortAnswer(data.brief.content)}
              </MessageResponse>
            </MessageContent>
          </Message>
        )}
        {((mutation.isPending && data.brief?.status !== "ready") ||
          data.brief?.status === "generating") && (
          <Shimmer>오늘의 브리핑을 준비하고 있습니다…</Shimmer>
        )}
        {(briefError || data.brief?.error) && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {briefError || data.brief?.error}
          </p>
        )}
        {!data.isAdmin && !data.brief && (
          <p className="text-sm text-muted-foreground">사장님 브리핑은 관리자 계정에 저장됩니다.</p>
        )}
        {data.brief?.content && (
          <p className="mt-3 text-xs text-muted-foreground">
            {new Date(data.brief.updated_at).toLocaleTimeString("ko-KR", {
              timeZone: "Asia/Seoul",
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            저장 · {data.brief.revision}회차 · 접수 기간과 지원 금액은{" "}
            <Link to="/support" className="underline">
              공고 원문
            </Link>
            에서 확인
          </p>
        )}
      </section>
      {session && (
        <SecretaryConversation
          key={session.user.id}
          userId={session.user.id}
          initialMessages={initialMessages}
        />
      )}
    </div>
  );
}
function SecretaryConversation({
  userId,
  initialMessages,
}: {
  userId: string;
  initialMessages: UIMessage[];
}) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/public/secretary/chat",
        headers: async () => {
          const { data } = await supabase.auth.getSession();
          return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
        },
      }),
    [],
  );
  const chat = useChat({
    id: `secretary-${userId}`,
    messages: initialMessages,
    transport,
    onError: (e) => {
      setError(e.message);
      textarea.current?.focus();
    },
    onFinish: () => {
      textarea.current?.focus();
    },
  });
  const busy = chat.status === "submitted" || chat.status === "streaming";
  useEffect(() => {
    textarea.current?.focus();
  }, []);
  useEffect(() => {
    if (!busy) textarea.current?.focus();
  }, [busy]);
  const send = (text: string) => {
    if (busy || !text.trim()) return;
    setError("");
    setInput("");
    void chat.sendMessage({ text: text.trim() });
    textarea.current?.focus();
  };
  return (
    <>
      <Conversation className="min-h-52 max-h-[55dvh] grow" aria-label="경영비서 대화">
        <ConversationContent className="gap-5 px-0 py-5">
          {chat.messages.map((m) => (
            <Message key={m.id} from={m.role}>
              <MessageContent>
                {m.parts.map((p, i) =>
                  p.type === "text" ? (
                    <MessageResponse className="whitespace-pre-line leading-relaxed" key={i}>
                      {m.role === "assistant" ? shortAnswer(p.text) : p.text}
                    </MessageResponse>
                  ) : null,
                )}
              </MessageContent>
            </Message>
          ))}
          {busy && <Shimmer>사장님께 보고를 준비하고 있습니다…</Shimmer>}
        </ConversationContent>
        <ConversationScrollButton aria-label="최근 대화로 이동" />
      </Conversation>
      {error && (
        <p role="alert" className="mb-3 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="sticky bottom-0 space-y-3 bg-background pb-2 pt-3">
        <div className="flex flex-wrap gap-2">
          {QUICK.map((q) => (
            <Button
              key={q}
              variant="outline"
              size="sm"
              disabled={busy}
              className="whitespace-normal text-left"
              onClick={() => send(q)}
            >
              {q}
            </Button>
          ))}
        </div>
        <PromptInput onSubmit={({ text }) => send(text)} maxFiles={0}>
          <PromptInputTextarea
            ref={textarea}
            aria-label="비서에게 질문"
            placeholder="사장님, 무엇을 확인해 드릴까요?"
            maxLength={4000}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit
              status={chat.status}
              aria-label={busy ? "답변 중지" : "질문 보내기"}
              title={busy ? "답변 중지" : "질문 보내기"}
              onStop={() => void chat.stop()}
              disabled={!busy && !input.trim()}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </>
  );
}
