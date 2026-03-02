import type * as vscode from 'vscode';
import type { BaseJsonlAgentState } from '../shared/state.js';

export interface ClaudeAgentState extends BaseJsonlAgentState {
  terminalRef: vscode.Terminal;
  projectDir: string;
  folderName?: string;
}

export interface PersistedClaudeAgent {
  id: number;
  terminalName: string;
  jsonlFile: string;
  projectDir: string;
  folderName?: string;
}
