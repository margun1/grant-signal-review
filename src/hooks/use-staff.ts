import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useStaff() {
  const q = useQuery({ queryKey: ["staff-list"], queryFn: async () => (await supabase.from("profiles").select("id,email,display_name,active").order("created_at")).data ?? [] });
  const list = q.data ?? [];
  const nameOf = (id: string | null | undefined) => { if (!id) return "미지정"; const p = list.find((x) => x.id === id); return p ? p.display_name || p.email : "알 수 없음"; };
  return { list: list.filter((p) => p.active), nameOf };
}
