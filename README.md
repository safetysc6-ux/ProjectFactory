# ProjectFactory MCP v1.3 — Render + Gemini Spark + Neon

เวอร์ชันนี้เปลี่ยน **Project Registry จาก Supabase เป็น Neon PostgreSQL** แล้ว

## Architecture

```text
Gemini Spark
   ↓ OAuth
ProjectFactory MCP (Render)
   ↓
Neon PostgreSQL  ← Project Registry กลาง
   ├─ project name / aliases
   ├─ GitHub repo
   ├─ Vercel project
   ├─ Supabase project (optional)
   └─ Google Drive folder
```

> Supabase Management API ยังเก็บไว้เป็น optional integration สำหรับโปรเจกต์ที่ต้องการ Supabase เป็นฐานข้อมูลของเว็บ แต่ **ตัว Registry กลางไม่ใช้ Supabase แล้ว**

## ENV ที่เปลี่ยน

ลบ:

```env
REGISTRY_SUPABASE_URL=
REGISTRY_SUPABASE_SERVICE_ROLE_KEY=
```

เพิ่ม:

```env
REGISTRY_DATABASE_URL=postgresql://...
```

ให้ copy **Pooled connection string** จาก Neon Dashboard มาใส่ใน Render Environment

## Render

Build Command:

```bash
npm install && npm run check
```

Start Command:

```bash
npm start
```

Health check:

```text
/health
```

MCP endpoint:

```text
/mcp
```

## Neon Table

ตัว MCP จะสร้าง `project_registry` ให้อัตโนมัติเมื่อเชื่อมครั้งแรก ดังนั้นไม่จำเป็นต้องรัน SQL เอง แต่มี `registry.sql` แนบไว้สำหรับตรวจสอบหรือสร้างด้วยมือ

## Test

หลัง deploy:

```text
https://YOUR-SERVICE.onrender.com/health
```

แล้วนำ URL นี้ไปใส่ Gemini Spark:

```text
https://YOUR-SERVICE.onrender.com/mcp
```

## Important

อย่าใส่ token หรือ database URL จริงลง GitHub ให้เก็บใน Render Environment เท่านั้น
