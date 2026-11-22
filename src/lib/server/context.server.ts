// AI 비서·리포트용 업무 자료 요약. 구매자명·고객 이름·연락처는 넣지 않는다.
import { summarizeProfit, recommendOrder, type CostRow } from "../biz";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supa = any;

async function all<T>(q: (a: number, b: number) => PromiseLike<{ data: T[] | null }>) { const out: T[] = []; for (let i = 0; ; i += 1000) { const { data } = await q(i, i + 999); out.push(...(data ?? [])); if (!data || data.length < 1000) return out; } }

export async function buildContext(sb: Supa, start: string, end: string) {
  const sales = await all<{ sale_date: string; product: string; quantity: number; amount: number }>((a, b) => sb.from("sales").select("sale_date,product,quantity,amount").gte("sale_date", start).lte("sale_date", end).range(a, b));
  const costs = await all<CostRow>((a, b) => sb.from("product_costs").select("product,unit_cost,effective_date,basis_date").range(a, b));
  const p = summarizeProfit(sales.map((s) => ({ ...s, quantity: Number(s.quantity), amount: Number(s.amount) })), costs);
  const byProduct: Record<string, number> = {}; for (const s of sales) byProduct[s.product] = (byProduct[s.product] ?? 0) + Number(s.quantity);
  const { data: up } = await sb.from("data_uploads").select("kind,period_start,period_end,as_of,created_at").order("created_at", { ascending: false }).limit(10);
  const snaps = await all<{ item: string; quantity: number; as_of: string }>((a, b) => sb.from("inventory_snapshots").select("item,quantity,as_of").order("as_of").range(a, b));
  const { data: items } = await sb.from("inventory_items").select("name,min_stock,target_stock");
  const { data: orders } = await sb.from("purchase_orders").select("item,quantity,status");
  const latest = new Map<string, { quantity: number; as_of: string }>(); for (const s of snaps) latest.set(s.item, s);
  const shortage = (items ?? []).flatMap((it: { name: string; min_stock: number; target_stock: number }) => { const s = latest.get(it.name); if (!s || Number(s.quantity) >= Number(it.min_stock)) return [];
    const pend = (orders ?? []).filter((o: { item: string; status: string }) => o.item === it.name && o.status === "발주 완료").reduce((x: number, o: { quantity: number }) => x + Number(o.quantity), 0);
    return [{ 품목: it.name, 현재: Number(s.quantity), 최소: Number(it.min_stock), 권장발주: recommendOrder(Number(it.target_stock), Number(s.quantity), pend), 기준일: s.as_of }]; });
  const { count: unanswered } = await sb.from("inquiries").select("id", { count: "exact", head: true }).eq("status", "미답변");
  const { data: inq } = await sb.from("inquiries").select("channel,received_at,status,content").neq("status", "답변 완료").order("received_at", { ascending: false }).limit(10);
  const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 9 * 3600000 + 30 * 86400000).toISOString().slice(0, 10);
  const { data: deadlines } = await sb.from("announcements").select("title,deadline,status").gte("deadline", today).lte("deadline", in30).in("status", ["검토 중", "진행"]).order("deadline");
  const { data: tasks } = await sb.from("tasks").select("title,due_date,done").eq("done", false).order("due_date").limit(30);
  const { data: meetings } = await sb.from("meetings").select("kind,title,org,start_at,status").neq("status", "취소").gte("start_at", new Date().toISOString()).order("start_at").limit(20);
  return {
    조회기간: `${start} ~ ${end}`,
    자료기준: (up ?? []).map((u: { kind: string; period_start: string | null; period_end: string | null; as_of: string | null; created_at: string }) => ({ 종류: u.kind, 기간: u.period_start ? `${u.period_start}~${u.period_end}` : null, 기준일: u.as_of, 업로드: u.created_at.slice(0, 10) })),
    매출: { 합계: p.revenue, 판매건수: sales.length, 매출총이익: p.gross, 이익률: p.margin, 원가확인필요건수: p.missingCount, 원가확인필요매출: p.missingRevenue, 원가없는상품: p.missingProducts, 상품별판매량: byProduct },
    부족재고: shortage, 미답변문의수: unanswered ?? 0,
    진행중문의: (inq ?? []).map((q: { channel: string; received_at: string; status: string; content: string }) => ({ 채널: q.channel, 접수일: q.received_at.slice(0, 10), 상태: q.status, 내용요약: q.content.slice(0, 200) })),
    마감임박공고: deadlines ?? [], 미완료할일: tasks ?? [], 예정일정: meetings ?? [],
  };
}

export const reportSchemaShape = "summary(전체 요약), sections(제목·내용 배열: 매출, 매출총이익, 부족 재고, 미답변 문의, 주요 마감), missing(확인 필요 자료 목록)";
