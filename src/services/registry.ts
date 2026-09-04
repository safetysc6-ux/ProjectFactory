import crypto from "node:crypto";
import type { ProjectRecord } from "../types.js";

const memory = new Map<string, ProjectRecord>();

function sbHeaders() {
  const key = process.env.REGISTRY_SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("REGISTRY_SUPABASE_SERVICE_ROLE_KEY is missing");
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

function sbUrl(path: string) {
  const base = process.env.REGISTRY_SUPABASE_URL?.replace(/\/$/, "");
  if (!base) throw new Error("REGISTRY_SUPABASE_URL is missing");
  return `${base}/rest/v1/${path}`;
}

function useSupabase() {
  return Boolean(process.env.REGISTRY_SUPABASE_URL && process.env.REGISTRY_SUPABASE_SERVICE_ROLE_KEY);
}

export async function listProjects(): Promise<ProjectRecord[]> {
  if (!useSupabase()) return [...memory.values()];
  const r = await fetch(sbUrl("project_registry?select=*&order=created_at.desc"), { headers: sbHeaders() });
  if (!r.ok) throw new Error(`Registry list failed ${r.status}: ${await r.text()}`);
  return await r.json() as ProjectRecord[];
}

export async function findProject(nameOrAlias: string): Promise<ProjectRecord | null> {
  const key = nameOrAlias.trim().toLowerCase();
  const all = await listProjects();
  return all.find(p => p.name.toLowerCase() === key || (p.aliases || []).some(a => a.toLowerCase() === key)) ?? null;
}

export async function saveProject(project: ProjectRecord): Promise<ProjectRecord> {
  project.updated_at = new Date().toISOString();
  if (!useSupabase()) {
    memory.set(project.id, project);
    return project;
  }
  const r = await fetch(sbUrl("project_registry?on_conflict=id"), {
    method: "POST",
    headers: { ...sbHeaders(), Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(project)
  });
  if (!r.ok) throw new Error(`Registry save failed ${r.status}: ${await r.text()}`);
  const rows = await r.json() as ProjectRecord[];
  return rows[0] ?? project;
}

export function newProject(name: string, description?: string): ProjectRecord {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), name, aliases: [], description, status: "NEW", created_at: now, updated_at: now };
}
