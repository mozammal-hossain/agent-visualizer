import type * as vscode from 'vscode';

export interface ClaudeAgentState {
  id: number;
  terminalRef: vscode.Terminal;
  projectDir: string;
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
  folderName?: string;
}

export interface PersistedClaudeAgent {
  id: number;
  terminalName: string;
  jsonlFile: string;
  projectDir: string;
  folderName?: string;
}
