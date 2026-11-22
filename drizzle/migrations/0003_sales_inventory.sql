create table public.data_uploads (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('sales','cost','inventory')),
  file_name text not null,
  period_start date, period_end date, as_of date,
  inserted int not null default 0, replaced int not null default 0,
  uploaded_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create table public.sales (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid references public.data_uploads(id) on delete set null,
  sale_date date not null, buyer_name text, product text not null,
  quantity numeric not null, amount numeric not null,
  created_at timestamptz not null default now()
);
create index on public.sales (sale_date);
create table public.product_costs (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid references public.data_uploads(id) on delete set null,
  product text not null, unit_cost numeric not null,
  effective_date date, basis_date date not null default current_date,
  created_at timestamptz not null default now()
);
create table public.part_costs (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid references public.data_uploads(id) on delete set null,
  product text not null, part text not null, unit_price numeric not null, qty numeric not null,
  created_at timestamptz not null default now()
);
create table public.inventory_items (
  name text primary key,
  kind text not null default '완제품' check (kind in ('완제품','부품·재료')),
  min_stock numeric not null default 0, target_stock numeric not null default 0,
  updated_at timestamptz not null default now()
);
create table public.inventory_snapshots (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid references public.data_uploads(id) on delete set null,
  item text not null, kind text not null default '완제품', quantity numeric not null, as_of date not null,
  created_at timestamptz not null default now()
);
create index on public.inventory_snapshots (as_of);
create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  item text not null, quantity numeric not null check (quantity > 0),
  status text not null default '발주 전' check (status in ('발주 전','발주 완료','입고 완료')),
  ordered_at date, received_at date, memo text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.data_uploads, public.sales, public.product_costs, public.part_costs, public.inventory_items, public.inventory_snapshots, public.purchase_orders to authenticated;
grant all on public.data_uploads, public.sales, public.product_costs, public.part_costs, public.inventory_items, public.inventory_snapshots, public.purchase_orders to service_role;

alter table public.data_uploads enable row level security;
alter table public.sales enable row level security;
alter table public.product_costs enable row level security;
alter table public.part_costs enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_snapshots enable row level security;
alter table public.purchase_orders enable row level security;

create policy "staff all" on public.data_uploads for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy "staff all" on public.sales for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy "staff all" on public.product_costs for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy "staff all" on public.part_costs for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy "staff all" on public.inventory_items for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy "staff all" on public.inventory_snapshots for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy "staff all" on public.purchase_orders for all to authenticated using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

create or replace function public.import_sales(_file text, _rows jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare s date; e date; up uuid; del int; ins int;
begin
  if not public.is_staff(auth.uid()) then raise exception 'not allowed'; end if;
  select min((r->>'sale_date')::date), max((r->>'sale_date')::date) into s, e from jsonb_array_elements(_rows) r;
  if s is null then raise exception 'no rows'; end if;
  delete from public.sales where sale_date between s and e;
  get diagnostics del = row_count;
  insert into public.data_uploads(kind, file_name, period_start, period_end, replaced) values ('sales', _file, s, e, del) returning id into up;
  insert into public.sales(upload_id, sale_date, buyer_name, product, quantity, amount)
    select up, (r->>'sale_date')::date, nullif(r->>'buyer_name',''), r->>'product', (r->>'quantity')::numeric, (r->>'amount')::numeric from jsonb_array_elements(_rows) r;
  get diagnostics ins = row_count;
  update public.data_uploads set inserted = ins where id = up;
  return jsonb_build_object('inserted', ins, 'replaced', del, 'start', s, 'end', e);
end $$;

create or replace function public.import_inventory(_file text, _as_of date, _rows jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare up uuid; del int; ins int;
begin
  if not public.is_staff(auth.uid()) then raise exception 'not allowed'; end if;
  delete from public.inventory_snapshots where as_of = _as_of;
  get diagnostics del = row_count;
  insert into public.data_uploads(kind, file_name, as_of, replaced) values ('inventory', _file, _as_of, del) returning id into up;
  insert into public.inventory_snapshots(upload_id, item, kind, quantity, as_of)
    select up, r->>'item', coalesce(nullif(r->>'kind',''),'완제품'), (r->>'quantity')::numeric, _as_of from jsonb_array_elements(_rows) r;
  get diagnostics ins = row_count;
  insert into public.inventory_items(name, kind)
    select distinct on (r->>'item') r->>'item', coalesce(nullif(r->>'kind',''),'완제품') from jsonb_array_elements(_rows) r
    on conflict (name) do update set kind = excluded.kind;
  update public.data_uploads set inserted = ins where id = up;
  return jsonb_build_object('inserted', ins, 'replaced', del);
end $$;

create or replace function public.import_costs(_file text, _costs jsonb, _parts jsonb)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare up uuid; del int := 0; d2 int := 0; ins int := 0; i2 int := 0;
begin
  if not public.is_staff(auth.uid()) then raise exception 'not allowed'; end if;
  insert into public.data_uploads(kind, file_name, as_of) values ('cost', _file, current_date) returning id into up;
  delete from public.product_costs c using jsonb_array_elements(_costs) r
    where c.product = r->>'product' and c.effective_date is not distinct from nullif(r->>'effective_date','')::date;
  get diagnostics del = row_count;
  insert into public.product_costs(upload_id, product, unit_cost, effective_date)
    select up, r->>'product', (r->>'unit_cost')::numeric, nullif(r->>'effective_date','')::date from jsonb_array_elements(_costs) r;
  get diagnostics ins = row_count;
  delete from public.part_costs p where p.product in (select r->>'product' from jsonb_array_elements(_parts) r);
  get diagnostics d2 = row_count;
  insert into public.part_costs(upload_id, product, part, unit_price, qty)
    select up, r->>'product', r->>'part', (r->>'unit_price')::numeric, (r->>'qty')::numeric from jsonb_array_elements(_parts) r;
  get diagnostics i2 = row_count;
  update public.data_uploads set inserted = ins + i2, replaced = del + d2 where id = up;
  return jsonb_build_object('inserted', ins + i2, 'replaced', del + d2);
end $$;

grant execute on function public.import_sales(text, jsonb), public.import_inventory(text, date, jsonb), public.import_costs(text, jsonb, jsonb) to authenticated;