-- This table is currently named suspension_methods for compatibility with the API,
-- but the UI presents it as "תיאור ציוד".
-- Rows are inserted for every auth user so RLS can show them to the logged-in user.

with seed_rows (code, name, description_template, params_json, sort_order) as (
  values
    (
      'guardrail_clamps',
      'מערכת תילוי תפסי מעקה',
      'מערכת תילוי: {{clampCount}} תפסי מעקה.
עובי המעקה {{railThickness}}.
גובה זרועות {{armHeight}}.
אורך שלוחות {{armLength}}.
כבל העבודה והמשני נתפסים ע"י לוכבים מאובטחים.
צלחות עצירה לכבלים עליונים תלויות בקצה כלי התילוי.
כבלי האבטחה עוברים דרך סופיות בכבלי התילוי ותפוסים למבנה.',
      '[{"key":"clampCount","label":"מספר תפסי מעקה","value":"2"},{"key":"railThickness","label":"עובי המעקה","value":""},{"key":"armHeight","label":"גובה זרועות","value":""},{"key":"armLength","label":"אורך שלוחות","value":""}]'::jsonb,
      10
    ),
    (
      'drilled_chairs',
      'מערכת תילוי כיסאות קידוחים',
      'מערכת תילוי: {{chairCount}} כיסאות קידוחים בקומה עליונה.
קוטר קידוח / עוגן {{anchorDiameter}}.
מרחקים {{spacing}}.
כבל העבודה והמשני נתפסים ע"י לוכבים מאובטחים.
צלחות עצירה לכבלים עליונים תלויות בקצה כלי התילוי.
כבלי האבטחה עוברים דרך סופיות בכבלי התילוי ותפוסים למבנה.',
      '[{"key":"chairCount","label":"מספר כיסאות קידוחים","value":"2"},{"key":"anchorDiameter","label":"קוטר קידוח / עוגן","value":""},{"key":"spacing","label":"מרחקים","value":""}]'::jsonb,
      20
    ),
    (
      'aluminum_platform',
      'בימת אלומיניום',
      'בימת אלומיניום.
רוחב במה {{width}}.
אורך במה {{length}}.
מרחק בין מנועים {{motorDistance}}.',
      '[{"key":"width","label":"רוחב במה","value":""},{"key":"length","label":"אורך במה","value":""},{"key":"motorDistance","label":"מרחק בין מנועים","value":""}]'::jsonb,
      30
    ),
    (
      'standard_stage',
      'במה תקנית',
      'במה תקנית.
רוחב במה {{stageWidth}}.
אורך במה {{stageLength}}.',
      '[{"key":"stageWidth","label":"רוחב במה","value":""},{"key":"stageLength","label":"אורך במה","value":""}]'::jsonb,
      40
    ),
    (
      'custom_stage',
      'במה אחרת',
      '{{stageText}}',
      '[{"key":"stageText","label":"תיאור במה","value":""}]'::jsonb,
      50
    ),
    (
      'motors_lift',
      'מערכת הרמה - מנועים',
      'מערכת הרמה: {{motorCount}} יחידות הנעה.
עם מערכת הורדה בחירום וגלגלים עליונים.',
      '[{"key":"motorCount","label":"מספר מנועים","value":"2"}]'::jsonb,
      60
    )
)
insert into suspension_methods
  (owner_id, code, name, description_template, params_json, sort_order)
select
  auth.users.id,
  seed_rows.code,
  seed_rows.name,
  seed_rows.description_template,
  seed_rows.params_json,
  seed_rows.sort_order
from auth.users
cross join seed_rows
on conflict (owner_id, code) do update set
  name = excluded.name,
  description_template = excluded.description_template,
  params_json = excluded.params_json,
  sort_order = excluded.sort_order,
  updated_at = now();
