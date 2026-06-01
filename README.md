# חד-אור הנדסה - מערכת תסקירי בדיקה והרמה

מערכת Frontend ב-HTML/CSS/Vanilla JS עם Backend קטן ב-Node.js/Express.

## מבנה

```text
frontend/
  index.html
  app.js
  styles.css
  logo.png
  inspector_signature.PNG

backend/
  src/
    app.js
    server.js
    config.js
    supabase.js
    middleware/auth.js
    routes/

api/
  index.js
```

## Environment

ב-Vercel יש להגדיר:

```env
NEXT_PUBLIC_SUPABASE_URL=https://pwodjvlmotdmlizxxiut.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_x0zofeHxBQI4MdeK8HDq6Q_9JWY62tg
SUPABASE_URL=https://pwodjvlmotdmlizxxiut.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_x0zofeHxBQI4MdeK8HDq6Q_9JWY62tg
```

אופציונלי ל-Backend בלבד:

```env
SUPABASE_SERVICE_ROLE_KEY=...
```

אם אין service role, ה-Backend משתמש ב-access token של המשתמש כדי לעבוד מול Supabase תחת RLS.

## אימות

האימות מתבצע דרך ה-Express backend מול Supabase Auth. Vercel הוא רק סביבת האירוח ולא ספק האימות.

כדי שמשתמש יוכל להתחבר, צריך ליצור אותו ב-Supabase Authentication. אם בעתיד רוצים אימות מול טבלת משתמשים מותאמת אישית במקום Supabase Auth, צריך להוסיף מנגנון סיסמאות עם hashing ו-session ייעודי.

## API

Public endpoints:

- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/health`

כל endpoints של מידע עסקי דורשים `Authorization: Bearer <access_token>`.

- `GET /api/auth/session`
- `GET /api/session`
- `GET /api/customers`
- `POST /api/customers`
- `PUT /api/customers/:id`
- `DELETE /api/customers/:id`
- `GET /api/equipment-catalog`
- `POST /api/equipment-catalog`
- `PUT /api/equipment-catalog/:id`
- `DELETE /api/equipment-catalog/:id`
- `GET /api/reports?includeArchived=true`
- `GET /api/reports/archive`
- `GET /api/reports/:id`
- `POST /api/reports`
- `PUT /api/reports/:id`
- `POST /api/reports/:id/archive`
- `DELETE /api/reports/:id`
- `GET /api/report-files/:reportId`
- `POST /api/report-files/:reportId`
- `DELETE /api/report-files/:id`

## טבלאות Supabase צפויות

- `customers`
- `equipment_catalog`
- `reports`
- `report_equipment`
- `report_files`

מבנה העמודות המלא נמצא בקובץ `backend/supabase-schema-contract.sql`.

בגרסה הנוכחית ציוד קשור ללקוח דרך `equipment_catalog.customer_id`, ותסקיר כולל גם `reports.document_date` עבור תאריך עריכת המסמך ליד החתימה.

## הערות Production

ה-Frontend לא שומר מידע עסקי ב-`localStorage`, לא מחזיק mock data, ולא מאתחל Supabase SDK ישירות.

כל הפעולות העסקיות עוברות דרך ה-Backend:

- SELECT
- INSERT
- UPDATE
- soft DELETE / ARCHIVE
- הכנה לקבצים דרך Supabase Storage
