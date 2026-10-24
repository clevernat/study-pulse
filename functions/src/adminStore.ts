import type { Firestore } from "firebase-admin/firestore";
import type { Store } from "./core";

/** Store backed by firebase-admin (Cloud Functions and tests). */
export const adminStore = (db: Firestore): Store => ({
  get: async (path) => (await db.doc(path).get()).data() ?? null,
  list: async (path) => (await db.collection(path).get()).docs.map((d) => ({ id: d.id, ...d.data() })),
  dueReminders: async (now, limit) =>
    (await db.collectionGroup("reminders").where("sent", "==", false).where("fireAt", "<=", now).limit(limit).get())
      .docs.map((d) => ({ path: d.ref.path, data: d.data() })),
  update: async (path, fields) => { await db.doc(path).update(fields); },
  remove: async (path) => { await db.doc(path).delete(); },
});
