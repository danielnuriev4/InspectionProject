-- Add default-row metadata to equipment descriptions.
-- Run this in Supabase SQL editor before deploying the frontend/backend that use these fields.

alter table suspension_methods
  add column if not exists is_default_equipment_row boolean not null default false,
  add column if not exists default_maker_model text not null default '',
  add column if not exists default_serial text not null default '';

grant usage on schema public to authenticated;
grant select, insert, update, delete on suspension_methods to authenticated;
grant select, insert, update, delete on customer_equipment_defaults to authenticated;

-- Mark the existing description rows as the automatic base rows for new customer equipment.
-- Change the code list if you want fewer/more rows to open by default.
update suspension_methods
set is_default_equipment_row = true
where code in (
  'guardrail_clamps',
  'drilled_chairs',
  'aluminum_platform',
  'standard_stage',
  'custom_stage',
  'motors_lift'
);
