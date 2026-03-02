import type { Event } from 'vscode';

/**
 * Normalized agent representation from any provider.
 */
export interface NormalizedAgent {
  id: string;
  providerId: string;
  displayName?: string;
  folderName?: string;
  terminalName?: string;
}

/**
 * Context passed to each provider on activate.
 */
export interface ProviderContext {
  extensionPath: string;
  workspaceRoot: string | undefined;
  globalState: import('vscode').Memento;
  workspaceState: import('vscode').Memento;
}

export type ToolStartPayload = {
  agentId: string;
  toolId: string;
  toolName: string;
};

export type ToolDonePayload = {
  agentId: string;
  toolId: string;
};

export type StatusChangePayload = {
  agentId: string;
  status: 'active' | 'waiting';
};

export type PermissionPayload = {
  agentId: string;
  needed: boolean;
};

export type SubagentEventPayload = {
  agentId: string;
  parentToolId: string;
  toolId?: string;
  toolName?: string;
  kind: 'start' | 'done' | 'permission' | 'clear';
};

/**
 * Agent provider interface. Each LLM (Claude Code, Cursor, etc.) implements this.
 */
export interface AgentProvider {
  readonly id: string;
  readonly displayName: string;

  activate(context: ProviderContext): Promise<void>;
  deactivate(): void;

  canLaunch(): boolean;
  launch?(folderPath?: string): Promise<void>;
  focusAgent?(providerAgentId: string): void;
  closeAgent?(providerAgentId: string): void;
  getActiveAgents?(): NormalizedAgent[];

  readonly onAgentCreated: Event<NormalizedAgent>;
  readonly onAgentClosed: Event<{ agentId: string }>;
  readonly onToolStart: Event<ToolStartPayload>;
  readonly onToolDone: Event<ToolDonePayload>;
  readonly onStatusChange: Event<StatusChangePayload>;
  readonly onPermission: Event<PermissionPayload>;
  readonly onSubagentEvent: Event<SubagentEventPayload>;
}
