create table public.company_settings (
  id int primary key default 1 check (id = 1),
  reply_email text,
  kakao_channel_url text,
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.company_settings to authenticated;
grant all on public.company_settings to service_role;
alter table public.company_settings enable row level security;
create policy "staff read settings" on public.company_settings for select to authenticated using (public.is_staff(auth.uid()));
create policy "admin insert settings" on public.company_settings for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy "admin update settings" on public.company_settings for update to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
insert into public.company_settings (id, reply_email) values (1, 'margun3@naver.com');