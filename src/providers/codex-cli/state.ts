import type { BaseJsonlAgentState } from '../shared/state.js';

export interface CodexAgentState extends BaseJsonlAgentState {
  /** Path to the rollout JSONL file */
  sessionFilePath: string;
}

export function createCodexAgentState(id: number, sessionFilePath: string): CodexAgentState {
  return {
    id,
    jsonlFile: sessionFilePath,
    sessionFilePath,
    fileOffset: 0,
    lineBuffer: '',
    activeToolIds: new Set(),
    activeToolStatuses: new Map(),
    activeToolNames: new Map(),
    activeSubagentToolIds: new Map(),
    activeSubagentToolNames: new Map(),
    isWaiting: false,
    permissionSent: false,
    hadToolsInTurn: false,
  };
}
