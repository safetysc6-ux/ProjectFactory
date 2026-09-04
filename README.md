# ProjectFactory MCP v1.4 — Render + Gemini Spark + Neon

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


## v1.4 lifecycle tools

- `archive_project` — ปิดการแก้/Deploy ชั่วคราว แต่เก็บ resource ทุกอย่างไว้
- `restore_project` — เปิด project ที่ archive กลับมาใช้งาน
- `delete_project` — รองรับ `registry_only` และ `full`

ทุก destructive action ต้องส่ง `confirm_project_name` ตรงกับชื่อ project จริง

`full` จะพยายามลบ Vercel -> GitHub -> Supabase แล้วจึงลบ Neon registry. Google Drive binding จะถูกถอดจาก registry เท่านั้น และ **ไม่ลบไฟล์ใน Drive**. ถ้าลบ external resource ตัวใดไม่สำเร็จ registry จะถูกเก็บไว้และ project จะเป็น `FAILED` เพื่อให้กู้/ตรวจต่อได้

### GitHub permission สำหรับ Full Delete
Fine-grained PAT ต้องเพิ่ม `Administration: Read and write` นอกเหนือจาก `Contents: Read and write` หากต้องการให้ MCP ลบ repository ได้


## v1.5 Vercel deployment fix

- Fixes Vercel Deployments API payload for GitHub by sending numeric `repoId`.
- Sends the Vercel `project` id when creating a deployment.
- Adds `repair_project_scaffold` for projects that were created with only README/no `package.json`.

For the existing `affiliate-test-v2`, ask Gemini:

```text
@ProjectFactory repair affiliate-test-v2 with affiliate-dashboard scaffold and deploy
```
