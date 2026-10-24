// OAuth access token for a Google service account (JWT bearer flow), with WebCrypto only.
export interface ServiceAccount { client_email: string; private_key: string }

const b64url = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64urlJson = (o: unknown) => b64url(new TextEncoder().encode(JSON.stringify(o)));

/** A signed JWT that asks Google for an access token with these scopes. */
export async function signedJwt(sa: ServiceAccount, scopes: string[], nowSec = Math.floor(Date.now() / 1000)): Promise<string> {
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const key = await crypto.subtle.importKey(
    "pkcs8", Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const unsigned = `${b64urlJson({ alg: "RS256", typ: "JWT" })}.${b64urlJson({
    iss: sa.client_email, scope: scopes.join(" "), aud: "https://oauth2.googleapis.com/token", iat: nowSec, exp: nowSec + 3600,
  })}`;
  return `${unsigned}.${b64url(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned)))}`;
}

// Kept between requests while the Worker stays warm (tokens last 1 hour).
let cached: { token: string; until: number } | null = null;

export async function accessToken(sa: ServiceAccount, scopes: string[]): Promise<string> {
  if (cached && cached.until > Date.now()) return cached.token;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${await signedJwt(sa, scopes)}`,
  });
  if (!res.ok) throw new Error(`Google token ${res.status}: ${await res.text()}`);
  const { access_token, expires_in } = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: access_token, until: Date.now() + (expires_in - 300) * 1000 };
  return access_token;
}
