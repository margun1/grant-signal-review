create type public.app_role as enum ('admin','manager','staff');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  role public.app_role not null default 'staff',
  invited_by uuid,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  revoked boolean not null default false
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
grant select, insert, update, delete on public.invitations to authenticated;
grant all on public.invitations to service_role;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.invitations enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;
create or replace function public.is_staff(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles r join public.profiles p on p.id = r.user_id
                 where r.user_id = _user_id and p.active)
$$;

create policy "staff read profiles" on public.profiles for select to authenticated using (public.is_staff(auth.uid()) or id = auth.uid());
create policy "admin update profiles" on public.profiles for update to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "read own or admin roles" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.is_staff(auth.uid()));
create policy "admin manage invitations" on public.invitations for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare inv public.invitations%rowtype; first_user boolean;
begin
  select not exists (select 1 from public.user_roles where role = 'admin') into first_user;
  select * into inv from public.invitations where lower(email) = lower(new.email) and not revoked;
  if not first_user and inv.id is null then
    raise exception '초대받지 않은 이메일입니다. 사내 관리자에게 문의하세요.';
  end if;
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  if first_user then
    insert into public.user_roles (user_id, role) values (new.id,'admin'),(new.id,'manager') on conflict do nothing;
  else
    insert into public.user_roles (user_id, role) values (new.id, inv.role) on conflict do nothing;
    if inv.role = 'admin' then insert into public.user_roles (user_id, role) values (new.id,'manager') on conflict do nothing; end if;
    update public.invitations set accepted_at = now() where id = inv.id;
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- admin role management
create or replace function public.set_user_role(_user_id uuid, _role public.app_role, _enabled boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'forbidden'; end if;
  if _enabled then insert into public.user_roles (user_id, role) values (_user_id,_role) on conflict do nothing;
  else delete from public.user_roles where user_id = _user_id and role = _role; end if;
end $$;

create type public.announcement_status as enum ('검토 중','진행','보류','미진행');

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  title text,
  organizer text,
  deadline date,
  fit_level text,
  analysis jsonb,
  analysis_status text not null default 'pending',
  analysis_error text,
  status public.announcement_status not null default '검토 중',
  status_updated_at timestamptz not null default now(),
  status_updated_by uuid,
  status_note text,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.announcement_materials (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  name text not null,
  kind text not null,
  source_url text,
  storage_path text,
  fetch_status text not null default 'ok',
  failure_reason text,
  content text,
  page_count int,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create table public.plan_reviews (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  round int not null,
  request_key text not null unique,
  draft_path text not null,
  draft_name text not null,
  material_names text[] not null default '{}',
  executed_by uuid not null default auth.uid(),
  status text not null default 'running',
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  unique (announcement_id, round)
);
grant select, insert, update, delete on public.announcements, public.announcement_materials, public.plan_reviews to authenticated;
grant all on public.announcements, public.announcement_materials, public.plan_reviews to service_role;
alter table public.announcements enable row level security;
alter table public.announcement_materials enable row level security;
alter table public.plan_reviews enable row level security;
create policy "staff all announcements" on public.announcements for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy "staff all materials" on public.announcement_materials for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy "staff all reviews" on public.plan_reviews for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

-- only manager/admin may change decision status
create or replace function public.guard_announcement_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status or new.status_note is distinct from old.status_note then
    if auth.uid() is not null and not (public.has_role(auth.uid(),'manager') or public.has_role(auth.uid(),'admin')) then
      raise exception '진행 상태는 실장만 기록할 수 있습니다.';
    end if;
    new.status_updated_at := now();
    new.status_updated_by := auth.uid();
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger announcements_status_guard before update on public.announcements for each row execute function public.guard_announcement_status();

create policy "staff read documents" on storage.objects for select to authenticated using (bucket_id = 'documents' and public.is_staff(auth.uid()));
create policy "staff upload documents" on storage.objects for insert to authenticated with check (bucket_id = 'documents' and public.is_staff(auth.uid()));
