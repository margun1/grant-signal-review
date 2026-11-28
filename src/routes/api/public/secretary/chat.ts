import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, type UIMessage } from "ai";
import { z } from "zod";
import { SECRETARY_RULES } from "@/lib/company";
import { kstDay, shortAnswer } from "@/lib/secretary";
import { DEFAULT_PREFERENCES, preferencesSchema } from "@/lib/support";

export const Route = createFileRoute("/api/public/secretary/chat")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = process.env["SUPABASE_URL"];
        const publishable = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!url || !publishable)
          return Response.json({ error: "로그인 연결이 설정되지 않았습니다." }, { status: 500 });
        const { secretaryAuth } = await import("@/lib/server/secretary-auth.server");
        const auth = await secretaryAuth(request, url, publishable);
        if (!auth)
          return Response.json({ error: "활성 직원 계정으로 로그인해 주세요." }, { status: 401 });
        if (
          request.headers.get("Origin") &&
          request.headers.get("Origin") !== new URL(request.url).origin
        )
          return Response.json({ error: "허용되지 않은 요청입니다." }, { status: 403 });
        const input = z
          .object({
            messages: z
              .array(
                z.object({
                  id: z.string().max(200),
                  role: z.enum(["user", "assistant", "system"]),
                  parts: z
                    .array(
                      z
                        .object({ type: z.string(), text: z.string().max(4000).optional() })
                        .passthrough(),
                    )
                    .max(30),
                }),
              )
              .min(1)
              .max(100),
          })
          .safeParse(await request.json().catch(() => null));
        const last = input.success ? input.data.messages.at(-1) : null;
        if (!last || last.role !== "user")
          return Response.json({ error: "질문이 올바르지 않습니다." }, { status: 400 });
        const text = last.parts
          .filter((p) => p.type === "text")
          .map((p) => p.text ?? "")
          .join("\n")
          .trim();
        if (!text || text.length > 4000)
          return Response.json({ error: "질문은 4,000자 이내로 입력해 주세요." }, { status: 400 });
        const today = kstDay();
        const [access, brief] = await Promise.all([
          auth.sb.from("secretary_ai_access").select("*").eq("scope", "secretary").maybeSingle(),
          auth.sb
            .from("secretary_briefings")
            .select("content,sources,status,briefing_date")
            .eq("user_id", auth.userId)
            .eq("briefing_date", today)
            .maybeSingle(),
        ]);
        if (access.error || brief.error)
          return Response.json({ error: "AI 사용 상태를 확인하지 못했습니다." }, { status: 500 });
        if (access.data)
          return Response.json({ error: access.data.message }, { status: access.data.status });
        const key = process.env["LOVABLE_API_KEY"];
        if (!key)
          return Response.json(
            { error: "Lovable AI 연결이 설정되지 않았습니다." },
            { status: 503 },
          );
        const { secretaryContext, externalToday } =
          await import("@/lib/server/secretary-context.server");
        const snapshot = z
          .object({ external: z.object({ receivedDate: z.string() }).passthrough() })
          .passthrough()
          .safeParse(brief.data?.sources);
        const weather = process.env["DATA_GO_KEY"];
        const firecrawl = process.env["FIRECRAWL_API_KEY"];
        const prefs = await auth.sb
          .from("support_preferences")
          .select("*")
          .eq("user_id", auth.userId)
          .maybeSingle();
        if (prefs.error)
          return Response.json({ error: "회사 조건을 읽지 못했습니다." }, { status: 500 });
        const external =
          snapshot.success && snapshot.data.external.receivedDate === today
            ? snapshot.data.external
            : await externalToday(
                {
                  lovable: key,
                  ...(weather ? { weather } : {}),
                  ...(firecrawl ? { firecrawl } : {}),
                },
                today,
                preferencesSchema.parse(prefs.data ?? DEFAULT_PREFERENCES),
              );
        const facts = await secretaryContext(auth.sb, today, external);
        const userParts = [{ type: "text", text }];
        const { error: insertError } = await auth.sb
          .from("secretary_messages")
          .insert({ user_id: auth.userId, client_id: last.id, role: "user", parts: userParts });
        if (insertError)
          return Response.json(
            {
              error:
                insertError.code === "23505"
                  ? "이미 보낸 질문입니다. 자동으로 다시 보내지 않습니다."
                  : "질문을 저장하지 못했습니다.",
            },
            { status: 409 },
          );
        const history = await auth.sb
          .from("secretary_messages")
          .select("client_id,role,parts")
          .eq("user_id", auth.userId)
          .order("created_at", { ascending: false })
          .limit(24);
        if (history.error)
          return Response.json({ error: "대화를 불러오지 못했습니다." }, { status: 500 });
        const messages: UIMessage[] = (history.data ?? [])
          .reverse()
          .map((m) => ({
            id: m.client_id,
            role: m.role === "assistant" ? "assistant" : "user",
            parts: z.array(z.object({ type: z.literal("text"), text: z.string() })).parse(m.parts),
          }));
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { makeChat, safeAiError } = await import("@/lib/server/secretary-ai.server");
        const { withLovableAiGatewayRunIdHeader } = await import("@/lib/server/run-id");
        let safeMessage = "AI 답변을 받지 못했습니다.";
        const { result, run } = makeChat(
          request,
          key,
          `${SECRETARY_RULES}\n[오늘 브리핑: 오늘 요약에 존재하는 사실만 재사용]\n${brief.data?.content ?? "기록 없음"}\n[앱 요약 숫자와 오늘 받은 자료]\n${JSON.stringify(facts)}`,
          await convertToModelMessages(messages),
          (error) => {
            safeMessage = error.message;
            if (error.status === 402 || error.status === 403) {
              void supabaseAdmin
                .from("secretary_ai_access")
                .upsert({
                  scope: "secretary",
                  status: error.status,
                  reason: error.reason,
                  message: error.message,
                })
                .then(({ error: saveError }) => {
                  if (saveError) console.error("secretary AI access state save failed");
                });
            }
          },
        );
        const response = result.toUIMessageStreamResponse({
          originalMessages: messages,
          sendReasoning: false,
          onError: (error) =>
            safeAiError(error).status === 500 ? safeMessage : safeAiError(error).message,
          onFinish: async ({ responseMessage, isAborted }) => {
            if (isAborted) return;
            const answer = shortAnswer(
              responseMessage.parts
                .filter((p) => p.type === "text")
                .map((p) => p.text)
                .join("\n"),
            );
            if (!answer) return;
            const { error } = await supabaseAdmin
              .from("secretary_messages")
              .insert({
                user_id: auth.userId,
                client_id: responseMessage.id,
                role: "assistant",
                parts: [{ type: "text", text: answer }],
              });
            if (error)
              throw new Error("답변을 저장하지 못했습니다. 새로고침 전에 내용을 확인해 주세요.");
          },
        });
        return withLovableAiGatewayRunIdHeader(response, run, { "Cache-Control": "no-store" });
      },
    },
  },
});
