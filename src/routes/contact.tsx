import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/contact")({
  head: () => ({ meta: [{ title: "POWERBOARD 문의하기 · 주식회사 에너인프라" }] }),
  component: ContactPage,
});

function ContactPage() {
  const submitting = useRef(false);
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = event.currentTarget;
    submitting.current = true;
    setStatus("sending");

    try {
      const response = await fetch("/api/public/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      const result = await response.json();
      if (!response.ok || result.ok !== true) throw new Error("Inquiry submission failed");
      setStatus("success");
    } catch {
      setStatus("error");
    } finally {
      submitting.current = false;
    }
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-8 sm:py-12">
      <section className="rounded-2xl border bg-card p-5 sm:p-8">
        <h1 className="text-2xl font-bold">POWERBOARD 문의하기</h1>
        <p className="mt-2 text-sm text-muted-foreground">제품이나 도입에 관해 문의해 주세요. 입력한 이메일로 답변드립니다.</p>
        {status === "success" ? (
          <p role="status" className="mt-6 rounded-md bg-secondary p-4 font-medium">문의가 접수되었습니다.</p>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={submit}>
            <div className="space-y-1.5"><Label htmlFor="contact-name">이름</Label><Input id="contact-name" name="name" autoComplete="name" maxLength={50} required /></div>
            <div className="space-y-1.5"><Label htmlFor="contact-org">회사·기관 (선택)</Label><Input id="contact-org" name="org" autoComplete="organization" maxLength={100} /></div>
            <div className="space-y-1.5"><Label htmlFor="contact-email">회신 이메일</Label><Input id="contact-email" name="email" type="email" autoComplete="email" maxLength={200} required /></div>
            <div className="space-y-1.5"><Label htmlFor="contact-content">문의 내용</Label><Textarea id="contact-content" name="content" rows={6} maxLength={5000} required /></div>
            <input type="hidden" name="website" value="" />
            {status === "error" && <p role="alert" className="text-sm text-destructive">문의를 접수하지 못했습니다. 입력 내용을 확인하고 다시 시도해 주세요.</p>}
            <Button type="submit" disabled={status === "sending"}>{status === "sending" ? "접수 중…" : "문의 보내기"}</Button>
          </form>
        )}
        <Link to="/company" className="mt-5 inline-block text-sm underline">회사소개로 돌아가기</Link>
      </section>
    </main>
  );
}
