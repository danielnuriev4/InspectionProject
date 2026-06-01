alter table suspension_methods
  add column if not exists catalog_name text not null default 'תיאור ציוד';

update suspension_methods
set catalog_name = 'תיאור ציוד'
where catalog_name is null or catalog_name = '';
