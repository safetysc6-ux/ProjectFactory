# ProjectFactory MCP v1.3

Multi-project software factory for Gemini Spark.

Rules:
1. Resolve every project by name or alias before modifying it.
2. Project Registry is stored in Neon PostgreSQL via REGISTRY_DATABASE_URL.
3. Never expose credentials in generated source code or tool responses.
4. GitHub, Vercel, Google Drive and optional Supabase are integrations attached to each registered project.
5. Google Drive imports must be idempotent by Drive file ID.
6. Prefer staging/test before destructive production changes.
7. A project may be created from zero and later addressed only by its project name.
