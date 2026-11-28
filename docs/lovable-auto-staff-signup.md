# 신규 가입자 직원 권한 자동 부여

Lovable 프로젝트의 데이터베이스 변경으로 적용합니다. 아래 SQL은 신규 가입 시 실행되는 기존 `public.handle_new_user()` 함수만 교체합니다. 신규 가입자에게 직원 권한이 부여되고, 유효한 초대의 추가 역할과 최초 가입 시 관리자 초기화는 기존 방식으로 처리됩니다. 기존 회원의 권한은 수정하지 않습니다.

이 설정을 적용하면 공개 가입을 완료한 사람은 사내 메뉴의 매출·고객문의 등 직원용 자료를 열 수 있습니다.

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare inv public.invitations%rowtype; first_user boolean;
begin
  select not exists (select 1 from public.user_roles where role = 'admin') into first_user;
  select * into inv from public.invitations where lower(email) = lower(new.email) and not revoked and accepted_at is null;
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id,'staff') on conflict do nothing;
  if first_user then
    insert into public.user_roles (user_id, role) values (new.id,'admin'),(new.id,'manager') on conflict do nothing;
  elsif inv.id is not null then
    if inv.role <> 'staff' then insert into public.user_roles (user_id, role) values (new.id, inv.role) on conflict do nothing; end if;
    if inv.role = 'admin' then insert into public.user_roles (user_id, role) values (new.id,'manager') on conflict do nothing; end if;
    update public.invitations set accepted_at = now() where id = inv.id;
  end if;
  return new;
end $function$;
```

적용 후 초대되지 않은 새 이메일로 가입·인증·로그인하여 사내 메뉴가 표시되는지 확인합니다. Google 가입이 활성화되어 있다면 새 Google 계정도 같은 방식으로 확인합니다.
