create table if not exists project_registry (
  id uuid primary key,
  name text not null unique,
  aliases jsonb not null default '[]'::jsonb,
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

create index if not exists project_registry_name_lower_idx
  on project_registry (lower(name));
