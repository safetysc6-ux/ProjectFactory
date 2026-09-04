create table if not exists public.project_registry (
  id uuid primary key,
  name text unique not null,
  aliases text[] not null default '{}',
  description text,
  status text not null default 'NEW',
  template text,
  github_repo text,
  github_branch text,
  vercel_project_id text,
  vercel_url text,
  supabase_project_ref text,
  drive_folder_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.project_registry enable row level security;
-- Registry is server-only. Do not add anon policies.
