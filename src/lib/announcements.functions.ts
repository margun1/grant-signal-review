import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { ModelMessage } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { analysisSchema, reviewSchema } from "./schemas";
import { COMPANY_PROFILE, FIT_RULES, WRITING_RULES } from "./company";

const ATTACH_RE = /\.(pdf|hwp|hwpx|docx?|xlsx?|zip)(\?|$)|download|filedown|atchfile|fileid|getfile/i;
const MAX_TEXT = 60000;

function nameFromUrl(u: string) {
  try {
    const p = new URL(u);
    const last = decodeURIComponent(p.pathname.split("/").filter(Boolean).pop() ?? "");
    return last && last.length < 120 ? last : `첨부자료 (${p.hostname})`;
  } catch {
    return "첨부자료";
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supa = any;

async function loadPdf(supabase: Supa, path: string) {
  const { data, error } = await supabase.storage.from("documents").download(path);
  if (error || !data) throw new Error("파일을 읽을 수 없습니다.");
  return new Uint8Array(await (data as Blob).arrayBuffer());
}

export const analyzeAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // 중복 실행 방지: running이 아닐 때만 점유
    const { data: claimed, error: claimErr } = await supabase
      .from("announcements")
      .update({ analysis_status: "running", analysis_error: null })
      .eq("id", data.id)
      .neq("analysis_status", "running")
      .select("id, url")
      .maybeSingle();
    if (claimErr) throw new Error(claimErr.message);
    if (!claimed) return { ok: false, message: "이미 분석이 진행 중입니다. 잠시 후 새로고침해 주세요." };

    try {
      let { data: materials } = await supabase
        .from("announcement_materials")
        .select("*")
        .eq("announcement_id", data.id)
        .order("created_at");
      materials = materials ?? [];

      if (!materials.some((m: { kind: string }) => m.kind === "web")) {
        const page = await (await import("./server/firecrawl.server")).scrapeUrl(claimed.url);
        const rows: Record<string, unknown>[] = [];
        if (page.ok) {
          rows.push({ announcement_id: data.id, name: page.title ? `공고 본문: ${page.title}` : "공고 본문", kind: "web", source_url: claimed.url, fetch_status: "ok", content: page.markdown.slice(0, MAX_TEXT) });
          const links = Array.from(new Set(page.links.filter((l) => ATTACH_RE.test(l)))).slice(0, 8);
          const { scrapeUrl } = await import("./server/firecrawl.server");
          for (const link of links) {
            const name = nameFromUrl(link);
            if (/\.(hwp|hwpx|zip)(\?|$)/i.test(link)) {
              rows.push({ announcement_id: data.id, name, kind: "attachment", source_url: link, fetch_status: "failed", failure_reason: `${name}을(를) 열 수 없습니다. PDF로 올려주세요.` });
              continue;
            }
            const r = await scrapeUrl(link);
            rows.push(
              r.ok
                ? { announcement_id: data.id, name, kind: "attachment", source_url: link, fetch_status: "ok", content: r.markdown.slice(0, MAX_TEXT) }
                : { announcement_id: data.id, name, kind: "attachment", source_url: link, fetch_status: "failed", failure_reason: `${name}을(를) 열 수 없습니다 (${r.reason}). PDF로 올려주세요.` },
            );
          }
        } else {
          rows.push({ announcement_id: data.id, name: "공고 본문", kind: "web", source_url: claimed.url, fetch_status: "failed", failure_reason: `공고 본문을 열 수 없습니다 (${page.reason}). 공고문을 PDF로 올려주세요.` });
        }
        const { data: inserted } = await supabase.from("announcement_materials").insert(rows as never).select("*");
        materials = [...materials, ...(inserted ?? [])];
      }

      const usable = materials.filter((m: { fetch_status: string }) => m.fetch_status === "ok");
      const failed = materials.filter((m: { fetch_status: string }) => m.fetch_status === "failed");
      if (usable.length === 0) {
        await supabase.from("announcements").update({ analysis_status: "failed", analysis_error: "확인 가능한 공고 자료가 없습니다. 공고문 PDF를 올린 뒤 다시 분석해 주세요." }).eq("id", data.id);
        return { ok: false, message: "확인 가능한 공고 자료가 없습니다." };
      }

      const content: unknown[] = [];
      (content as unknown[]).push({ type: "text", text: `공고 링크: ${claimed.url}\n\n열지 못한 자료(미확인 항목으로 표시할 것): ${failed.map((f: { name: string }) => f.name).join(", ") || "없음"}` });
      for (const m of usable as { name: string; kind: string; source_url: string | null; content: string | null; storage_path: string | null }[]) {
        if (m.content) {
          (content as unknown[]).push({ type: "text", text: `\n=== 자료: ${m.name} (출처 URL: ${m.source_url ?? "업로드"}) ===\n${m.content}` });
        } else if (m.storage_path) {
          (content as unknown[]).push({ type: "text", text: `\n=== 업로드 자료: ${m.name} (PDF, 쪽수로 출처 표기) ===` });
          (content as unknown[]).push({ type: "file", data: await loadPdf(supabase, m.storage_path), mediaType: "application/pdf", filename: m.name });
        }
      }

      const { generateStructured } = await import("./server/ai.server");
      const analysis = await generateStructured({
        schema: analysisSchema,
        instructions: `당신은 ${"주식회사 에너인프라"}의 정부지원사업 검토 비서입니다. 제공된 공고 자료만 근거로 신청 자격과 POWERBOARD 적합성을 별도로 판단하세요.\n${COMPANY_PROFILE}\n${FIT_RULES}\n${WRITING_RULES}\n출처의 document는 위 '자료:' 이름을 그대로 쓰고, url은 그 자료의 출처 URL을 쓰세요.`,
        messages: [{ role: "user", content: content as never }] as ModelMessage[],
      });

      await supabase
        .from("announcements")
        .update({
          analysis: analysis as never,
          analysis_status: "done",
          analysis_error: null,
          title: analysis.title,
          organizer: analysis.organizer,
          deadline: analysis.deadline && /^\d{4}-\d{2}-\d{2}$/.test(analysis.deadline) ? analysis.deadline : null,
          fit_level: analysis.fit_level,
        })
        .eq("id", data.id);
      return { ok: true, message: failed.length ? "일부 자료를 열지 못해 확인 가능한 결과만 표시했습니다." : "분석을 완료했습니다." };
    } catch (e) {
      const msg = (e as Error).message;
      await supabase.from("announcements").update({ analysis_status: "failed", analysis_error: msg }).eq("id", data.id);
      return { ok: false, message: msg };
    }
  });

export const reviewPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { announcementId: string; draftPath: string; draftName: string; requestKey: string }) =>
    z.object({ announcementId: z.string().uuid(), draftPath: z.string().min(1), draftName: z.string().min(1), requestKey: z.string().min(8) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const existing = await supabase.from("plan_reviews").select("id, round, status").eq("request_key", data.requestKey).maybeSingle();
    if (existing.data) return { ok: true, round: existing.data.round, message: "이미 접수된 검토입니다." };

    const { data: mats } = await supabase.from("announcement_materials").select("*").eq("announcement_id", data.announcementId).eq("fetch_status", "ok");
    const materials = (mats ?? []) as { name: string; source_url: string | null; content: string | null; storage_path: string | null }[];

    let review: { id: string; round: number } | null = null;
    for (let i = 0; i < 3 && !review; i++) {
      const { data: last } = await supabase.from("plan_reviews").select("round").eq("announcement_id", data.announcementId).order("round", { ascending: false }).limit(1).maybeSingle();
      const round = (last?.round ?? 0) + 1;
      const ins = await supabase
        .from("plan_reviews")
        .insert({ announcement_id: data.announcementId, round, request_key: data.requestKey, draft_path: data.draftPath, draft_name: data.draftName, material_names: materials.map((m) => m.name) })
        .select("id, round")
        .maybeSingle();
      if (ins.data) review = ins.data;
      else if (ins.error?.message.includes("request_key")) {
        const again = await supabase.from("plan_reviews").select("id, round").eq("request_key", data.requestKey).maybeSingle();
        if (again.data) return { ok: true, round: again.data.round, message: "이미 접수된 검토입니다." };
      } else if (ins.error && !ins.error.message.includes("duplicate")) throw new Error(ins.error.message);
    }
    if (!review) throw new Error("검토 회차를 만들지 못했습니다. 다시 시도해 주세요.");

    try {
      const content: unknown[] = [{ type: "text", text: "아래는 공고 자료와 사업계획서 초안 PDF입니다. 공고 신청 문항, 공식 평가기준(없으면 신청 양식의 작성 요구사항), 초안 대응 문장을 대조해 문항별 검토표를 작성하세요." }];
      for (const m of materials) {
        if (m.content) content.push({ type: "text", text: `\n=== 공고 자료: ${m.name} (${m.source_url ?? "업로드"}) ===\n${m.content}` });
        else if (m.storage_path) {
          content.push({ type: "text", text: `\n=== 공고 자료(PDF): ${m.name} ===` });
          content.push({ type: "file", data: await loadPdf(supabase, m.storage_path), mediaType: "application/pdf", filename: m.name });
        }
      }
      content.push({ type: "text", text: `\n=== 사업계획서 초안: ${data.draftName} ===` });
      content.push({ type: "file", data: await loadPdf(supabase, data.draftPath), mediaType: "application/pdf", filename: data.draftName });

      const { generateStructured } = await import("./server/ai.server");
      const result = await generateStructured({
        schema: reviewSchema,
        instructions: `당신은 주식회사 에너인프라의 사업계획서 검토 비서입니다.\n${COMPANY_PROFILE}\n${WRITING_RULES}\n- 평가기준이 공개돼 있지 않으면 criteria_status를 '공개 평가기준 확인 불가'로 하고 신청 양식 작성 요구사항으로 검토하세요.\n- 실제 설치처, 실증 성과, 시험 결과, 사업비·일정 등 확인되지 않은 내용은 [확인 필요: 확인할 항목]으로 표시하세요.\n- 충족 여부는 근거가 확보된 문항에서만 판단하고, 근거가 없으면 '확인 필요'.\n- gap은 AI가 찾은 누락, manager_checks는 실장이 확인할 사실로 구분하세요.\n- suggestion은 한글 문서에 바로 붙여 넣을 완성 문장으로 쓰세요.\n- 초안 페이지를 읽을 수 없으면 unreadable_pages에 적으세요.`,
        messages: [{ role: "user", content: content as never }],
      });
      await supabase.from("plan_reviews").update({ status: "done", result: result as never, error: null }).eq("id", review.id);
      return { ok: true, round: review.round, message: `${review.round}차 검토를 완료했습니다.` };
    } catch (e) {
      const msg = (e as Error).message;
      await supabase.from("plan_reviews").update({ status: "failed", error: msg }).eq("id", review.id);
      return { ok: false, round: review.round, message: msg };
    }
  });
