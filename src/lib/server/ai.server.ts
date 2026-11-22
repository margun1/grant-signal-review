import { createOpenAI } from "@ai-sdk/openai";
import { streamText, Output, type ModelMessage } from "ai";
import type { z } from "zod";
import { createLovableAiGatewayRunIdFetch } from "./run-id";

const MODEL = "openai/gpt-6-astra";

export class AiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

/** 구조화된 결과를 서버에서 스트리밍으로 받아 최종 객체를 반환한다. */
export async function generateStructured<T>(opts: {
  schema: z.ZodType<T>;
  instructions: string;
  messages: ModelMessage[];
}): Promise<T> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new AiError("AI 연결 키가 설정되지 않았습니다. 관리자에게 문의하세요.");
  const runIdFetch = createLovableAiGatewayRunIdFetch();
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });
  let streamError: unknown;
  const result = streamText({
    model: provider.responses(MODEL),
    instructions: opts.instructions,
    messages: opts.messages,
    output: Output.object({ schema: opts.schema }),
    onError: ({ error }) => {
      streamError = error;
    },
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "medium",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  } as Parameters<typeof streamText>[0]);
  try {
    const out = (await result.output) as T;
    return out;
  } catch (e) {
    throw toAiError(streamError ?? e);
  }
}

function toAiError(e: unknown): AiError {
  const err = e as { statusCode?: number; status?: number; message?: string };
  const status = err?.statusCode ?? err?.status;
  if (status === 402) return new AiError("AI 사용 크레딧이 부족합니다. 워크스페이스 관리자가 크레딧을 충전한 뒤 다시 실행해 주세요.", 402);
  if (status === 429) return new AiError("AI 요청이 많아 잠시 지연되고 있습니다. 1~2분 뒤 다시 실행해 주세요.", 429);
  if (status === 403) return new AiError("AI 사용이 제한되어 있습니다. 관리자에게 문의하세요.", 403);
  return new AiError(`AI 분석에 실패했습니다: ${err?.message ?? "알 수 없는 오류"}. 잠시 뒤 다시 실행해 주세요.`, status);
}
