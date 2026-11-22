<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules
- AI calls and announcement fetching live in `src/lib/*.functions.ts` server functions guarded by `requireSupabaseAuth`; model/Firecrawl helpers are in `src/lib/server/` and are dynamically imported inside handlers so they never reach the browser bundle.
- Access control is enforced in the database: `public.is_staff()` (role + active profile) gates every business table and the private `documents` bucket; signup is blocked by the `handle_new_user` trigger unless an invitation exists (first user becomes admin).
- Plan-review rounds are idempotent via a client-generated `request_key` (unique) plus unique `(announcement_id, round)`.
- Company facts, fit rules and writing rules for prompts live only in `src/lib/company.ts`.
