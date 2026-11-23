import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export async function secretaryAuth(request: Request, url: string, key: string) {
  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const sb = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: auth },
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: staff, error: staffError } = await sb.rpc("is_staff", { _user_id: data.user.id });
  if (staffError || !staff) return null;
  return { sb, userId: data.user.id };
}
