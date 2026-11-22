import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/jobs/hourly")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runHourly } = await import("@/lib/server/jobs.server");
        try { return Response.json({ success: true, ...(await runHourly(supabaseAdmin)) }); }
        catch (e) { console.error("hourly job failed", e); return Response.json({ success: false, error: (e as Error).message }, { status: 500 }); }
      },
    },
  },
});
