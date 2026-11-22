create table public.checklist_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null, frequency text not null check (frequency in ('매일','매주')),
  weekday int check (weekday between 0 and 6), assignee uuid, active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null, assignee uuid, due_date date, done boolean not null default false, done_at timestamptz,
  template_id uuid references public.checklist_templates(id) on delete set null,
  created_by uuid default auth.uid(), created_at timestamptz not null default now(),
  unique (template_id, due_date)
);
create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null, work_date date not null, check_in timestamptz, check_out timestamptz,
  updated_at timestamptz not null default now(), unique (user_id, work_date)
);
create table public.attendance_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(), work_date date not null,
  req_check_in timestamptz, req_check_out timestamptz, reason text not null,
  old_check_in timestamptz, old_check_out timestamptz,
  status text not null default '대기' check (status in ('대기','승인','반려')),
  reviewed_by uuid, reviewed_at timestamptz, created_at timestamptz not null default now()
);
create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  channel text not null default '홈페이지', name text, org text, email text, content text not null,
  received_at timestamptz not null default now(), assignee uuid,
  status text not null default '미답변' check (status in ('미답변','처리 중','답변 완료')),
  reply_draft text, created_at timestamptz not null default now()
);
create table public.inquiry_messages (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.inquiries(id) on delete cascade,
  body text not null, sent_to text, result text not null check (result in ('성공','실패','미연결')), error text,
  sent_by uuid default auth.uid(), created_at timestamptz not null default now()
);
create table public.device_issues (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('고객·실증 현장 제품','사내 생산·시험 장비')),
  device text not null, location text, occurred_on date, symptom text not null, photo_path text,
  assignee uuid, status text not null default '접수' check (status in ('접수','처리 중','완료')),
  inquiry_id uuid references public.inquiries(id) on delete set null,
  created_by uuid default auth.uid(), created_at timestamptz not null default now()
);
create table public.device_issue_logs (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.device_issues(id) on delete cascade,
  note text not null, created_by uuid default auth.uid(), created_at timestamptz not null default now()
);
create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  kind text not null default '외부 미팅' check (kind in ('외부 미팅','내부 회의')),
  title text, name text, org text, email text, phone text, topic text,
  start_at timestamptz not null, end_at timestamptz not null,
  status text not null default '확인 대기' check (status in ('확인 대기','확정','취소')),
  calendar_event_id text, calendar_status text,
  created_at timestamptz not null default now()
);
create index on public.meetings (start_at);

grant select, insert, update, delete on public.checklist_templates, public.tasks, public.inquiries, public.inquiry_messages, public.device_issues, public.device_issue_logs, public.meetings to authenticated;
grant select on public.attendance to authenticated;
grant select, insert on public.attendance_requests to authenticated;
grant all on public.checklist_templates, public.tasks, public.attendance, public.attendance_requests, public.inquiries, public.inquiry_messages, public.device_issues, public.device_issue_logs, public.meetings to service_role;

alter table public.checklist_templates enable row level security;
alter table public.tasks enable row level security;
alter table public.attendance enable row level security;
alter table public.attendance_requests enable row level security;
alter table public.inquiries enable row level security;
alter table public.inquiry_messages enable row level security;
alter table public.device_issues enable row level security;
alter table public.device_issue_logs enable row level security;
alter table public.meetings enable row level security;

create policy "staff all" on public.checklist_templates for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy "staff all" on public.tasks for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy "staff all" on public.inquiries for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy "staff all" on public.inquiry_messages for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy "staff all" on public.device_issues for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy "staff all" on public.device_issue_logs for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy "staff all" on public.meetings for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy "own or admin read" on public.attendance for select to authenticated using (public.is_staff(auth.uid()) and (user_id = auth.uid() or public.has_role(auth.uid(),'admin')));
create policy "own or admin read" on public.attendance_requests for select to authenticated using (public.is_staff(auth.uid()) and (user_id = auth.uid() or public.has_role(auth.uid(),'admin')));
create policy "own request" on public.attendance_requests for insert to authenticated with check (public.is_staff(auth.uid()) and user_id = auth.uid() and status = '대기');

create or replace function public.generate_checklist(_date date)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_staff(auth.uid()) then raise exception 'not allowed'; end if;
  insert into public.tasks(title, assignee, due_date, template_id, created_by)
    select t.title, t.assignee, _date, t.id, null from public.checklist_templates t
    where t.active and (t.frequency = '매일' or (t.frequency = '매주' and t.weekday = extract(dow from _date)::int))
  on conflict (template_id, due_date) do nothing;
  get diagnostics n = row_count; return n;
end $$;

create or replace function public.clock(_kind text)
returns public.attendance language plpgsql security definer set search_path = public as $$
declare d date := (now() at time zone 'Asia/Seoul')::date; r public.attendance;
begin
  if not public.is_staff(auth.uid()) then raise exception 'not allowed'; end if;
  insert into public.attendance(user_id, work_date) values (auth.uid(), d) on conflict (user_id, work_date) do nothing;
  if _kind = 'in' then
    update public.attendance set check_in = coalesce(check_in, now()), updated_at = now() where user_id = auth.uid() and work_date = d returning * into r;
  elsif _kind = 'out' then
    update public.attendance set check_out = coalesce(check_out, now()), updated_at = now() where user_id = auth.uid() and work_date = d returning * into r;
  else raise exception 'bad kind'; end if;
  return r;
end $$;

create or replace function public.review_attendance_request(_id uuid, _approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare q public.attendance_requests; a public.attendance;
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'not allowed'; end if;
  select * into q from public.attendance_requests where id = _id and status = '대기' for update;
  if not found then raise exception 'not pending'; end if;
  select * into a from public.attendance where user_id = q.user_id and work_date = q.work_date;
  if _approve then
    insert into public.attendance(user_id, work_date, check_in, check_out) values (q.user_id, q.work_date, q.req_check_in, q.req_check_out)
    on conflict (user_id, work_date) do update set check_in = coalesce(excluded.check_in, attendance.check_in), check_out = coalesce(excluded.check_out, attendance.check_out), updated_at = now();
  end if;
  update public.attendance_requests set status = case when _approve then '승인' else '반려' end, reviewed_by = auth.uid(), reviewed_at = now(),
    old_check_in = a.check_in, old_check_out = a.check_out where id = _id;
end $$;

grant execute on function public.generate_checklist(date), public.clock(text), public.review_attendance_request(uuid, boolean) to authenticated;