import { expect, type Page } from "@playwright/test";

export const PROJECT = "demo-studypulse";
const AUTH = "http://127.0.0.1:9099";
const FS = "http://127.0.0.1:8080";

/** Creates a fresh emulator user with a unique email and returns its credentials. */
export async function createUser(prefix = "e2e") {
  const email = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@studypulse.test`;
  const password = "Test1234!";
  const res = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  if (!res.ok) throw new Error(`createUser failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { localId: string };
  return { email, password, uid: json.localId };
}

/** Signs in through the real login form and waits for the Today page (home). */
export async function login(page: Page, prefix?: string) {
  const user = await createUser(prefix);
  await page.goto("/login/");
  await page.getByTestId("login-email").fill(user.email);
  await page.getByTestId("login-password").fill(user.password);
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/today\/?$/);
  return user;
}

/** Wipes all Firestore emulator data (tests use unique users, so this is optional). */
export async function clearFirestore() {
  await fetch(`${FS}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: "DELETE" });
}

/** Saves a screenshot as evidence under docs/evidence/screenshots/<name>-<project>.png */
export async function evidence(page: Page, name: string) {
  const project = (page.context() as unknown as { _options?: { viewport?: { width: number } } })._options?.viewport?.width;
  const tag = project && project < 500 ? "phone" : "laptop";
  await page.screenshot({ path: `docs/evidence/screenshots/${name}-${tag}.png`, fullPage: true });
}

type FsValue = Record<string, unknown>;
function toFs(v: unknown): FsValue {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "string") return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFs) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v as object).map(([k, x]) => [k, toFs(x)])) } };
}

/** Test setup only: writes a document straight into the emulator (admin access, skips rules). */
export async function seedDoc(uid: string, col: string, data: Record<string, unknown>, id?: string) {
  const base = `${FS}/v1/projects/${PROJECT}/databases/(default)/documents/users/${uid}/${col}`;
  const res = await fetch(id ? `${base}/${id}` : base, {
    method: id ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer owner" },
    body: JSON.stringify({ fields: (toFs(data).mapValue as { fields: unknown }).fields }),
  });
  if (!res.ok) throw new Error(`seedDoc failed: ${res.status} ${await res.text()}`);
}
