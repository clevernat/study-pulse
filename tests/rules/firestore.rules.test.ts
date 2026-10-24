import { readFileSync } from "fs";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs } from "firebase/firestore";

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

describe("users/{uid}/**", () => {
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

  test("nested docs like preferences/current are covered", async () => {
    const alice = env.authenticatedContext("alice").firestore();
    await assertSucceeds(setDoc(doc(alice, "users/alice/preferences/timetable"), { rotationWeeks: 2 }));
    const bob = env.authenticatedContext("bob").firestore();
    await assertFails(getDoc(doc(bob, "users/alice/preferences/timetable")));
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
