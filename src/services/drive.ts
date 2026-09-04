function normalizeFolderId(input: string) {
  return input.match(/folders\/([A-Za-z0-9_-]+)/)?.[1] ?? input.trim();
}

async function accessToken() {
  const client_id = process.env.GOOGLE_CLIENT_ID;
  const client_secret = process.env.GOOGLE_CLIENT_SECRET;
  const refresh_token = process.env.GOOGLE_REFRESH_TOKEN;
  if (!client_id || !client_secret || !refresh_token) throw new Error("Google OAuth environment variables are incomplete");
  const body = new URLSearchParams({ client_id, client_secret, refresh_token, grant_type: "refresh_token" });
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (!r.ok) throw new Error(`Google token refresh failed ${r.status}: ${await r.text()}`);
  const j: any = await r.json();
  return j.access_token as string;
}

export async function listDriveFiles(folderInput: string, nameContains?: string) {
  const folderId = normalizeFolderId(folderInput);
  const token = await accessToken();
  const q = [`'${folderId}' in parents`, "trashed = false"];
  if (nameContains) q.push(`name contains '${nameContains.replaceAll("'", "\\'")}'`);
  const params = new URLSearchParams({ q: q.join(" and "), orderBy: "modifiedTime desc", pageSize: "100", fields: "files(id,name,mimeType,size,modifiedTime,createdTime,webViewLink)" });
  const r = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Drive list failed ${r.status}: ${await r.text()}`);
  return await r.json();
}

export async function downloadDriveText(fileId: string, mimeType?: string) {
  const token = await accessToken();
  let url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`;
  if (mimeType === "application/vnd.google-apps.spreadsheet") {
    url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=text%2Fcsv`;
  }
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Drive download failed ${r.status}: ${await r.text()}`);
  return await r.text();
}

export { normalizeFolderId };
