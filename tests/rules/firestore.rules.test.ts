import { readFileSync } from "fs";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, deleteDoc, updateDoc, collection, getDocs, writeBatch } from "firebase/firestore";

let env: RulesTestEnvironment;
const TOKEN = "a".repeat(40);

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-studypulse",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8080 },
  });
});
afterAll(() => env.cleanup());
beforeEach(() => env.clearFirestore());

const collections = ["subjects", "sessions", "tasks", "goals", "topics", "exams", "classes",
  "studyBlocks", "habits", "decks", "notes", "cards", "reviewLogs", "reminders", "devices"];

const OWNER = "otengabrokwah950@gmail.com";
/** Signed-in user with a verified email (Google, or a confirmed email link). */
const as = (uid: string, email: string, verified = true) =>
  env.authenticatedContext(uid, { email, email_verified: verified }).firestore();
const seed = (path: string, data: Record<string, unknown>) =>
  env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), path), data); });
const member = (uid: string, role: "admin" | "user" = "user", email = `${uid}@x.test`) =>
  seed(`members/${uid}`, { email, name: uid, role, joinedAt: 1 });

describe("users/{uid}/**", () => {
  beforeEach(async () => { await member("alice"); await member("bob"); });

  test.each(collections)("owner can write and read %s", async (col) => {
    const alice = env.authenticatedContext("alice").firestore();
    await assertSucceeds(setDoc(doc(alice, "users/alice", col, "x"), { a: 1 }));
    await assertSucceeds(getDoc(doc(alice, "users/alice", col, "x")));
  });

  test.each(collections)("other user cannot read or write %s", async (col) => {
    await env.withSecurityRulesDisabled(async (c) => {
      await setDoc(doc(c.firestore(), "users/alice", col, "x"), { a: 1 });
    });
    const bob = env.authenticatedContext("bob").firestore();
    await assertFails(getDoc(doc(bob, "users/alice", col, "x")));
    await assertFails(setDoc(doc(bob, "users/alice", col, "y"), { a: 1 }));
    await assertFails(getDocs(collection(bob, "users/alice", col)));
  });

  test("signed-out visitor has no access", async () => {
    const anon = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, "users/alice/sessions/x")));
    await assertFails(setDoc(doc(anon, "users/alice/sessions/x"), { a: 1 }));
  });

  test("someone who is not a member cannot use even their own data", async () => {
    const carl = env.authenticatedContext("carl").firestore();
    await assertFails(setDoc(doc(carl, "users/carl/sessions/x"), { a: 1 }));
    await assertFails(getDoc(doc(carl, "users/carl/sessions/x")));
  });

  test("nested docs like preferences/current are covered", async () => {
    const alice = env.authenticatedContext("alice").firestore();
    await assertSucceeds(setDoc(doc(alice, "users/alice/preferences/timetable"), { rotationWeeks: 2 }));
    const bob = env.authenticatedContext("bob").firestore();
    await assertFails(getDoc(doc(bob, "users/alice/preferences/timetable")));
  });
});

describe("members: joining with an invite", () => {
  test("invited person joins with the invited role and uses up the invite", async () => {
    await seed("invites/ama@x.test", { email: "ama@x.test", role: "user", invitedBy: OWNER, createdAt: 1 });
    const ama = as("ama", "ama@x.test");
    const b = writeBatch(ama);
    b.set(doc(ama, "members/ama"), { email: "ama@x.test", name: "ama_k", role: "user", joinedAt: 1, username: "ama_k" });
    b.set(doc(ama, "usernames/ama_k"), { uid: "ama", email: "ama@x.test" });
    b.delete(doc(ama, "invites/ama@x.test"));
    await assertSucceeds(b.commit());
    await assertSucceeds(setDoc(doc(ama, "users/ama/sessions/x"), { a: 1 }));
  });

  test("cannot take a higher role than the invite, or join without one", async () => {
    await seed("invites/ama@x.test", { email: "ama@x.test", role: "user", invitedBy: OWNER, createdAt: 1 });
    await assertFails(setDoc(doc(as("ama", "ama@x.test"), "members/ama"), { email: "ama@x.test", name: "a", role: "admin", joinedAt: 1 }));
    await assertFails(setDoc(doc(as("eve", "eve@x.test"), "members/eve"), { email: "eve@x.test", name: "e", role: "user", joinedAt: 1 }));
  });

  test("an unconfirmed email cannot use an invite", async () => {
    await seed("invites/ama@x.test", { email: "ama@x.test", role: "user", invitedBy: OWNER, createdAt: 1 });
    await assertFails(setDoc(doc(as("ama", "ama@x.test", false), "members/ama"), { email: "ama@x.test", name: "a", role: "user", joinedAt: 1 }));
  });

  test("the owner joins as admin without an invite", async () => {
    await assertSucceeds(setDoc(doc(as("own", OWNER), "members/own"), { email: OWNER, name: "o", role: "admin", joinedAt: 1 }));
  });

  test("a username must point to the member who takes it", async () => {
    await seed("invites/ama@x.test", { email: "ama@x.test", role: "user", invitedBy: OWNER, createdAt: 1 });
    const ama = as("ama", "ama@x.test");
    await assertFails(setDoc(doc(ama, "members/ama"), { email: "ama@x.test", name: "a", role: "user", joinedAt: 1, username: "bob" }));
    await assertFails(setDoc(doc(ama, "usernames/zed"), { uid: "ama", email: "ama@x.test" }));
  });
});

describe("members: admins and users", () => {
  beforeEach(async () => {
    await member("own", "admin", OWNER);
    await member("adm", "admin");
    await member("ama");
    await member("bob");
  });

  test("admins list members and invites; users cannot", async () => {
    await assertSucceeds(getDocs(collection(as("adm", "adm@x.test"), "members")));
    await assertSucceeds(setDoc(doc(as("adm", "adm@x.test"), "invites/new@x.test"), { email: "new@x.test", role: "admin", invitedBy: "adm", createdAt: 1 }));
    await assertFails(getDocs(collection(as("ama", "ama@x.test"), "members")));
    await assertFails(getDoc(doc(as("ama", "ama@x.test"), "members/bob")));
    await assertFails(setDoc(doc(as("ama", "ama@x.test"), "invites/new@x.test"), { email: "new@x.test", role: "user", invitedBy: "ama", createdAt: 1 }));
  });

  test("admins change roles and remove people, but never the owner", async () => {
    const adm = as("adm", "adm@x.test");
    await assertSucceeds(updateDoc(doc(adm, "members/ama"), { role: "admin" }));
    await assertSucceeds(deleteDoc(doc(adm, "members/bob")));
    await assertFails(updateDoc(doc(adm, "members/own"), { role: "user" }));
    await assertFails(deleteDoc(doc(adm, "members/own")));
  });

  test("users cannot make themselves admin", async () => {
    await assertFails(updateDoc(doc(as("ama", "ama@x.test"), "members/ama"), { role: "admin" }));
    await assertSucceeds(updateDoc(doc(as("ama", "ama@x.test"), "members/ama"), { name: "Ama" }));
  });

  test("progress: admins read everyone's, users only their own", async () => {
    await seed("progress/bob", { name: "bob" });
    await assertSucceeds(setDoc(doc(as("ama", "ama@x.test"), "progress/ama"), { name: "ama" }));
    await assertFails(getDoc(doc(as("ama", "ama@x.test"), "progress/bob")));
    await assertFails(setDoc(doc(as("ama", "ama@x.test"), "progress/bob"), { name: "x" }));
    await assertSucceeds(getDocs(collection(as("adm", "adm@x.test"), "progress")));
  });

  test("usernames: anyone reads one by name, nobody lists them", async () => {
    await seed("usernames/ama_k", { uid: "ama", email: "ama@x.test" });
    const anon = env.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(anon, "usernames/ama_k")));
    await assertFails(getDocs(collection(anon, "usernames")));
  });
});

describe("calendarTokens", () => {
  test("owner can create, read and delete own token", async () => {
    const alice = env.authenticatedContext("alice").firestore();
    await assertSucceeds(setDoc(doc(alice, "calendarTokens", TOKEN), { uid: "alice", createdAt: 1 }));
    await assertSucceeds(getDoc(doc(alice, "calendarTokens", TOKEN)));
    await assertSucceeds(deleteDoc(doc(alice, "calendarTokens", TOKEN)));
  });

  test("cannot create a token for someone else or with extra fields", async () => {
    const bob = env.authenticatedContext("bob").firestore();
    await assertFails(setDoc(doc(bob, "calendarTokens", TOKEN), { uid: "alice", createdAt: 1 }));
    await assertFails(setDoc(doc(bob, "calendarTokens", TOKEN), { uid: "bob", createdAt: 1, admin: true }));
  });

  test("short tokens are rejected", async () => {
    const alice = env.authenticatedContext("alice").firestore();
    await assertFails(setDoc(doc(alice, "calendarTokens", "short"), { uid: "alice", createdAt: 1 }));
  });

  test("other users cannot read, list or change a token", async () => {
    await env.withSecurityRulesDisabled(async (c) => {
      await setDoc(doc(c.firestore(), "calendarTokens", TOKEN), { uid: "alice", createdAt: 1 });
    });
    const bob = env.authenticatedContext("bob").firestore();
    await assertFails(getDoc(doc(bob, "calendarTokens", TOKEN)));
    await assertFails(getDocs(collection(bob, "calendarTokens")));
    await assertFails(deleteDoc(doc(bob, "calendarTokens", TOKEN)));
    const alice = env.authenticatedContext("alice").firestore();
    await assertFails(setDoc(doc(alice, "calendarTokens", TOKEN), { uid: "alice", createdAt: 2 }));
  });

  test("unknown top-level collections are closed", async () => {
    const alice = env.authenticatedContext("alice").firestore();
    await assertFails(setDoc(doc(alice, "anything/x"), { a: 1 }));
  });
});
