# ProjectFactory MCP for Gemini Spark

Use project names as the primary context key.

Examples:
- `สร้าง project affiliate-main`
- `affiliate-main เชื่อม Google Drive folder นี้`
- `affiliate-main เพิ่มหน้า Top Product แล้ว deploy`

Rules:
1. Resolve project by name/alias before modifying anything.
2. Never expose secrets in generated code or tool output.
3. Ask for confirmation before destructive/production-sensitive actions.
4. Keep Google Drive imports idempotent using source Drive file IDs.
5. Prefer staging/test before production where available.
