import { AgentController } from "@mastra/core/agent-controller";
import { LibSQLStore } from "@mastra/libsql";
import { z } from "zod";
import { codingAgent } from "./agent.js";
import { resolve } from "node:path";
import { homedir } from "node:os";

export function createController(): AgentController {
  const dbPath =
    process.env.SAIL_DB_PATH || resolve(homedir(), ".sail", "sail.db");

  return new AgentController({
    id: "sail",
    agent: codingAgent,
    storage: new LibSQLStore({
      id: "sail-controller",
      url: `file:${dbPath}`,
    }),

    // Persistent state shared across sessions
    stateSchema: z.object({
      currentModelId: z.string().optional(),
      currentProject: z.string().optional(),
    }),

    // Agent modes — different system prompts for different tasks
    modes: [
      {
        id: "chat",
        name: "Chat",
        metadata: { default: true },
        instructions:
          "You are in chat mode. Discuss the codebase, answer questions, and explore ideas. Do not make changes unless explicitly asked.",
      },
      {
        id: "plan",
        name: "Plan",
        instructions:
          "You are in plan mode. Analyze the codebase, design solutions, and write detailed plans. Do NOT modify any files. Write your plan as a structured document.",
        transitionsTo: "build",
      },
      {
        id: "build",
        name: "Build",
        instructions:
          "You are in build mode. Execute the plan — make changes to files, run commands, and implement the solution. Report progress and verify results.",
        transitionsTo: "plan",
      },
    ],
  });
}
