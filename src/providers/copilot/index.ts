import * as vscode from 'vscode';
import type { AgentProvider, ProviderContext, NormalizedAgent } from '../types.js';

const PROVIDER_ID = 'copilot';
const DISPLAY_NAME = 'GitHub Copilot';
const SYNTHETIC_AGENT_ID = `${PROVIDER_ID}:default`;

/**
 * Experimental: GitHub Copilot does not expose local transcript or tool events.
 * This provider only detects if the Copilot extension is installed and shows
 * a single placeholder agent (no tool tracking).
 */
export class CopilotProvider implements AgentProvider {
  readonly id = PROVIDER_ID;
  readonly displayName = DISPLAY_NAME;

  private _onAgentCreated = new vscode.EventEmitter<NormalizedAgent>();
  readonly onAgentCreated = this._onAgentCreated.event;
  private _onAgentClosed = new vscode.EventEmitter<{ agentId: string }>();
  readonly onAgentClosed = this._onAgentClosed.event;
  private _onToolStart = new vscode.EventEmitter<{ agentId: string; toolId: string; toolName: string }>();
  readonly onToolStart = this._onToolStart.event;
  private _onToolDone = new vscode.EventEmitter<{ agentId: string; toolId: string }>();
  readonly onToolDone = this._onToolDone.event;
  private _onStatusChange = new vscode.EventEmitter<{ agentId: string; status: 'active' | 'waiting' }>();
  readonly onStatusChange = this._onStatusChange.event;
  private _onPermission = new vscode.EventEmitter<{ agentId: string; needed: boolean }>();
  readonly onPermission = this._onPermission.event;
  private _onSubagentEvent = new vscode.EventEmitter<{
    agentId: string;
    parentToolId: string;
    toolId?: string;
    toolName?: string;
    kind: 'start' | 'done' | 'permission' | 'clear';
  }>();
  readonly onSubagentEvent = this._onSubagentEvent.event;

  private extensionPresent = false;

  async activate(_ctx: ProviderContext): Promise<void> {
    const ext = vscode.extensions.getExtension('github.copilot');
    const extChat = vscode.extensions.getExtension('github.copilot-chat');
    this.extensionPresent = !!(ext || extChat);
    if (this.extensionPresent) {
      this._onAgentCreated.fire({
        id: SYNTHETIC_AGENT_ID,
        providerId: PROVIDER_ID,
        displayName: `${DISPLAY_NAME} (experimental)`,
      });
    }
  }

  deactivate(): void {
    this.extensionPresent = false;
  }

  canLaunch(): boolean {
    return false;
  }

  getActiveAgents(): NormalizedAgent[] {
    if (!this.extensionPresent) return [];
    return [
      {
        id: SYNTHETIC_AGENT_ID,
        providerId: PROVIDER_ID,
        displayName: `${DISPLAY_NAME} (experimental)`,
      },
    ];
  }
}
