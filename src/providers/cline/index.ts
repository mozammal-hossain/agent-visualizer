import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import type { AgentProvider, ProviderContext, NormalizedAgent } from '../types.js';
import type { ClineAgentState } from './state.js';
import { createClineAgentState } from './state.js';
import { processNewMessages } from './transcriptParser.js';
import type { PostMessage } from '../shared/timerManager.js';
import { getClineTasksDir, CLINE_HISTORY_FILENAME } from './pathResolver.js';

const PROVIDER_ID = 'cline';
const DISPLAY_NAME = 'Cline';

const POLL_INTERVAL_MS = 3000;

export class ClineProvider implements AgentProvider {
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

  private agents = new Map<number, ClineAgentState>();
  private nextNumericId = 1;
  private waitingTimers = new Map<number, ReturnType<typeof setTimeout>>();
  private permissionTimers = new Map<number, ReturnType<typeof setTimeout>>();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private context: ProviderContext | null = null;

  private toProviderAgentId(numericId: number): string {
    const agent = this.agents.get(numericId);
    return agent ? `${PROVIDER_ID}:${agent.taskId}` : '';
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
        case 'agentToolPermission':
          this._onPermission.fire({ agentId, needed: true });
          break;
        case 'agentToolPermissionClear':
          this._onPermission.fire({ agentId, needed: false });
          break;
        case 'subagentToolStart':
          this._onSubagentEvent.fire({
            agentId,
            parentToolId: msg.parentToolId as string,
            toolId: msg.toolId as string,
            toolName: msg.status as string,
            kind: 'start',
          });
          break;
        case 'subagentToolDone':
          this._onSubagentEvent.fire({
            agentId,
            parentToolId: msg.parentToolId as string,
            toolId: msg.toolId as string,
            kind: 'done',
          });
          break;
        case 'subagentClear':
          this._onSubagentEvent.fire({
            agentId,
            parentToolId: msg.parentToolId as string,
            kind: 'clear',
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
    const tasksDir = getClineTasksDir();
    if (!fs.existsSync(tasksDir)) return;

    const postMessage = this.makePostMessage();

    const processTaskFolder = (taskId: string) => {
      const historyPath = path.join(tasksDir, taskId, CLINE_HISTORY_FILENAME);
      if (!fs.existsSync(historyPath)) return;

      const existing = [...this.agents.values()].find((a) => a.taskId === taskId);
      if (existing) {
        readHistoryFile(existing.id, existing.historyPath, this.agents, this.waitingTimers, this.permissionTimers, postMessage);
        return;
      }

      const numericId = this.nextNumericId++;
      const agent = createClineAgentState(numericId, taskId, historyPath);
      this.agents.set(numericId, agent);
      this._onAgentCreated.fire({
        id: `${PROVIDER_ID}:${taskId}`,
        providerId: PROVIDER_ID,
      });
      readHistoryFile(numericId, historyPath, this.agents, this.waitingTimers, this.permissionTimers, postMessage);
    };

    const readHistoryFile = (
      agentId: number,
      historyPath: string,
      agents: Map<number, ClineAgentState>,
      waitingTimers: Map<number, ReturnType<typeof setTimeout>>,
      permissionTimers: Map<number, ReturnType<typeof setTimeout>>,
      postMessage: PostMessage,
    ) => {
      const agent = agents.get(agentId);
      if (!agent) return;
      try {
        const raw = fs.readFileSync(historyPath, 'utf-8');
        const data = JSON.parse(raw) as { messages?: Array<{ role?: string; content?: unknown }> };
        const messages = Array.isArray(data.messages) ? data.messages : [];
        if (messages.length <= agent.lastMessageCount) return;
        const newMessages = messages.slice(agent.lastMessageCount);
        agent.lastMessageCount = messages.length;
        processNewMessages(agentId, newMessages, agents, waitingTimers, permissionTimers, postMessage);
      } catch {
        /* ignore parse/read errors */
      }
    };

    const scan = () => {
      try {
        const taskIds = fs.readdirSync(tasksDir, { withFileTypes: true })
          .filter((d) => d.isDirectory())
          .map((d) => d.name);
        for (const taskId of taskIds) {
          processTaskFolder(taskId);
        }
      } catch {
        /* ignore */
      }
    };

    scan();
    this.pollTimer = setInterval(scan, POLL_INTERVAL_MS);
  }

  deactivate(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    for (const id of this.agents.keys()) {
      const wt = this.waitingTimers.get(id);
      if (wt) clearTimeout(wt);
      const pt = this.permissionTimers.get(id);
      if (pt) clearTimeout(pt);
    }
    this.waitingTimers.clear();
    this.permissionTimers.clear();
    this.agents.clear();
    this.context = null;
  }

  canLaunch(): boolean {
    return false;
  }

  getActiveAgents(): NormalizedAgent[] {
    const result: NormalizedAgent[] = [];
    for (const agent of this.agents.values()) {
      result.push({
        id: `${PROVIDER_ID}:${agent.taskId}`,
        providerId: PROVIDER_ID,
      });
    }
    return result;
  }
}
