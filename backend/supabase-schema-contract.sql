-- This file documents the schema expected by the Express backend.
-- If your existing Supabase schema uses different column names, either adapt
-- the table names/columns here or update the route normalizers in backend/src/routes.

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null default '',
  contact_name text not null default '',
  contact_phone text not null default '',
  contact_email text not null default '',
  site_address text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists equipment_catalog (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references equipment_catalog(id),
  is_template boolean not null default false,
  suspension_method text not null default '',
  suspension_params jsonb not null default '{}'::jsonb,
  scaffold_number text not null default '',
  motor_numbers text[] not null default '{}'::text[],
  type text not null default '',
  manufacturer text not null default '',
  model text not null default '',
  serial text not null default '',
  safe_load text not null default '',
  self_weight text not null default '',
  description text not null default '',
  rows_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  report_title text not null default '',
  report_number text not null default '',
  previous_report_number text not null default '',
  inspection_date date,
  valid_until date,
  document_date date,
  final_status text not null default '',
  final_status_class text not null default '',
  customer_id uuid references customers(id),
  customer_name text not null default '',
  contact_name text not null default '',
  contact_phone text not null default '',
  contact_email text not null default '',
  site_address text not null default '',
  inspector_name text not null default '',
  inspector_license text not null default '',
  findings text not null default '',
  general_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  deleted_at timestamptz
);

create table if not exists customer_equipment_defaults (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  customer_id uuid not null references customers(id) on delete cascade,
  equipment_catalog_id uuid not null references equipment_catalog(id) on delete cascade,
  suspension_method text not null default '',
  suspension_params jsonb not null default '{}'::jsonb,
  scaffold_number text not null default '',
  motor_numbers text[] not null default '{}'::text[],
  safe_load text not null default '',
  self_weight text not null default '',
  rows_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_id, equipment_catalog_id)
);

create table if not exists suspension_methods (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  code text not null default '',
  name text not null default '',
  description_template text not null default '',
  params_json jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  is_default_equipment_row boolean not null default false,
  default_maker_model text not null default '',
  default_serial text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (owner_id, code)
);

create table if not exists report_equipment (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports(id) on delete cascade,
  equipment_catalog_id uuid references equipment_catalog(id),
  equipment_template_id uuid references equipment_catalog(id),
  sort_order integer not null default 0,
  suspension_method text not null default '',
  suspension_params jsonb not null default '{}'::jsonb,
  scaffold_number text not null default '',
  motor_numbers text[] not null default '{}'::text[],
  type text not null default '',
  manufacturer text not null default '',
  model text not null default '',
  serial text not null default '',
  safe_load text not null default '',
  self_weight text not null default '',
  description text not null default '',
  rows_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists report_files (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports(id) on delete cascade,
  bucket text not null default 'report-files',
  path text not null,
  file_name text not null default '',
  content_type text not null default '',
  size_bytes bigint not null default 0,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Run these on existing databases that were created before the current
-- catalog/template structure and document editing dates were added.
alter table equipment_catalog add column if not exists template_id uuid references equipment_catalog(id);
alter table equipment_catalog add column if not exists is_template boolean not null default false;
alter table equipment_catalog add column if not exists suspension_method text not null default '';
alter table equipment_catalog add column if not exists suspension_params jsonb not null default '{}'::jsonb;
alter table equipment_catalog add column if not exists scaffold_number text not null default '';
alter table equipment_catalog add column if not exists motor_numbers text[] not null default '{}'::text[];
alter table equipment_catalog add column if not exists rows_json jsonb not null default '[]'::jsonb;
create table if not exists customer_equipment_defaults (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  customer_id uuid not null references customers(id) on delete cascade,
  equipment_catalog_id uuid not null references equipment_catalog(id) on delete cascade,
  suspension_method text not null default '',
  suspension_params jsonb not null default '{}'::jsonb,
  scaffold_number text not null default '',
  motor_numbers text[] not null default '{}'::text[],
  safe_load text not null default '',
  self_weight text not null default '',
  rows_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_id, equipment_catalog_id)
);
alter table customer_equipment_defaults add column if not exists owner_id uuid not null default auth.uid();
alter table reports add column if not exists document_date date;
alter table report_equipment add column if not exists equipment_template_id uuid references equipment_catalog(id);
alter table report_equipment add column if not exists suspension_method text not null default '';
alter table report_equipment add column if not exists suspension_params jsonb not null default '{}'::jsonb;
alter table report_equipment add column if not exists scaffold_number text not null default '';
alter table report_equipment add column if not exists motor_numbers text[] not null default '{}'::text[];
alter table report_equipment add column if not exists rows_json jsonb not null default '[]'::jsonb;
alter table suspension_methods add column if not exists is_default_equipment_row boolean not null default false;
alter table suspension_methods add column if not exists default_maker_model text not null default '';
alter table suspension_methods add column if not exists default_serial text not null default '';
create index if not exists equipment_catalog_template_id_idx on equipment_catalog(template_id);
create index if not exists equipment_catalog_is_template_idx on equipment_catalog(is_template);
create index if not exists customer_equipment_defaults_customer_id_idx on customer_equipment_defaults(customer_id);
create index if not exists customer_equipment_defaults_equipment_catalog_id_idx on customer_equipment_defaults(equipment_catalog_id);
create index if not exists suspension_methods_owner_id_idx on suspension_methods(owner_id);
create index if not exists report_equipment_scaffold_number_idx on report_equipment(scaffold_number);
create index if not exists report_equipment_motor_numbers_gin_idx on report_equipment using gin(motor_numbers);

alter table customer_equipment_defaults enable row level security;

drop policy if exists customer_equipment_defaults_select on customer_equipment_defaults;
drop policy if exists customer_equipment_defaults_insert on customer_equipment_defaults;
drop policy if exists customer_equipment_defaults_update on customer_equipment_defaults;
drop policy if exists customer_equipment_defaults_delete on customer_equipment_defaults;

create policy customer_equipment_defaults_select
on customer_equipment_defaults for select
using (owner_id = auth.uid());

create policy customer_equipment_defaults_insert
on customer_equipment_defaults for insert
with check (owner_id = auth.uid());

create policy customer_equipment_defaults_update
on customer_equipment_defaults for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy customer_equipment_defaults_delete
on customer_equipment_defaults for delete
using (owner_id = auth.uid());

alter table suspension_methods enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on customer_equipment_defaults to authenticated;
grant select, insert, update, delete on suspension_methods to authenticated;

drop policy if exists suspension_methods_select on suspension_methods;
drop policy if exists suspension_methods_insert on suspension_methods;
drop policy if exists suspension_methods_update on suspension_methods;
drop policy if exists suspension_methods_delete on suspension_methods;

create policy suspension_methods_select
on suspension_methods for select
using (owner_id = auth.uid());

create policy suspension_methods_insert
on suspension_methods for insert
with check (owner_id = auth.uid());

create policy suspension_methods_update
on suspension_methods for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy suspension_methods_delete
on suspension_methods for delete
using (owner_id = auth.uid());

-- Equipment row JSON stores per-row details only. safe_load and self_weight
-- are item-level values on equipment_catalog/report_equipment.
