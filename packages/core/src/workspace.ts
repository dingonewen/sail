import {
  Workspace,
  LocalFilesystem,
  LocalSandbox,
  detectIsolation,
} from "@mastra/core/workspace";
import { resolve } from "node:path";
import { createRequire } from "node:module";

const _require = createRequire(import.meta.url);

let _workspace: Workspace | null = null;

export function createSailWorkspace(options?: {
  workingDirectory?: string;
  allowNetwork?: boolean;
  timeout?: number;
}): Workspace {
  if (_workspace) return _workspace;

  const cwd = resolve(options?.workingDirectory || process.cwd());

  _workspace = new Workspace({
    filesystem: new LocalFilesystem({
      basePath: cwd,
      contained: false,
    }),
    sandbox: new LocalSandbox({
      workingDirectory: cwd,
      timeout: options?.timeout || 120000,
      isolation: detectBestIsolation(),
      nativeSandbox: {
        allowNetwork: options?.allowNetwork ?? true,
        readWritePaths: [cwd],
      },
    }),
    // BM25 full-text search — enables mastra_workspace_search tool
    bm25: true,
    autoIndexPaths: [cwd],
    // LSP integration — enabled only when runtime packages are available.
    // Install vscode-jsonrpc + vscode-languageserver-protocol to activate.
    lsp: detectLspAvailable(),
    // Skills — SKILL.md files loaded on demand by the agent.
    // Default: bundled skills; override with SAIL_SKILLS_DIR env var.
    skills: [
      process.env.SAIL_SKILLS_DIR || resolve(import.meta.dirname, "..", "skills"),
    ],
    tools: {
      // Approval is handled at the controller level via requireToolApproval,
      // which intercepts dangerous tools BEFORE execution and prompts the user.
      // This avoids double-pause (Mastra tool-level approval + our stream-level check).
    },
  });

  return _workspace;
}

/** Detect if LSP runtime packages are installed */
function detectLspAvailable(): boolean {
  try {
    _require.resolve("vscode-jsonrpc");
    _require.resolve("vscode-languageserver-protocol");
    return true;
  } catch {
    return false;
  }
}

/** Detect best available OS-level isolation backend */
function detectBestIsolation(): "none" | "seatbelt" | "bwrap" {
  try {
    const result = detectIsolation();
    if (result.available) {
      return result.backend as "seatbelt" | "bwrap";
    }
  } catch {
    // detection failed, fall through
  }
  return "none";
}
