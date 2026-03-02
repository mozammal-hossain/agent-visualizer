/**
 * Base agent state for JSONL-based providers (Claude Code, Cursor, Cline, etc.)
 * that use Anthropic-style message format with tool_use / tool_result blocks.
 */
export interface BaseJsonlAgentState {
  id: number;
  jsonlFile: string;
  fileOffset: number;
  lineBuffer: string;
  activeToolIds: Set<string>;
  activeToolStatuses: Map<string, string>;
  activeToolNames: Map<string, string>;
  activeSubagentToolIds: Map<string, Set<string>>;
  activeSubagentToolNames: Map<string, Map<string, string>>;
  isWaiting: boolean;
  permissionSent: boolean;
  hadToolsInTurn: boolean;
}

export function createBaseJsonlAgentFields(): Omit<BaseJsonlAgentState, 'id' | 'jsonlFile'> {
  return {
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
