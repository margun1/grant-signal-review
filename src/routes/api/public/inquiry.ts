import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// 홈페이지 문의 양식 접수 (외부 공개). 저장만 하고 아무 자료도 돌려주지 않는다.
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
const schema = z.object({
  name: z.string().trim().min(1).max(50), org: z.string().trim().max(100).optional().default(""),
  email: z.string().trim().email().max(200), content: z.string().trim().min(1).max(5000),
  website: z.string().max(0).optional().default(""), // 스팸 방지용 숨김 칸
});

export const Route = createFileRoute("/api/public/inquiry")({
  staticData: { sitemap: false },
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        let body: unknown;
        const ct = request.headers.get("content-type") ?? "";
        try { body = ct.includes("json") ? await request.json() : Object.fromEntries(await request.formData()); } catch { body = null; }
        const p = schema.safeParse(body);
        if (!p.success) return Response.json({ ok: false, error: "이름, 이메일, 내용을 확인해 주세요." }, { status: 400, headers: CORS });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin.from("inquiries").insert({ channel: "홈페이지", name: p.data.name, org: p.data.org || null, email: p.data.email, content: p.data.content });
        if (error) return Response.json({ ok: false, error: "접수하지 못했습니다." }, { status: 500, headers: CORS });
        return Response.json({ ok: true }, { headers: CORS });
      },
    },
  },
});
