# ProjectFactory MCP v1.1 — Render + Gemini Spark

Remote MCP server สำหรับ Gemini Spark ใช้สร้างและแก้ไขหลายโปรเจกต์ด้วยชื่อโปรเจกต์เดียว

## ความสามารถหลัก

- `bootstrap_project` สร้างโปรเจกต์จากศูนย์
  - Project Registry
  - GitHub repo
  - scaffold Next.js
  - Supabase project + affiliate schema
  - Vercel project + environment variables
  - optional Google Drive folder binding
  - production deploy
- `modify_project` แก้หลายไฟล์ใน repo แล้ว deploy
- `deploy_project` deploy โปรเจกต์เดิม
- `project_status`, `project_list`, `project_get`
- `project_alias_add`
- `project_connect_drive`
- `drive_list_files`, `drive_latest_files`, `drive_read_text`
- `github_read_file`, `github_write_file`
- `supabase_run_sql`
- `vercel_status`

## Flow

```text
Gemini Spark
   ↓ @ProjectFactory
Render /mcp
   ↓
Project Registry
   ├─ GitHub
   ├─ Supabase
   ├─ Vercel
   └─ Google Drive
```

ตัวอย่างคำสั่ง:

```text
@ProjectFactory สร้าง project affiliate-main จากศูนย์ เป็น affiliate dashboard
เชื่อม Drive folder <URL> สร้าง Supabase + Vercel และ deploy production
```

หลังจากสร้างแล้ว:

```text
@ProjectFactory affiliate-main เพิ่มหน้า Top Product และ deploy
@ProjectFactory affiliate-main ดูไฟล์ AffiliateCommissionReport ล่าสุด
@ProjectFactory affiliate-main ดูสถานะ
```

## Deploy บน Render

1. Push repo นี้ขึ้น GitHub
2. Render → New → Blueprint หรือ Web Service
3. ใช้ `render.yaml`
4. ตั้ง Environment Variables จาก `.env.example`
5. Run `registry.sql` ใน Supabase ที่ใช้เป็น Registry
6. Deploy
7. ทดสอบ `https://<service>.onrender.com/health`
8. MCP URL คือ `https://<service>.onrender.com/mcp`

## Gemini Spark

เพิ่ม Custom App แล้วใส่ MCP URL ของ Render พร้อม Bearer token ถ้าตั้ง `MCP_API_TOKEN`

## Important

- เก็บ secret ใน Render เท่านั้น ห้าม commit `.env`
- Supabase service-role และ management token เป็น server-side secret
- ถ้าใช้ Render free instance อาจมี cold start
- `bootstrap_project` ทำ external writes หลายระบบ ควรใช้กับชื่อโปรเจกต์ใหม่เท่านั้น
