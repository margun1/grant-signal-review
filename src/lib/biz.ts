// 매출·원가·재고 계산 규칙 (설계 문서 기준). 화면과 테스트가 함께 사용한다.
export type Row = Record<string, unknown>;
export type SaleRow = { sale_date: string; buyer_name: string; product: string; quantity: number; amount: number };
export type CostRow = { product: string; unit_cost: number; effective_date: string | null; basis_date?: string };
export type PartRow = { product: string; part: string; unit_price: number; qty: number };
export type InvRow = { item: string; kind: string; quantity: number; as_of: string | null };

const norm = (s: string) => s.replace(/[\s()（）_\-·./]/g, "").toLowerCase();
function pick(row: Row, names: string[]): unknown {
  const keys = Object.keys(row);
  for (const n of names) { const k = keys.find((x) => norm(x) === norm(n)); if (k !== undefined) return row[k]; }
  return undefined;
}
function hasCol(headers: string[], names: string[]) { return headers.some((h) => names.some((n) => norm(h) === norm(n))); }

export function toNum(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") { const t = v.replace(/[,원개\s]/g, ""); if (!t) return null; const n = Number(t); return Number.isFinite(n) ? n : null; }
  return null;
}
export function toDate(v: unknown): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) {
    const p = (n: number) => String(n).padStart(2, "0");
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
  }
  if (typeof v === "number" && v > 20000 && v < 80000) { const d = new Date(Math.round((v - 25569) * 86400000)); return d.toISOString().slice(0, 10); }
  if (typeof v === "string") {
    const m = v.trim().match(/^(\d{4})[-./년\s]+(\d{1,2})[-./월\s]+(\d{1,2})/);
    if (m) return `${m[1]}-${m[2]!.padStart(2, "0")}-${m[3]!.padStart(2, "0")}`;
  }
  return null;
}
const str = (v: unknown) => (v === undefined || v === null ? "" : String(v).trim());

export const COLS = {
  sale_date: ["판매일", "판매일자", "주문일", "일자", "날짜"],
  buyer_name: ["구매자명", "구매자", "고객명"],
  product: ["상품명", "제품명", "품목명", "상품"],
  quantity: ["수량", "판매수량"],
  amount: ["판매금액", "금액", "매출액", "결제금액"],
  unit_cost: ["완제품원가", "원가", "완제품1개당원가", "개당원가"],
  effective_date: ["원가변경일", "적용일", "변경일"],
  part: ["부품명", "재료명", "부품"],
  unit_price: ["부품단가", "단가"],
  qty: ["사용수량", "소요수량"],
  item: ["품목명", "품목", "상품명", "제품명", "부품명"],
  kind: ["구분", "분류", "종류"],
  stock: ["현재재고", "재고", "재고수량", "수량"],
  as_of: ["기준일", "재고기준일", "일자", "날짜"],
} as const;

export type Parsed<T> = { rows: T[]; errors: string[]; missing: string[] };

export function parseSales(data: Row[], headers: string[]): Parsed<SaleRow> {
  const req: [keyof typeof COLS, string][] = [["sale_date", "판매일"], ["buyer_name", "구매자명"], ["product", "상품명"], ["quantity", "수량"], ["amount", "판매금액"]];
  const missing = req.filter(([k]) => !hasCol(headers, [...COLS[k]])).map(([, l]) => l);
  if (missing.length) return { rows: [], errors: [], missing };
  const rows: SaleRow[] = []; const errors: string[] = [];
  data.forEach((r, i) => {
    const d = toDate(pick(r, [...COLS.sale_date])); const p = str(pick(r, [...COLS.product]));
    const q = toNum(pick(r, [...COLS.quantity])); const a = toNum(pick(r, [...COLS.amount]));
    if (!d && !p && q === null && a === null) return;
    if (!d || !p || q === null || a === null) { errors.push(`${i + 2}행: 판매일·상품명·수량·판매금액 중 비어 있거나 잘못된 값이 있습니다.`); return; }
    rows.push({ sale_date: d, buyer_name: str(pick(r, [...COLS.buyer_name])), product: p, quantity: q, amount: a });
  });
  return { rows, errors, missing };
}

export function parseCosts(data: Row[], headers: string[]): Parsed<CostRow> & { parts: PartRow[] } {
  const isParts = hasCol(headers, [...COLS.part]);
  if (isParts) {
    const missing = [["product", "상품명"], ["part", "부품명"], ["unit_price", "부품단가"], ["qty", "사용수량"]].filter(([k]) => !hasCol(headers, [...COLS[k as keyof typeof COLS]])).map(([, l]) => l!);
    if (missing.length) return { rows: [], parts: [], errors: [], missing };
    const parts: PartRow[] = []; const errors: string[] = [];
    data.forEach((r, i) => {
      const p = str(pick(r, [...COLS.product])); const pt = str(pick(r, [...COLS.part]));
      const u = toNum(pick(r, [...COLS.unit_price])); const q = toNum(pick(r, [...COLS.qty]));
      if (!p && !pt) return;
      if (!p || !pt || u === null || q === null) { errors.push(`${i + 2}행: 부품 정보가 비어 있거나 잘못되었습니다.`); return; }
      parts.push({ product: p, part: pt, unit_price: u, qty: q });
    });
    return { rows: [], parts, errors, missing };
  }
  const missing = [["product", "상품명"], ["unit_cost", "완제품 원가"]].filter(([k]) => !hasCol(headers, [...COLS[k as keyof typeof COLS]])).map(([, l]) => l!);
  if (missing.length) return { rows: [], parts: [], errors: [], missing };
  const rows: CostRow[] = []; const errors: string[] = [];
  data.forEach((r, i) => {
    const p = str(pick(r, [...COLS.product])); const c = toNum(pick(r, [...COLS.unit_cost]));
    if (!p && c === null) return;
    if (!p || c === null) { errors.push(`${i + 2}행: 상품명 또는 원가가 비어 있거나 잘못되었습니다.`); return; }
    const ed = pick(r, [...COLS.effective_date]);
    rows.push({ product: p, unit_cost: c, effective_date: str(ed) ? toDate(ed) : null });
  });
  return { rows, parts: [], errors, missing };
}

export function parseInventory(data: Row[], headers: string[]): Parsed<InvRow> {
  const missing = [["item", "품목명"], ["stock", "현재 재고"]].filter(([k]) => !hasCol(headers, [...COLS[k as keyof typeof COLS]])).map(([, l]) => l!);
  if (missing.length) return { rows: [], errors: [], missing };
  const rows: InvRow[] = []; const errors: string[] = [];
  data.forEach((r, i) => {
    const it = str(pick(r, [...COLS.item])); const q = toNum(pick(r, [...COLS.stock]));
    if (!it && q === null) return;
    if (!it || q === null) { errors.push(`${i + 2}행: 품목명 또는 재고 수량이 비어 있거나 잘못되었습니다.`); return; }
    const k = str(pick(r, [...COLS.kind]));
    rows.push({ item: it, kind: /부품|재료/.test(k) ? "부품·재료" : "완제품", quantity: q, as_of: toDate(pick(r, [...COLS.as_of])) });
  });
  return { rows, errors, missing };
}

/** 권장 발주 수량 = max(0, 목표 재고 − 현재 재고 − 발주 완료 건의 미입고 수량) */
export function recommendOrder(target: number, current: number, pendingInbound: number) {
  return Math.max(0, target - current - pendingInbound);
}

/** 판매일에 해당하는 원가: 변경일 ≤ 판매일 중 가장 최근, 없으면 변경일 없는 원가 */
export function costFor(costs: CostRow[], product: string, saleDate: string): CostRow | null {
  const mine = costs.filter((c) => c.product === product);
  const dated = mine.filter((c) => c.effective_date && c.effective_date <= saleDate).sort((a, b) => (a.effective_date! < b.effective_date! ? 1 : -1));
  return dated[0] ?? mine.find((c) => !c.effective_date) ?? null;
}

export type ProfitSummary = { revenue: number; costedRevenue: number; cogs: number; gross: number; margin: number | null; missingCount: number; missingRevenue: number; missingProducts: string[] };
export function summarizeProfit(sales: Pick<SaleRow, "sale_date" | "product" | "quantity" | "amount">[], costs: CostRow[]): ProfitSummary {
  let revenue = 0, costedRevenue = 0, cogs = 0, missingCount = 0, missingRevenue = 0; const miss = new Set<string>();
  for (const s of sales) {
    revenue += s.amount;
    const c = costFor(costs, s.product, s.sale_date);
    if (!c) { missingCount++; missingRevenue += s.amount; miss.add(s.product); continue; }
    costedRevenue += s.amount; cogs += s.quantity * c.unit_cost;
  }
  const gross = costedRevenue - cogs;
  return { revenue, costedRevenue, cogs, gross, margin: costedRevenue ? gross / costedRevenue : null, missingCount, missingRevenue, missingProducts: [...miss] };
}

export function bucketKey(date: string, by: "day" | "week" | "month") {
  if (by === "month") return date.slice(0, 7);
  if (by === "day") return date;
  const monday = new Date(`${date}T00:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return monday.toISOString().slice(0, 10);
}
export const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;
export const cnt = (n: number) => `${n.toLocaleString("ko-KR")}개`;
