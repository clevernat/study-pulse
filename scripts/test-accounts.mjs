// Creates (or resets) two test accounts with sample study data:
//   test_admin  (admin: sees /admin)      test_user  (member: no admin pages)
// Usage:
//   node scripts/test-accounts.mjs            → local emulators (npm run test:e2e:only setup)
//   node scripts/test-accounts.mjs --live     → the real project, with your Firebase CLI login
// The logins are written to test-accounts.local.md (not committed).
import fs from "node:fs";
import crypto from "node:crypto";

const LIVE = process.argv.includes("--live");
const P = LIVE ? "studypulse-tracker-app" : "demo-studypulse";
const AUTH = LIVE ? "https://identitytoolkit.googleapis.com/v1" : "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
const FS = `${LIVE ? "https://firestore.googleapis.com" : "http://127.0.0.1:8080"}/v1/projects/${P}/databases/(default)/documents`;

async function headers() {
  if (!LIVE) return { Authorization: "Bearer owner", "Content-Type": "application/json" };
  // Firebase CLI login (run `firebase login` first). Client id/secret are the public firebase-tools ones.
  const cfg = JSON.parse(fs.readFileSync(`${process.env.HOME}/.config/configstore/firebase-tools.json`, "utf8"));
  const t = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body: new URLSearchParams({
    grant_type: "refresh_token", refresh_token: cfg.tokens.refresh_token,
    client_id: "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com", client_secret: "j9iVZfS8kkCEFUPaAeJV0sAi",
  }) }).then((r) => r.json());
  if (!t.access_token) throw new Error("Firebase CLI login not found or expired. Run: firebase login");
  return { Authorization: `Bearer ${t.access_token}`, "Content-Type": "application/json", "x-goog-user-project": P };
}
const H = await headers();

async function call(url, body, method = "POST") {
  const r = await fetch(url, { method, headers: H, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${url}: ${r.status} ${JSON.stringify(j).slice(0, 300)}`);
  return j;
}

const toFs = (v) => v === null ? { nullValue: null } : typeof v === "boolean" ? { booleanValue: v }
  : typeof v === "number" ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v })
  : typeof v === "string" ? { stringValue: v } : Array.isArray(v) ? { arrayValue: { values: v.map(toFs) } }
  : { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toFs(x)])) } };
const put = (path, data) => call(`${FS}/${path}`, { fields: toFs(data).mapValue.fields }, "PATCH");

/** Creates the account with a confirmed email, or resets its password if it exists. */
async function account(email, username, password) {
  const found = await call(`${AUTH}/projects/${P}/accounts:lookup`, { email: [email] });
  const uid = found.users?.[0]?.localId;
  if (uid) {
    await call(`${AUTH}/projects/${P}/accounts:update`, { localId: uid, password, emailVerified: true, displayName: username });
    return uid;
  }
  return (await call(`${AUTH}/projects/${P}/accounts`, { email, password, emailVerified: true, displayName: username })).localId;
}

const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

async function sampleData(uid, seed) {
  const subjects = [["bio", "Biology", "emerald"], ["chem", "Chemistry", "amber"], ["math", "Maths", "violet"]];
  for (const [id, name, color] of subjects) {
    await put(`users/${uid}/subjects/${id}`, { uid, name, icon: "school", color, category: "STEM", totalMinutes: 0, sessionCount: 0, createdAt: day(-20) });
  }
  for (let n = -13; n <= 0; n++) {
    if ((n + seed) % 4 === 0) continue; // a few days off
    const [sid, name, color] = subjects[(n + 13 + seed) % 3];
    const minutes = 25 + ((n * 7 + seed * 11) % 4 + 4) % 4 * 15;
    await put(`users/${uid}/sessions/sample${n + 13}`, { uid, subjectId: sid, subjectName: name, subjectColor: color, durationMinutes: minutes, focusScore: 100, pomodoroCount: 1,
      date: day(n), startTime: n % 2 ? "18:30" : "09:00", endTime: n % 2 ? "19:20" : "09:50", focusRating: 3 + ((n + seed) % 3 + 3) % 3, distractions: (n + seed) % 2 });
  }
  await put(`users/${uid}/goals/sample`, { uid, title: "Biology revision", type: "weekly", targetHours: 5, currentHours: 0, subjectId: "bio", subjectName: "Biology", deadline: day(6), completed: false, createdAt: day(-1) });
  await put(`users/${uid}/exams/sample`, { subjectId: "bio", title: "Biology mock exam", date: day(10) });
  await put(`users/${uid}/preferences/current`, { dailyTargetMinutes: 60, weeklyTargetMinutes: 360 });
}

const out = [`# StudyPulse test logins (${LIVE ? "live site" : "local emulators"})`, "", "Sign in with the username or the email. Not committed to git.", ""];
for (const [i, [username, role]] of [["test_admin", "admin"], ["test_user", "user"]].entries()) {
  const email = `${username.replace("_", "-")}@studypulse.test`;
  const password = crypto.randomBytes(9).toString("base64url");
  const uid = await account(email, username, password);
  await put(`members/${uid}`, { email, username, name: username === "test_admin" ? "Test Admin" : "Test User", role, joinedAt: Date.now() });
  await put(`usernames/${username}`, { uid, email });
  await sampleData(uid, i);
  out.push(`- **${role === "admin" ? "Admin" : "Member"}**: username \`${username}\` (or \`${email}\`), password \`${password}\``);
  console.log(`${username}: ready (${role})`);
}
fs.writeFileSync("test-accounts.local.md", out.join("\n") + "\n");
console.log("Logins written to test-accounts.local.md");
