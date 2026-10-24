// Demo account and data on the local Firebase emulators, for testing the phone app.
// Run `firebase emulators:start --only auth,firestore --project demo-studypulse` first,
// then `npm run seed:emulator`. Sign in with demo@studypulse.test / demopass1
const P = "demo-studypulse";
const FS = `http://127.0.0.1:8080/v1/projects/${P}/databases/(default)/documents`;
const toFs = (v) => v === null ? { nullValue: null } : typeof v === "boolean" ? { booleanValue: v }
  : typeof v === "number" ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v })
  : typeof v === "string" ? { stringValue: v } : Array.isArray(v) ? { arrayValue: { values: v.map(toFs) } }
  : { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toFs(x)])) } };
const put = (path, data) => fetch(`${FS}/${path}`, {
  method: "PATCH", headers: { "Content-Type": "application/json", Authorization: "Bearer owner" },
  body: JSON.stringify({ fields: toFs(data).mapValue.fields }),
}).then((r) => { if (!r.ok) throw new Error(`${path}: ${r.status}`); });
const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const now = Date.now();

const res = await fetch("http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "demo@studypulse.test", password: "demopass1", displayName: "Demo", returnSecureToken: true }),
});
const { localId: uid, error } = await res.json();
if (error) throw new Error(`Sign-up failed: ${error.message} (already seeded? restart the emulators)`);
const u = `users/${uid}`;

await put(`${u}/preferences/current`, { pomodoroLength: 25, shortBreak: 5, longBreak: 15 });
await put(`${u}/subjects/bio`, { uid, name: "Biology", icon: "biotech", color: "emerald", category: "SCI", totalMinutes: 0, sessionCount: 0, createdAt: day(0) });
await put(`${u}/subjects/chem`, { uid, name: "Chemistry", icon: "science", color: "violet", category: "SCI", totalMinutes: 0, sessionCount: 0, createdAt: day(0) });
await put(`${u}/exams/e1`, { subjectId: "bio", title: "Biology midterm", date: day(3), startTime: "09:00", durationMinutes: 90, room: "Hall B", seat: "42", reminderMinutesBefore: 1440, createdAt: 1 });
await put(`${u}/exams/e2`, { subjectId: "chem", title: "Chemistry quiz", date: day(10), startTime: "14:00", durationMinutes: 45, createdAt: 2 });
await put(`${u}/tasks/t1`, { uid, title: "Lab report", completed: false, kind: "homework", subjectId: "chem", subjectName: "Chemistry", dueDate: day(1), dueTime: "17:00", priority: "high", createdAt: new Date().toISOString() });
await put(`${u}/tasks/t2`, { uid, title: "Read chapter 4", completed: false, kind: "task", subjectId: "bio", subjectName: "Biology", dueDate: day(0), priority: "medium", createdAt: new Date().toISOString() });
await put(`${u}/tasks/t3`, { uid, title: "Practice questions", completed: false, kind: "revision", subjectId: "bio", subjectName: "Biology", dueDate: day(-1), repeatAfterDays: 3, createdAt: new Date().toISOString() });
await put(`${u}/tasks/t4`, { uid, title: "Buy a new notebook", completed: false, kind: "task", createdAt: new Date().toISOString() });
await put(`${u}/studyBlocks/b1`, { title: "Revise cell division", subjectId: "bio", date: day(0), start: "16:00", end: "17:00", createdAt: 1 });
const wd = new Date().getDay();
await put(`${u}/classes/c1`, { subjectId: "bio", title: "Lecture", room: "204", slots: [{ weekday: wd, start: "10:00", end: "11:30" }, { weekday: (wd + 2) % 7, start: "13:00", end: "14:00" }], createdAt: 1 });
await put(`${u}/sessions/s1`, { uid, subjectId: "chem", subjectName: "Chemistry", subjectColor: "violet", durationMinutes: 25, focusScore: 100, pomodoroCount: 1, sessionType: "Deep Work", date: day(-1), startTime: "18:00", endTime: "18:25" });

// One deck: 3 new cards (basic, reverse, cloze) and 2 review cards due today.
await put(`${u}/decks/d1`, { name: "Cell biology", subjectId: "bio", newPerDay: 20, reviewsPerDay: 200, retention: 0.9, createdAt: 1 });
const notes = [
  { id: "n1", type: "basic", fields: { front: "What is the <b>powerhouse</b> of the cell?", back: "The mitochondrion" } },
  { id: "n2", type: "basicReverse", fields: { front: "Osmosis", back: "Movement of water across a membrane" } },
  { id: "n3", type: "cloze", fields: { text: "DNA is copied during {{c1::S phase}} of the {{c2::cell cycle}}." } },
  { id: "n4", type: "basic", fields: { front: "Name the 4 DNA bases", back: "<ul><li>Adenine</li><li>Thymine</li><li>Guanine</li><li>Cytosine</li></ul>" } },
  { id: "n5", type: "basic", fields: { front: "Where does photosynthesis happen?", back: "In the chloroplasts" } },
];
for (const [i, n] of notes.entries()) await put(`${u}/notes/${n.id}`, { deckId: "d1", subjectId: "bio", type: n.type, fields: n.fields, tags: [], createdAt: now - 10_000 + i });
const fresh = { stability: 0, difficulty: 0, scheduled_days: 0, learning_steps: 0, reps: 0, lapses: 0, state: 0, last_review: null };
const review = { stability: 4, difficulty: 5, scheduled_days: 3, learning_steps: 0, reps: 3, lapses: 0, state: 2, last_review: now - 3 * 86_400_000 };
const cards = [
  ["c1", "n1", 0, fresh], ["c2", "n2", 0, fresh], ["c3", "n2", 1, fresh], ["c4", "n3", 1, fresh], ["c5", "n3", 2, fresh],
  ["c6", "n4", 0, review], ["c7", "n5", 0, review],
];
for (const [i, [id, noteId, ord, sched]] of cards.entries()) {
  await put(`${u}/cards/${id}`, { noteId, deckId: "d1", ord, due: sched.state === 0 ? now : now - 3_600_000, ...sched, suspended: false, buriedUntil: null, createdAt: now - 10_000 + i });
}
console.log(`Seeded demo@studypulse.test (uid ${uid}).`);
