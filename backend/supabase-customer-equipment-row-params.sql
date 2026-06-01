create table if not exists customer_equipment_row_params (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  customer_id uuid not null references customers(id) on delete cascade,
  equipment_catalog_id uuid not null references equipment_catalog(id) on delete cascade,
  row_number integer not null default 1,
  maker_model text not null default '',
  serial text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customer_equipment_row_params_customer_id_idx
  on customer_equipment_row_params(customer_id);

create index if not exists customer_equipment_row_params_equipment_catalog_id_idx
  on customer_equipment_row_params(equipment_catalog_id);

alter table customer_equipment_row_params enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on customer_equipment_row_params to authenticated;

drop policy if exists customer_equipment_row_params_select on customer_equipment_row_params;
drop policy if exists customer_equipment_row_params_insert on customer_equipment_row_params;
drop policy if exists customer_equipment_row_params_update on customer_equipment_row_params;
drop policy if exists customer_equipment_row_params_delete on customer_equipment_row_params;

create policy customer_equipment_row_params_select
on customer_equipment_row_params for select
using (owner_id = auth.uid());

create policy customer_equipment_row_params_insert
on customer_equipment_row_params for insert
with check (owner_id = auth.uid());

create policy customer_equipment_row_params_update
on customer_equipment_row_params for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy customer_equipment_row_params_delete
on customer_equipment_row_params for delete
using (owner_id = auth.uid());
