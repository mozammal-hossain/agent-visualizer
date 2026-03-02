import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import type { AgentProvider, ProviderContext, NormalizedAgent } from '../types.js';
import type { ContinueAgentState } from './state.js';
import { createContinueAgentState } from './state.js';
import { startFileWatching, stopJsonlFileWatching, findContinueSessionFiles } from './fileWatcher.js';
import type { PostMessage } from '../shared/timerManager.js';

const PROVIDER_ID = 'continue';
const DISPLAY_NAME = 'Continue.dev';

function getContinueSessionsDir(): string {
  return path.join(os.homedir(), '.continue', 'sessions');
}

export class ContinueProvider implements AgentProvider {
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

  private agents = new Map<number, ContinueAgentState>();
  private nextNumericId = 1;
  private fileWatchers = new Map<number, fs.FSWatcher>();
  private pollingTimers = new Map<number, ReturnType<typeof setInterval>>();
  private scanTimer: ReturnType<typeof setInterval> | null = null;
  private knownFiles = new Set<string>();
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
    const sessionsDir = getContinueSessionsDir();
    if (!fs.existsSync(sessionsDir)) return;

    const postMessage = this.makePostMessage();

    const adoptFile = (filePath: string) => {
      const normalized = path.resolve(filePath);
      if (this.knownFiles.has(normalized)) return;
      this.knownFiles.add(normalized);
      const sessionId = path.basename(normalized, path.extname(normalized));
      const numericId = this.nextNumericId++;
      const agent = createContinueAgentState(numericId, sessionId, normalized);
      try {
        const stat = fs.statSync(normalized);
        agent.fileOffset = stat.size;
      } catch {
        /* ignore */
      }
      this.agents.set(numericId, agent);
      this._onAgentCreated.fire({
        id: `${PROVIDER_ID}:${sessionId}`,
        providerId: PROVIDER_ID,
      });
      startFileWatching(numericId, normalized, this.agents, this.fileWatchers, this.pollingTimers, postMessage);
    };

    const scan = () => {
      const files = findContinueSessionFiles(sessionsDir, 3);
      for (const filePath of files) {
        adoptFile(filePath);
      }
    };

    scan();
    this.scanTimer = setInterval(scan, 6000);
  }

  deactivate(): void {
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
    }
    for (const [numericId, agent] of this.agents) {
      stopJsonlFileWatching(numericId, agent.jsonlFile, this.fileWatchers, this.pollingTimers);
    }
    this.agents.clear();
    this.knownFiles.clear();
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
