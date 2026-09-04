const API = "https://api.supabase.com";
function headers() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error("SUPABASE_ACCESS_TOKEN is missing");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}
export async function createSupabaseProject(name: string) {
  const organization_id = process.env.SUPABASE_ORG_ID;
  if (!organization_id) throw new Error("SUPABASE_ORG_ID is missing");
  const db_pass = crypto.randomUUID().replaceAll("-", "") + "Aa1!";
  const region = process.env.SUPABASE_REGION || "ap-southeast-1";
  const r = await fetch(`${API}/v1/projects`, { method: "POST", headers: headers(), body: JSON.stringify({ name, organization_id, region, db_pass }) });
  if (!r.ok) throw new Error(`Supabase create project failed ${r.status}: ${await r.text()}`);
  const j: any = await r.json();
  return { ref: j.id as string, name: j.name as string, region: j.region as string };
}
export async function getProjectApiKeys(ref: string) {
  const r = await fetch(`${API}/v1/projects/${encodeURIComponent(ref)}/api-keys`, { headers: headers() });
  if (!r.ok) throw new Error(`Supabase api keys failed ${r.status}: ${await r.text()}`);
  return await r.json() as any[];
}
export async function runSql(ref: string, query: string) {
  const r = await fetch(`${API}/v1/projects/${encodeURIComponent(ref)}/database/query`, { method: "POST", headers: headers(), body: JSON.stringify({ query }) });
  if (!r.ok) throw new Error(`Supabase SQL failed ${r.status}: ${await r.text()}`);
  return await r.json();
}
export async function waitForProject(ref: string, timeoutMs = 180000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const r = await fetch(`${API}/v1/projects/${encodeURIComponent(ref)}`, { headers: headers() });
    if (r.ok) {
      const j:any = await r.json();
      if (["ACTIVE_HEALTHY","ACTIVE"].includes(j.status)) return j;
    }
    await new Promise(r => setTimeout(r, 5000));
  }
  throw new Error("Timed out waiting for Supabase project to become ready");
}
