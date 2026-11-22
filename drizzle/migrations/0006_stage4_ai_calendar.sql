create table public.ai_reports (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('주간','직접')),
  period_start date not null, period_end date not null,
  week_key text unique,
  content jsonb not null,
  created_by uuid, created_at timestamptz not null default now()
);
create table public.integration_status (
  name text primary key,
  last_success timestamptz, last_error text, last_error_at timestamptz,
  updated_at timestamptz not null default now()
);
grant select, insert on public.ai_reports to authenticated;
grant select on public.integration_status to authenticated;
grant all on public.ai_reports, public.integration_status to service_role;
alter table public.ai_reports enable row level security;
alter table public.integration_status enable row level security;
create policy "staff read" on public.ai_reports for select to authenticated using (public.is_staff(auth.uid()));
create policy "staff insert" on public.ai_reports for insert to authenticated with check (public.is_staff(auth.uid()) and kind = '직접');
create policy "staff read" on public.integration_status for select to authenticated using (public.is_staff(auth.uid()));
alter table public.company_settings add column report_weekday int not null default 1 check (report_weekday between 0 and 6);
alter table public.company_settings add column report_hour int not null default 9 check (report_hour between 0 and 23);