import type { BaseJsonlAgentState } from '../shared/state.js';

export interface ClineAgentState extends BaseJsonlAgentState {
  taskId: string;
  /** Path to api_conversation_history.json */
  historyPath: string;
  /** Number of messages we've already processed (for incremental parsing) */
  lastMessageCount: number;
}

export function createClineAgentState(
  id: number,
  taskId: string,
  historyPath: string,
): ClineAgentState {
  return {
    id,
    taskId,
    historyPath,
    jsonlFile: historyPath,
    fileOffset: 0,
    lineBuffer: '',
    lastMessageCount: 0,
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
