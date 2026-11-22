import { useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel, StatusBadge, todayKst } from "@/components/app/ui";
import { cn } from "@/lib/utils";
import type { Row } from "@/lib/biz";

export const C = { orange: "var(--chart-1)", gold: "var(--chart-2)", taupe: "var(--chart-3)", dark: "var(--chart-5)" };

/** Supabase 1000건 제한을 넘는 조회 */
export async function fetchAll<T>(q: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; ; i += 1000) {
    const { data, error } = await q(i, i + 999);
    if (error) throw new Error("자료를 불러오지 못했습니다.");
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

export function exportXlsx(sheets: { name: string; rows: Record<string, unknown>[] }[], file: string) {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(s.rows.length ? s.rows : [{ 안내: "선택한 기간에 자료가 없습니다." }]), s.name.slice(0, 31));
  XLSX.writeFile(wb, file);
}

export async function readSheet(file: File): Promise<{ rows: Row[]; headers: string[] }> {
  const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]!]!;
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
  // 제목 줄이 있어도 첫 번째로 값이 2칸 이상인 줄을 머리글로 본다
  const hi = Math.max(0, aoa.findIndex((r) => r.filter((c) => String(c).trim()).length >= 2));
  const headers = (aoa[hi] ?? []).map((h) => String(h).trim());
  const rows = aoa.slice(hi + 1).map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""])));
  return { rows, headers };
}

export type Preview = { count: number; errors: string[]; missing: string[]; sample: Record<string, unknown>[]; scope: string; ready: boolean };

/** 업로드 → 미리보기 → 적용 공통 화면 */
export function UploadPanel({ title, required, analyze, apply, needsDate }: {
  title: string; required: string;
  analyze: (d: { rows: Row[]; headers: string[] }, asOf: string) => Preview;
  apply: (fileName: string, asOf: string, d: { rows: Row[]; headers: string[] }) => Promise<string>;
  needsDate?: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<{ rows: Row[]; headers: string[] } | null>(null);
  const [asOf, setAsOf] = useState(todayKst());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const pv = data ? analyze(data, asOf) : null;
  const cols = pv?.sample[0] ? Object.keys(pv.sample[0]) : [];
  return (
    <Panel title={title} accent="primary">
      <p className="mb-3 text-sm text-muted-foreground">필수 열: {required}</p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5"><Label htmlFor={`f-${title}`}>엑셀 파일</Label>
          <Input id={`f-${title}`} type="file" accept=".xlsx,.xls,.csv" className="bg-card" onChange={async (e) => {
            const f = e.target.files?.[0]; setResult(null); setFile(f ?? null); setData(null);
            if (f) { try { setData(await readSheet(f)); } catch { toast.error("엑셀 파일을 읽지 못했습니다."); } }
          }} /></div>
        {needsDate && <div className="space-y-1.5"><Label htmlFor={`d-${title}`}>재고 기준일 (파일에 없을 때)</Label><Input id={`d-${title}`} type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="bg-card" /></div>}
      </div>
      {pv && (
        <div className="mt-4 space-y-3">
          {pv.missing.length > 0 ? <p className="text-sm text-destructive">필수 열이 없습니다: {pv.missing.join(", ")}</p> : (
            <>
              <div className="flex flex-wrap gap-2 text-sm"><StatusBadge label={`반영할 행 ${pv.count}건`} tone="good" />{pv.errors.length > 0 && <StatusBadge label={`오류 ${pv.errors.length}건 (제외)`} tone="warn" />}</div>
              <p className="rounded-md bg-accent p-3 text-sm font-semibold">{pv.scope}</p>
              {pv.errors.length > 0 && <ul className="max-h-32 list-disc overflow-auto pl-5 text-sm text-warning">{pv.errors.slice(0, 20).map((e) => <li key={e}>{e}</li>)}</ul>}
              <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-secondary text-left"><tr>{cols.map((c) => <th key={c} className="p-2">{c}</th>)}</tr></thead>
                <tbody>{pv.sample.map((r, i) => <tr key={i} className="border-t">{cols.map((c) => <td key={c} className="p-2">{String(r[c] ?? "")}</td>)}</tr>)}</tbody></table>
                <p className="mt-1 text-xs text-muted-foreground">앞 {pv.sample.length}건 미리보기</p></div>
              <Button disabled={!pv.ready || busy} onClick={async () => {
                setBusy(true);
                try { const msg = await apply(file!.name, asOf, data!); setResult(msg); setData(null); toast.success("반영했습니다."); }
                catch (e) { toast.error((e as Error).message || "반영하지 못했습니다."); } finally { setBusy(false); }
              }}><Upload className="size-4" />{busy ? "반영 중…" : "확인하고 반영"}</Button>
            </>
          )}
        </div>
      )}
      {result && <p className={cn("mt-3 rounded-md border border-success/40 bg-success/10 p-3 text-sm")}>{result}</p>}
    </Panel>
  );
}

export type Range = { start: string; end: string };
function shift(iso: string, n: number) { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
export function presetRange(days: number): Range { const t = todayKst(); return { start: shift(t, -(days - 1)), end: t }; }

export function RangePicker({ value, onChange, presets = [[1, "최근 1일"], [3, "최근 3일"], [7, "최근 7일"], [30, "최근 30일"], [365, "최근 1년"]] }: { value: Range; onChange: (r: Range) => void; presets?: [number, string][] }) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      {presets.map(([d, l]) => { const r = presetRange(d); const on = r.start === value.start && r.end === value.end;
        return <Button key={d} size="sm" variant={on ? "default" : "outline"} onClick={() => onChange(r)}>{l}</Button>; })}
      <Input aria-label="시작일" type="date" className="h-9 w-40 bg-card" value={value.start} onChange={(e) => onChange({ ...value, start: e.target.value })} />
      <span className="pb-2">~</span>
      <Input aria-label="종료일" type="date" className="h-9 w-40 bg-card" value={value.end} onChange={(e) => onChange({ ...value, end: e.target.value })} />
    </div>
  );
}
