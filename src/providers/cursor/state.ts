import type { BaseJsonlAgentState } from '../shared/state.js';

export interface CursorAgentState extends BaseJsonlAgentState {
  sessionId: string;
}

export function createCursorAgentState(id: number, sessionId: string, jsonlFile: string): CursorAgentState {
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
