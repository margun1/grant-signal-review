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
        const { refreshSupportSnapshot } = await import("@/lib/server/support.server");
        try {
          const [hourly, support] = await Promise.all([
            runHourly(supabaseAdmin),
            refreshSupportSnapshot(supabaseAdmin).catch((error: unknown) => {
              console.error(
                "K-Startup refresh:",
                error instanceof Error ? error.message : "failed",
              );
              return "failed";
            }),
          ]);
          return Response.json({ success: true, ...hourly, support });
        } catch (e) {
          console.error("hourly job failed", e);
          return Response.json({ success: false, error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
