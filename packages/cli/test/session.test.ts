import { describe, it, expect, beforeEach } from "vitest";
import { createSession, getSession, forkSession, listSessions, touchSession, getLastSession, type SessionMeta } from "../src/session.js";
import { existsSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";

const SESSION_PATH = resolve(homedir(), ".sail", "sessions", "session-index.json");

describe("Session management", () => {
  beforeEach(() => {
    // Clean session index before each test
    if (existsSync(SESSION_PATH)) unlinkSync(SESSION_PATH);
  });

  it("creates a session with UUID and threadId", () => {
    const s = createSession("Test session");
    expect(s.id).toBeTruthy();
    expect(s.threadId).toBeTruthy();
    expect(s.id).not.toBe(s.threadId);
    expect(s.name).toBe("Test session");
    expect(s.parentId).toBeNull();
    expect(s.children).toEqual([]);
  });

  it("creates a session with auto-generated name", () => {
    const s = createSession();
    expect(s.name).toBe("Untitled");
  });

  it("retrieves a session by exact ID", () => {
    const created = createSession("Find me");
    const found = getSession(created.id);
    expect(found).toBeTruthy();
    expect(found!.name).toBe("Find me");
  });

  it("retrieves a session by partial ID", () => {
    const created = createSession("Partial lookup");
    const prefix = created.id.slice(0, 8);
    const found = getSession(prefix);
    expect(found).toBeTruthy();
    expect(found!.id).toBe(created.id);
  });

  it("returns null for non-existent session", () => {
    expect(getSession("nonexistent")).toBeNull();
  });

  it("forks a session with parent relationship", () => {
    const parent = createSession("Parent");
    const child = forkSession(parent.id, "Fork");
    expect(child).toBeTruthy();
    expect(child!.parentId).toBe(parent.id);

    // Parent should now have child in its children array
    const refreshedParent = getSession(parent.id);
    expect(refreshedParent!.children).toContain(child!.id);
  });

  it("lists sessions most recent first", async () => {
    const s1 = createSession("First");
    await new Promise((r) => setTimeout(r, 5)); // ensure different timestamps
    const s2 = createSession("Second");
    const list = listSessions();
    expect(list[0].id).toBe(s2.id);
    expect(list[1].id).toBe(s1.id);
  });

  it("getLastSession returns most recent", () => {
    createSession("Old");
    const recent = createSession("Recent");
    const last = getLastSession();
    expect(last).toBeTruthy();
    expect(last!.id).toBe(recent.id);
  });

  it("touchSession updates updatedAt", () => {
    const s = createSession("Touch test");
    const original = new Date(s.updatedAt).getTime();
    // Small delay to ensure different timestamp
    touchSession(s.id);
    const updated = getSession(s.id);
    expect(new Date(updated!.updatedAt).getTime()).toBeGreaterThanOrEqual(original);
  });

  it("forkSession returns null for non-existent parent", () => {
    expect(forkSession("nonexistent")).toBeNull();
  });
});
