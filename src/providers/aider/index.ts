import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import type { AgentProvider, ProviderContext, NormalizedAgent } from '../types.js';
import type { AiderAgentState } from './state.js';
import { createAiderAgentState } from './state.js';
import { processHistoryFile } from './transcriptParser.js';
import type { PostMessage } from '../shared/timerManager.js';

const PROVIDER_ID = 'aider';
const DISPLAY_NAME = 'Aider';

const AIDER_HISTORY_FILENAME = '.aider.chat.history.md';
const POLL_INTERVAL_MS = 2000;

export class AiderProvider implements AgentProvider {
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

  private agents = new Map<number, AiderAgentState>();
  private nextNumericId = 1;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private context: ProviderContext | null = null;

  private toProviderAgentId(numericId: number): string {
    const agent = this.agents.get(numericId);
    return agent ? `${PROVIDER_ID}:${agent.historyPath}` : '';
  }

  private makePostMessage(): PostMessage {
    return (msg: Record<string, unknown>) => {
      const id = msg.id as number;
      const agentId = this.toProviderAgentId(id);
      if (!agentId) return;
      switch (msg.type) {
        case 'agentToolStart':
          this._onToolStart.fire({
            agentId,
            toolId: msg.toolId as string,
            toolName: msg.status as string,
          });
          break;
        case 'agentToolDone':
          this._onToolDone.fire({ agentId, toolId: msg.toolId as string });
          break;
        case 'agentStatus':
          this._onStatusChange.fire({
            agentId,
            status: msg.status as 'active' | 'waiting',
          });
          break;
        case 'agentToolsClear':
          this._onStatusChange.fire({ agentId, status: 'waiting' });
          break;
        default:
          break;
      }
    };
  }

  async activate(ctx: ProviderContext): Promise<void> {
    this.context = ctx;
    const workspaceRoot = ctx.workspaceRoot;
    if (!workspaceRoot) return;

    const historyPath = path.join(workspaceRoot, AIDER_HISTORY_FILENAME);
    if (!fs.existsSync(historyPath)) return;

    const postMessage = this.makePostMessage();
    const numericId = this.nextNumericId++;
    const agent = createAiderAgentState(numericId, historyPath);
    try {
      const stat = fs.statSync(historyPath);
      agent.lastSize = stat.size;
    } catch {
      /* ignore */
    }
    this.agents.set(numericId, agent);
    this._onAgentCreated.fire({
      id: `${PROVIDER_ID}:${historyPath}`,
      providerId: PROVIDER_ID,
    });

    const poll = () => {
      for (const [id, a] of this.agents) {
        try {
          if (!fs.existsSync(a.historyPath)) continue;
          const stat = fs.statSync(a.historyPath);
          if (stat.size === a.lastSize) {
            processHistoryFile(id, '', a, postMessage);
            continue;
          }
          a.lastSize = stat.size;
          const content = fs.readFileSync(a.historyPath, 'utf-8');
          processHistoryFile(id, content, a, postMessage);
        } catch {
          /* ignore */
        }
      }
    };

    this.pollTimer = setInterval(poll, POLL_INTERVAL_MS);
    poll();
  }

  deactivate(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.agents.clear();
    this.context = null;
  }

  canLaunch(): boolean {
    return true;
  }

  async launch(folderPath?: string): Promise<void> {
    const workspaceRoot = folderPath || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) return;

    const terminal = vscode.window.createTerminal({
      name: DISPLAY_NAME,
      cwd: folderPath || workspaceRoot,
    });
    terminal.show();
    terminal.sendText('aider');
  }

  getActiveAgents(): NormalizedAgent[] {
    const result: NormalizedAgent[] = [];
    for (const agent of this.agents.values()) {
      result.push({
        id: `${PROVIDER_ID}:${agent.historyPath}`,
        providerId: PROVIDER_ID,
      });
    }
    return result;
  }
}
