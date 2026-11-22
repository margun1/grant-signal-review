import { supabase } from "@/integrations/supabase/client";
import { fetchAll, type Range } from "@/components/app/data";
import type { CostRow } from "@/lib/biz";

export type SaleLite = { sale_date: string; product: string; quantity: number; amount: number };
export async function loadSales(r: Range): Promise<SaleLite[]> {
  return fetchAll<SaleLite>((a, b) => supabase.from("sales").select("sale_date,product,quantity,amount").gte("sale_date", r.start).lte("sale_date", r.end).order("sale_date").order("id").range(a, b));
}
export async function loadCosts(): Promise<CostRow[]> {
  return fetchAll<CostRow>((a, b) => supabase.from("product_costs").select("product,unit_cost,effective_date,basis_date").range(a, b));
}
export async function lastUpload(kind: "sales" | "cost" | "inventory") {
  const { data } = await supabase.from("data_uploads").select("*").eq("kind", kind).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data;
}
