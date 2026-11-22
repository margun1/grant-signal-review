import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return { session, ready };
}

export function useMe() {
  const { session, ready } = useSession();
  const uid = session?.user.id;
  const q = useQuery({
    queryKey: ["me", uid],
    enabled: !!uid,
    queryFn: async () => {
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", uid!).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", uid!),
      ]);
      const r = (roles ?? []).map((x) => x.role);
      return {
        profile,
        roles: r,
        isAdmin: r.includes("admin"),
        isManager: r.includes("manager") || r.includes("admin"),
        isStaff: r.length > 0 && !!profile?.active,
      };
    },
  });
  return { session, ready, me: q.data, loading: !ready || (!!uid && q.isLoading) };
}
