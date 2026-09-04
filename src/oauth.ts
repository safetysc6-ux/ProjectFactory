import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";

const ACCESS_TTL_SECONDS = 3600;
const CODE_TTL_SECONDS = 300;

type SignedPayload = Record<string, unknown> & { exp: number; typ: string };

function b64url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

function secret(): string {
  return process.env.MCP_OAUTH_SIGNING_SECRET || process.env.MCP_OAUTH_CLIENT_SECRET || process.env.MCP_API_TOKEN || "";
}

function sign(payload: SignedPayload): string {
  const key = secret();
  if (!key) throw new Error("Missing MCP_OAUTH_SIGNING_SECRET (or MCP_OAUTH_CLIENT_SECRET fallback)");
  const body = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", key).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verify(token: string, expectedType: string): SignedPayload | null {
  try {
    const [body, sig] = token.split(".");
    if (!body || !sig) return null;
    const expected = crypto.createHmac("sha256", secret()).update(body).digest();
    const got = Buffer.from(sig, "base64url");
    if (expected.length !== got.length || !crypto.timingSafeEqual(expected, got)) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SignedPayload;
    if (payload.typ !== expectedType || Date.now() / 1000 >= payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function getBaseUrl(req?: Request): string {
  const configured = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "");
  if (configured) return configured;
  if (!req) return "http://localhost:10000";
  const proto = (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0]?.trim() || req.protocol;
  return `${proto}://${req.get("host")}`;
}

function allowedClient(clientId: string): boolean {
  return Boolean(process.env.MCP_OAUTH_CLIENT_ID) && clientId === process.env.MCP_OAUTH_CLIENT_ID;
}

function clientSecretFrom(req: Request): { clientId?: string; clientSecret?: string } {
  const auth = req.headers.authorization || "";
  if (auth.startsWith("Basic ")) {
    try {
      const decoded = Buffer.from(auth.slice(6), "base64").toString("utf8");
      const i = decoded.indexOf(":");
      if (i >= 0) return { clientId: decodeURIComponent(decoded.slice(0, i)), clientSecret: decodeURIComponent(decoded.slice(i + 1)) };
    } catch {}
  }
  return {
    clientId: typeof req.body?.client_id === "string" ? req.body.client_id : undefined,
    clientSecret: typeof req.body?.client_secret === "string" ? req.body.client_secret : undefined,
  };
}

function redirectAllowed(uri: string): boolean {
  const configured = (process.env.MCP_OAUTH_ALLOWED_REDIRECT_URIS || "")
    .split(",")
    .map(v => v.trim())
    .filter(Boolean);
  if (configured.length) return configured.includes(uri);

  // For Gemini Spark, the exact redirect URI is supplied during the OAuth request.
  // If no allow-list is configured, only HTTPS redirects are accepted.
  try {
    const u = new URL(uri);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

function pkceMatches(verifier: string, challenge: string, method: string): boolean {
  if (!challenge) return true;
  if (method === "plain") return verifier === challenge;
  const digest = crypto.createHash("sha256").update(verifier).digest("base64url");
  return digest === challenge;
}

export function oauthMetadata(req: Request, res: Response) {
  const base = getBaseUrl(req);
  res.json({
    issuer: base,
    authorization_endpoint: `${base}/authorize`,
    token_endpoint: `${base}/token`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256", "plain"],
    token_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic"],
    scopes_supported: ["mcp:tools"],
  });
}

export function protectedResourceMetadata(req: Request, res: Response) {
  const base = getBaseUrl(req);
  res.json({
    resource: `${base}/mcp`,
    authorization_servers: [base],
    scopes_supported: ["mcp:tools"],
    bearer_methods_supported: ["header"],
  });
}

export function authorize(req: Request, res: Response) {
  const clientId = String(req.query.client_id || "");
  const redirectUri = String(req.query.redirect_uri || "");
  const responseType = String(req.query.response_type || "");
  const state = String(req.query.state || "");
  const scope = String(req.query.scope || "mcp:tools");
  const codeChallenge = String(req.query.code_challenge || "");
  const codeChallengeMethod = String(req.query.code_challenge_method || (codeChallenge ? "S256" : ""));

  if (!allowedClient(clientId)) return res.status(400).send("invalid_client");
  if (responseType !== "code") return res.status(400).send("unsupported_response_type");
  if (!redirectAllowed(redirectUri)) return res.status(400).send("invalid_redirect_uri");

  const code = sign({
    typ: "authorization_code",
    exp: Math.floor(Date.now() / 1000) + CODE_TTL_SECONDS,
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    code_challenge: codeChallenge,
    code_challenge_method: codeChallengeMethod,
    nonce: crypto.randomUUID(),
  });

  const u = new URL(redirectUri);
  u.searchParams.set("code", code);
  if (state) u.searchParams.set("state", state);
  res.redirect(302, u.toString());
}

export function token(req: Request, res: Response) {
  const grantType = String(req.body?.grant_type || "");
  if (grantType !== "authorization_code") {
    return res.status(400).json({ error: "unsupported_grant_type" });
  }

  const { clientId, clientSecret } = clientSecretFrom(req);
  if (!clientId || !clientSecret || !allowedClient(clientId) || clientSecret !== process.env.MCP_OAUTH_CLIENT_SECRET) {
    return res.status(401).json({ error: "invalid_client" });
  }

  const code = String(req.body?.code || "");
  const redirectUri = String(req.body?.redirect_uri || "");
  const verifier = String(req.body?.code_verifier || "");
  const payload = verify(code, "authorization_code");
  if (!payload) return res.status(400).json({ error: "invalid_grant" });
  if (payload.client_id !== clientId || payload.redirect_uri !== redirectUri) {
    return res.status(400).json({ error: "invalid_grant" });
  }

  const challenge = String(payload.code_challenge || "");
  const method = String(payload.code_challenge_method || "S256");
  if (challenge && !pkceMatches(verifier, challenge, method)) {
    return res.status(400).json({ error: "invalid_grant" });
  }

  const accessToken = sign({
    typ: "access_token",
    exp: Math.floor(Date.now() / 1000) + ACCESS_TTL_SECONDS,
    client_id: clientId,
    scope: String(payload.scope || "mcp:tools"),
  });

  res.json({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: ACCESS_TTL_SECONDS,
    scope: String(payload.scope || "mcp:tools"),
  });
}

export function mcpAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";

  // OAuth token is preferred.
  if (bearer && verify(bearer, "access_token")) return next();

  // Optional legacy static API token for manual testing / migration.
  const legacy = process.env.MCP_API_TOKEN;
  if (legacy && bearer === legacy) return next();

  const base = getBaseUrl(req);
  res.setHeader("WWW-Authenticate", `Bearer resource_metadata=\"${base}/.well-known/oauth-protected-resource\"`);
  return res.status(401).json({ error: "unauthorized", oauth: `${base}/.well-known/oauth-authorization-server` });
}
