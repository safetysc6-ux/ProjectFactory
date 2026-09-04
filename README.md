# ProjectFactory MCP v1.2 — Render + Gemini Spark OAuth

Remote multi-project MCP server สำหรับ Gemini Spark โดยเฉพาะ

## Gemini Spark connection

หลัง Deploy บน Render ให้ตั้ง `PUBLIC_BASE_URL` เป็น URL ของ Render เช่น:

```text
https://project-factory-mcp.onrender.com
```

แล้วใน Gemini Spark > Custom apps:

```text
MCP server URL:
https://project-factory-mcp.onrender.com/mcp

OAuth Client ID:
ค่าจาก MCP_OAUTH_CLIENT_ID

OAuth Client Secret:
ค่าจาก MCP_OAUTH_CLIENT_SECRET
```

MCP มี OAuth endpoints:

```text
/.well-known/oauth-authorization-server
/.well-known/oauth-protected-resource
/authorize
/token
/mcp
/health
```

## Render settings

```text
Runtime: Node
Build Command: npm install && npm run check
Start Command: npm start
Health Check Path: /health
```

## ENV กลุ่มแรกที่ต้องตั้งเพื่อเชื่อม Spark

```env
PUBLIC_BASE_URL=https://YOUR-SERVICE.onrender.com
MCP_OAUTH_CLIENT_ID=projectfactory-gemini-spark
MCP_OAUTH_CLIENT_SECRET=สุ่มรหัสยาวอย่างน้อย32ตัว
MCP_OAUTH_SIGNING_SECRET=สุ่มอีกชุดหนึ่งอย่างน้อย32ตัว
```

`MCP_OAUTH_CLIENT_ID` ไม่ใช่ Google Client ID — เป็น Client ID ที่เรากำหนดให้ Spark เชื่อม MCP นี้

## Security

- Client Secret และ Signing Secret เก็บเฉพาะ Render Environment
- ห้าม commit `.env`
- v1.2 รองรับ PKCE (`S256`/`plain`)
- ถ้ายังไม่รู้ Gemini redirect URI ให้เว้น `MCP_OAUTH_ALLOWED_REDIRECT_URIS`; ระบบจะยอมรับเฉพาะ HTTPS redirect
- หลังเห็น redirect URI จริงจาก log/error แนะนำใส่ allow-list ให้ตรงแบบ exact match

## Existing ProjectFactory features

- multi-project registry
- bootstrap project
- GitHub code write
- Vercel project/deploy integration
- Supabase management/schema
- Google Drive / Sheet / CSV integration
- affiliate project template
