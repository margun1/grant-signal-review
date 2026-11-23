import { createOpenAI } from "@ai-sdk/openai";
import { Output, streamText, type ModelMessage, type TextStreamPart, type ToolSet } from "ai";
import { z } from "zod";
import { createLovableAiGatewayRunIdFetch, getLovableAiGatewayRunId } from "./run-id";

export class SecretaryAiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly reason: string,
  ) {
    super(message);
  }
}
export function safeAiError(error: unknown) {
  if (error instanceof SecretaryAiError) return error;
  return new SecretaryAiError(
    "AI 답변을 받지 못했습니다. 잠시 후 다시 시도해 주세요.",
    500,
    "transient",
  );
}
function connection(request: Request, key: string) {
  const run = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey: key,
    headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: async (input, init) => {
      const r = await run.fetch(input, init);
      if (!r.ok) {
        const body: unknown = await r
          .clone()
          .json()
          .catch(() => null);
        const parsed = z
          .object({
            message: z.string().optional(),
            type: z.string().optional(),
            error: z
              .object({ message: z.string().optional(), type: z.string().optional() })
              .optional(),
          })
          .safeParse(body);
        const message = parsed.success
          ? (parsed.data.message ?? parsed.data.error?.message)
          : undefined;
        const type = parsed.success ? (parsed.data.type ?? parsed.data.error?.type) : undefined;
        const reason =
          r.status === 402 || type === "credit_limit_reached"
            ? "budget"
            : r.status === 403
              ? "denied"
              : "transient";
        throw new SecretaryAiError(message ?? `AI 요청 실패 (${r.status})`, r.status, reason);
      }
      return r;
    },
  });
  return { run, provider };
}
const options = {
  openai: {
    forceReasoning: true,
    reasoningEffort: "low",
    reasoningSummary: "auto",
    store: false,
    include: ["reasoning.encrypted_content"],
  },
};
export async function makeBriefing(request: Request, key: string, instructions: string) {
  const { provider } = connection(request, key);
  let failure: unknown;
  const result = streamText({
    model: provider.responses("openai/gpt-6-astra"),
    instructions,
    messages: [
      {
        role: "user",
        content:
          "오늘의 브리핑을 작성해 주세요. 할 일(최대 2~3개, 각각 근거 숫자), 어제 매출·이번 주 비교, 오늘·내일 날씨, 새로운 지원사업 후보를 빠짐없이 다루되 총 다섯 줄 이내입니다.",
      },
    ],
    output: Output.object({ schema: z.object({ lines: z.array(z.string()).min(1).max(5) }) }),
    maxRetries: 0,
    abortSignal: request.signal,
    providerOptions: options,
    onError: ({ error }) => {
      failure = error;
    },
  });
  try {
    return (await result.output).lines.join("\n");
  } catch (e) {
    throw safeAiError(failure ?? e);
  }
}
export function makeChat(
  request: Request,
  key: string,
  instructions: string,
  messages: ModelMessage[],
  onError: (error: SecretaryAiError) => void,
) {
  const { provider, run } = connection(request, key);
  const result = streamText({
    model: provider.responses("openai/gpt-6-astra"),
    instructions,
    messages,
    maxRetries: 0,
    abortSignal: request.signal,
    providerOptions: options,
    experimental_transform: () => {
      let lines = 1;
      return new TransformStream<TextStreamPart<ToolSet>, TextStreamPart<ToolSet>>({
        transform(part, controller) {
          if (part.type !== "text-delta") {
            controller.enqueue(part);
            return;
          }
          let text = "";
          for (const character of part.text) {
            if (character === "\n") lines++;
            if (lines <= 5) text += character;
          }
          if (text) controller.enqueue({ ...part, text });
        },
      });
    },
    onError: ({ error }) => onError(safeAiError(error)),
  });
  return { result, run };
}
