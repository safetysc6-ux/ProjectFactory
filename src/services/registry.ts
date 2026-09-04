import crypto from "node:crypto";
import pg from "pg";
import type { ProjectRecord } from "../types.js";

const { Pool } = pg;
const memory = new Map<string, ProjectRecord>();
let pool: pg.Pool | null = null;
let initialized = false;

function databaseUrl() {
  return process.env.REGISTRY_DATABASE_URL?.trim() || "";
}

function useNeon() {
  return Boolean(databaseUrl());
}

function getPool() {
  if (!useNeon()) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: databaseUrl(),
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000
    });
  }
  return pool;
}

export async function initRegistry(): Promise<void> {
  if (!useNeon() || initialized) return;
  const db = getPool();
  if (!db) return;
  await db.query(`
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
  `);
  initialized = true;
}

function rowToProject(row: any): ProjectRecord {
  return {
    id: row.id,
    name: row.name,
    aliases: Array.isArray(row.aliases) ? row.aliases : [],
    description: row.description ?? undefined,
    status: row.status,
    template: row.template ?? undefined,
    github_repo: row.github_repo ?? undefined,
    github_branch: row.github_branch ?? undefined,
    vercel_project_id: row.vercel_project_id ?? undefined,
    vercel_url: row.vercel_url ?? undefined,
    supabase_project_ref: row.supabase_project_ref ?? undefined,
    drive_folder_id: row.drive_folder_id ?? undefined,
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString()
  };
}

export async function listProjects(): Promise<ProjectRecord[]> {
  if (!useNeon()) return [...memory.values()];
  await initRegistry();
  const db = getPool()!;
  const { rows } = await db.query(`select * from project_registry order by created_at desc`);
  return rows.map(rowToProject);
}

export async function findProject(nameOrAlias: string): Promise<ProjectRecord | null> {
  const key = nameOrAlias.trim().toLowerCase();
  if (!useNeon()) {
    for (const p of memory.values()) {
      if (p.name.toLowerCase() === key || (p.aliases || []).some(a => a.toLowerCase() === key)) return p;
    }
    return null;
  }

  await initRegistry();
  const db = getPool()!;
  const { rows } = await db.query(
    `select * from project_registry
     where lower(name) = $1
        or exists (
          select 1 from jsonb_array_elements_text(coalesce(aliases, '[]'::jsonb)) a
          where lower(a) = $1
        )
     limit 1`,
    [key]
  );
  return rows[0] ? rowToProject(rows[0]) : null;
}

export async function saveProject(project: ProjectRecord): Promise<ProjectRecord> {
  project.updated_at = new Date().toISOString();
  if (!useNeon()) {
    memory.set(project.id, project);
    return project;
  }

  await initRegistry();
  const db = getPool()!;
  const { rows } = await db.query(
    `insert into project_registry (
      id, name, aliases, description, status, template,
      github_repo, github_branch, vercel_project_id, vercel_url,
      supabase_project_ref, drive_folder_id, created_at, updated_at
    ) values (
      $1,$2,$3::jsonb,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14
    )
    on conflict (id) do update set
      name = excluded.name,
      aliases = excluded.aliases,
      description = excluded.description,
      status = excluded.status,
      template = excluded.template,
      github_repo = excluded.github_repo,
      github_branch = excluded.github_branch,
      vercel_project_id = excluded.vercel_project_id,
      vercel_url = excluded.vercel_url,
      supabase_project_ref = excluded.supabase_project_ref,
      drive_folder_id = excluded.drive_folder_id,
      updated_at = excluded.updated_at
    returning *`,
    [
      project.id,
      project.name,
      JSON.stringify(project.aliases || []),
      project.description ?? null,
      project.status,
      project.template ?? null,
      project.github_repo ?? null,
      project.github_branch ?? null,
      project.vercel_project_id ?? null,
      project.vercel_url ?? null,
      project.supabase_project_ref ?? null,
      project.drive_folder_id ?? null,
      project.created_at,
      project.updated_at
    ]
  );
  return rowToProject(rows[0]);
}

export async function deleteProjectRecord(project: ProjectRecord): Promise<void> {
  if (!useNeon()) {
    memory.delete(project.id);
    return;
  }
  await initRegistry();
  const db = getPool()!;
  await db.query(`delete from project_registry where id = $1`, [project.id]);
}

export function newProject(name: string, description?: string): ProjectRecord {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name,
    aliases: [],
    description,
    status: "NEW",
    created_at: now,
    updated_at: now
  };
}

export async function closeRegistry(): Promise<void> {
  if (pool) await pool.end();
  pool = null;
  initialized = false;
}
