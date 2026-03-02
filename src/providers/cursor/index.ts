import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import type { AgentProvider, ProviderContext, NormalizedAgent } from '../types.js';
import type { CursorAgentState } from './state.js';
import { createCursorAgentState } from './state.js';
import { startFileWatching, stopJsonlFileWatching } from './fileWatcher.js';
import type { PostMessage } from '../shared/timerManager.js';

const PROVIDER_ID = 'cursor';
const DISPLAY_NAME = 'Cursor';

function getCursorTranscriptsDir(workspaceRoot: string): string {
  const slug = workspaceRoot.replace(/[^a-zA-Z0-9-]/g, '-');
  return path.join(os.homedir(), '.cursor', 'projects', slug, 'agent-transcripts');
}

export class CursorProvider implements AgentProvider {
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

  private agents = new Map<number, CursorAgentState>();
  private sessionIdToNumericId = new Map<string, number>();
  private nextNumericId = 1;
  private watcher: fs.FSWatcher | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private fileWatchers = new Map<number, fs.FSWatcher>();
  private pollingTimers = new Map<number, ReturnType<typeof setInterval>>();
  private waitingTimers = new Map<number, ReturnType<typeof setTimeout>>();
  private permissionTimers = new Map<number, ReturnType<typeof setTimeout>>();
  private context: ProviderContext | null = null;

  private toProviderAgentId(numericId: number): string {
    const agent = this.agents.get(numericId);
    return agent ? `${PROVIDER_ID}:${agent.sessionId}` : '';
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
        case 'subagentToolPermission':
          this._onSubagentEvent.fire({
            agentId,
            parentToolId: msg.parentToolId as string,
            kind: 'permission',
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
    const workspaceRoot = ctx.workspaceRoot;
    if (!workspaceRoot) return;

    const transcriptsDir = getCursorTranscriptsDir(workspaceRoot);
    if (!fs.existsSync(transcriptsDir)) return;

    const postMessage = this.makePostMessage();

    const scan = () => {
      try {
        const dirs = fs.readdirSync(transcriptsDir, { withFileTypes: true });
        for (const d of dirs) {
          if (!d.isDirectory()) continue;
          const sessionId = d.name;
          const jsonlPath = path.join(transcriptsDir, sessionId, `${sessionId}.jsonl`);
          if (fs.existsSync(jsonlPath) && !this.sessionIdToNumericId.has(sessionId)) {
            const numericId = this.nextNumericId++;
            const agent = createCursorAgentState(numericId, sessionId, jsonlPath);
            try {
              const stat = fs.statSync(jsonlPath);
              agent.fileOffset = stat.size;
            } catch {
              /* ignore */
            }
            this.agents.set(numericId, agent);
            this.sessionIdToNumericId.set(sessionId, numericId);
            this._onAgentCreated.fire({
              id: `${PROVIDER_ID}:${sessionId}`,
              providerId: PROVIDER_ID,
            });
            startFileWatching(
              numericId,
              jsonlPath,
              this.agents,
              this.fileWatchers,
              this.pollingTimers,
              this.waitingTimers,
              this.permissionTimers,
              postMessage,
            );
          }
        }
      } catch {
        /* ignore */
      }
    };

    scan();
    this.watcher = fs.watch(transcriptsDir, () => scan());
    this.pollTimer = setInterval(scan, 2000);
  }

  deactivate(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    for (const [numericId, agent] of this.agents) {
      stopJsonlFileWatching(numericId, agent.jsonlFile, this.fileWatchers, this.pollingTimers);
    }
    this.agents.clear();
    this.sessionIdToNumericId.clear();
    this.context = null;
  }

  canLaunch(): boolean {
    return false;
  }

  getActiveAgents(): NormalizedAgent[] {
    const result: NormalizedAgent[] = [];
    for (const agent of this.agents.values()) {
      result.push({
        id: `${PROVIDER_ID}:${agent.sessionId}`,
        providerId: PROVIDER_ID,
      });
    }
    return result;
  }
}
