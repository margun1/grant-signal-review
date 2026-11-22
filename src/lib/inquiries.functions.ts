import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { COMPANY_PROFILE, WRITING_RULES } from "./company";

export const draftInquiryReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: q, error } = await context.supabase.from("inquiries").select("content,channel").eq("id", data.id).single();
    if (error || !q) throw new Error("문의를 찾을 수 없습니다.");
    const { generateStructured } = await import("./server/ai.server");
    const r = await generateStructured({
      schema: z.object({ reply: z.string() }),
      instructions: `${COMPANY_PROFILE}\n${WRITING_RULES}\n고객문의 답변 초안을 작성한다. 고객 이름·전화번호·이메일을 본문에 넣지 않는다. 확인되지 않은 사실은 [확인 필요: …]로 표시한다. reply 필드에 본문만 쓴다.`,
      messages: [{ role: "user", content: `채널: ${q.channel}\n문의 내용:\n${q.content}` }],
    });
    await context.supabase.from("inquiries").update({ reply_draft: r.reply, status: "처리 중" }).eq("id", data.id).eq("status", "미답변");
    await context.supabase.from("inquiries").update({ reply_draft: r.reply }).eq("id", data.id);
    return r;
  });

// 발송: 이메일 발송 기능이 아직 연결되지 않아 '미연결'로 기록하고 상태를 바꾸지 않는다(실제 성공한 발송만 답변 완료)
export const sendInquiryReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; body: string }) => z.object({ id: z.string().uuid(), body: z.string().trim().min(1).max(10000) }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: q } = await sb.from("inquiries").select("email,channel").eq("id", data.id).single();
    const { data: s } = await sb.from("company_settings").select("reply_email,kakao_channel_url").eq("id", 1).maybeSingle();
    const reason = q?.channel === "카카오톡" ? (s?.kakao_channel_url ? "카카오톡 답변 연동이 아직 연결되지 않았습니다." : "카카오톡 채널이 아직 등록되지 않았습니다.")
      : !q?.email ? "고객 이메일이 없습니다." : `회신 이메일(${s?.reply_email ?? "미설정"}) 발송 기능이 아직 연결되지 않았습니다.`;
    await sb.from("inquiry_messages").insert({ inquiry_id: data.id, body: data.body, sent_to: q?.email ?? null, result: "미연결", error: reason });
    return { sent: false, reason };
  });
