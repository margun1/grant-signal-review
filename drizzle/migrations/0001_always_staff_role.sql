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
  insert into public.user_roles (user_id, role) values (new.id,'staff') on conflict do nothing;
  if first_user then
    insert into public.user_roles (user_id, role) values (new.id,'admin'),(new.id,'manager') on conflict do nothing;
  else
    if inv.role <> 'staff' then insert into public.user_roles (user_id, role) values (new.id, inv.role) on conflict do nothing; end if;
    if inv.role = 'admin' then insert into public.user_roles (user_id, role) values (new.id,'manager') on conflict do nothing; end if;
    update public.invitations set accepted_at = now() where id = inv.id;
  end if;
  return new;
end $$;