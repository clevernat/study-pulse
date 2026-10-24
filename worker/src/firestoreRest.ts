// Store over the Firestore REST API (no SDK: keeps the Worker small and fast).
import type { Data, Store } from "../../functions/src/core";

type Value = Record<string, unknown>;

function decode(v: Value): unknown {
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return Number(v.doubleValue);
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("mapValue" in v) return decodeFields((v.mapValue as { fields?: Record<string, Value> }).fields);
  if ("arrayValue" in v) return ((v.arrayValue as { values?: Value[] }).values ?? []).map(decode);
  return null; // nullValue, and types the server never reads (bytes, references, geo points)
}
const decodeFields = (f: Record<string, Value> = {}): Data => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, decode(v)]));

function encode(v: unknown): Value {
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "string") return { stringValue: v };
  if (v === null || v === undefined) return { nullValue: null };
  throw new Error(`Cannot write value of type ${typeof v}`);
}

const encodePath = (path: string) => path.split("/").map(encodeURIComponent).join("/");

/**
 * `token` returns an OAuth access token ("owner" works on the emulator).
 * `base` is the API host: https://firestore.googleapis.com or the emulator.
 */
export function restStore(projectId: string, token: () => Promise<string>, base = "https://firestore.googleapis.com"): Store {
  const root = `${base}/v1/projects/${projectId}/databases/(default)/documents`;
  async function call(url: string, init: RequestInit = {}, okStatus: number[] = []): Promise<Response> {
    const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" } });
    if (!res.ok && !okStatus.includes(res.status)) throw new Error(`Firestore ${init.method ?? "GET"} ${res.status}: ${await res.text()}`);
    return res;
  }
  return {
    async get(path) {
      const res = await call(`${root}/${encodePath(path)}`, {}, [404]);
      return res.status === 404 ? null : decodeFields((await res.json()).fields);
    },
    async list(path) {
      const out: (Data & { id: string })[] = [];
      let pageToken = "";
      do {
        const res = await call(`${root}/${encodePath(path)}?pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`);
        const body = (await res.json()) as { documents?: { name: string; fields?: Record<string, Value> }[]; nextPageToken?: string };
        for (const d of body.documents ?? []) out.push({ id: d.name.split("/").pop()!, ...decodeFields(d.fields) });
        pageToken = body.nextPageToken ?? "";
      } while (pageToken);
      return out;
    },
    async dueReminders(now, limit) {
      const res = await call(`${root}:runQuery`, {
        method: "POST",
        body: JSON.stringify({ structuredQuery: {
          from: [{ collectionId: "reminders", allDescendants: true }],
          where: { compositeFilter: { op: "AND", filters: [
            { fieldFilter: { field: { fieldPath: "sent" }, op: "EQUAL", value: { booleanValue: false } } },
            { fieldFilter: { field: { fieldPath: "fireAt" }, op: "LESS_THAN_OR_EQUAL", value: encode(now) } },
          ] } },
          limit,
        } }),
      });
      const rows = (await res.json()) as { document?: { name: string; fields?: Record<string, Value> } }[];
      return rows.flatMap((r) => r.document
        ? [{ path: r.document.name.split("/documents/")[1], data: decodeFields(r.document.fields) }] : []);
    },
    async update(path, fields) {
      const mask = Object.keys(fields).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join("&");
      await call(`${root}/${encodePath(path)}?${mask}&currentDocument.exists=true`, {
        method: "PATCH",
        body: JSON.stringify({ fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, encode(v)])) }),
      });
    },
    async remove(path) { await call(`${root}/${encodePath(path)}`, { method: "DELETE" }); },
  };
}
