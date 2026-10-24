// Reads an import file off the main thread (big .apkg files can take a few seconds).
import initSqlJs from "sql.js";
import { readApkg, readCsv, type ImportResult } from "./importers";

export type WorkerReply = { ok: true; result: ImportResult } | { ok: false; error: string };

self.onmessage = async (e: MessageEvent<{ name: string; bytes: ArrayBuffer }>) => {
  const reply = (r: WorkerReply) => (self as unknown as Worker).postMessage(r);
  try {
    const { name, bytes } = e.data;
    if (/\.(csv|tsv|txt)$/i.test(name)) return reply({ ok: true, result: readCsv(new TextDecoder().decode(bytes)) });
    // public/sql-wasm.wasm is a copy of node_modules/sql.js/dist/sql-wasm.wasm (same version).
    const SQL = await initSqlJs({ locateFile: () => "/sql-wasm.wasm" });
    reply({ ok: true, result: readApkg(new Uint8Array(bytes), SQL) });
  } catch (err) {
    reply({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
