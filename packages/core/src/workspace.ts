import {
  Workspace,
  LocalFilesystem,
  LocalSandbox,
  WORKSPACE_TOOLS,
  detectIsolation,
} from "@mastra/core/workspace";
import { resolve } from "node:path";

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
    tools: {
      // Dangerous tools require user approval
      [WORKSPACE_TOOLS.FILESYSTEM.WRITE_FILE]: { requireApproval: true },
      [WORKSPACE_TOOLS.FILESYSTEM.EDIT_FILE]: { requireApproval: true },
      [WORKSPACE_TOOLS.FILESYSTEM.DELETE]: { requireApproval: true },
      [WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND]: { requireApproval: true },
    },
  });

  return _workspace;
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
