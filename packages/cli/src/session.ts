import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import { getConfigDir } from "./config.js";

export interface SessionMeta {
  /** Unique session ID */
  id: string;
  /** Display name */
  name: string;
  /** Mastra thread ID for memory */
  threadId: string;
  /** Parent session ID for tree branching, null for root */
  parentId: string | null;
  /** Child session IDs */
  children: string[];
  /** Working directory when session was created */
  cwd: string;
  /** Creation timestamp */
  createdAt: string;
  /** Last activity timestamp */
  updatedAt: string;
}

export interface SessionIndex {
  sessions: SessionMeta[];
  lastSessionId: string | null;
}

function getSessionPath(): string {
  const dir = process.env.SAIL_SESSION_DIR || join(getConfigDir(), "sessions");
  return resolve(dir, "session-index.json");
}

function loadIndex(): SessionIndex {
  const path = getSessionPath();
  if (!existsSync(path)) {
    return { sessions: [], lastSessionId: null };
  }
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return { sessions: [], lastSessionId: null };
  }
}

function saveIndex(index: SessionIndex): void {
  const path = getSessionPath();
  const dir = resolve(path, "..");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(path, JSON.stringify(index, null, 2), "utf-8");
}

/** Create a new session */
export function createSession(name?: string): SessionMeta {
  const index = loadIndex();
  const session: SessionMeta = {
    id: randomUUID(),
    name: name || "Untitled",
    threadId: randomUUID(),
    parentId: null,
    children: [],
    cwd: process.cwd(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  index.sessions.push(session);
  index.lastSessionId = session.id;
  saveIndex(index);

  return session;
}

/** Fork a session from an existing one (tree branching) */
export function forkSession(parentId: string, name?: string): SessionMeta | null {
  const index = loadIndex();
  const parent = index.sessions.find((s) => s.id === parentId);
  if (!parent) return null;

  const session: SessionMeta = {
    id: randomUUID(),
    name: name || `${parent.name} (fork)`,
    threadId: randomUUID(), // New thread starts fresh from fork point
    parentId: parent.id,
    children: [],
    cwd: parent.cwd,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  parent.children.push(session.id);
  index.sessions.push(session);
  index.lastSessionId = session.id;
  saveIndex(index);

  return session;
}

/** Get the most recent session */
export function getLastSession(): SessionMeta | null {
  const index = loadIndex();
  if (!index.lastSessionId) return null;
  return index.sessions.find((s) => s.id === index.lastSessionId) || null;
}

/** Get a session by exact or partial UUID */
export function getSession(idOrPartial: string): SessionMeta | null {
  const index = loadIndex();
  return (
    index.sessions.find(
      (s) => s.id === idOrPartial || s.id.startsWith(idOrPartial)
    ) || null
  );
}

/** List all sessions, most recent first */
export function listSessions(): SessionMeta[] {
  const index = loadIndex();
  return [...index.sessions].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

/** Update a session's last activity timestamp */
export function touchSession(sessionId: string): void {
  const index = loadIndex();
  const session = index.sessions.find((s) => s.id === sessionId);
  if (session) {
    session.updatedAt = new Date().toISOString();
    index.lastSessionId = sessionId;
    saveIndex(index);
  }
}

/** Get the session tree for display */
export function getSessionTree(): SessionMeta[] {
  const index = loadIndex();
  // Return root sessions (no parent), children are nested
  return index.sessions.filter((s) => !s.parentId);
}
