import type { BaseJsonlAgentState } from '../shared/state.js';

export interface ContinueAgentState extends BaseJsonlAgentState {
  sessionId: string;
}

export function createContinueAgentState(id: number, sessionId: string, jsonlFile: string): ContinueAgentState {
  return {
    id,
    sessionId,
    jsonlFile,
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
