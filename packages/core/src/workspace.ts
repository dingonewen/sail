import {
  Workspace,
  LocalFilesystem,
  LocalSandbox,
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
      // Approval is handled at the controller level via requireToolApproval,
      // which intercepts dangerous tools BEFORE execution and prompts the user.
      // This avoids double-pause (Mastra tool-level approval + our stream-level check).
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
