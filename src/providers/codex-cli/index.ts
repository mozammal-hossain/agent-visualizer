import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import type { AgentProvider, ProviderContext, NormalizedAgent } from '../types.js';
import type { CodexAgentState } from './state.js';
import { createCodexAgentState } from './state.js';
import { startFileWatching, stopJsonlFileWatching, findRolloutJsonlFiles } from './fileWatcher.js';
import type { PostMessage } from '../shared/timerManager.js';
import { TERMINAL_NAME_PREFIX_CODEX } from '../../constants.js';

const PROVIDER_ID = 'codex-cli';
const DISPLAY_NAME = 'Codex CLI';

function getCodexSessionsDir(): string {
  return path.join(os.homedir(), '.codex', 'sessions');
}

export class CodexCLIProvider implements AgentProvider {
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

  private agents = new Map<number, CodexAgentState>();
  private nextNumericId = 1;
  private fileWatchers = new Map<number, fs.FSWatcher>();
  private pollingTimers = new Map<number, ReturnType<typeof setInterval>>();
  private scanTimer: ReturnType<typeof setInterval> | null = null;
  private knownFiles = new Set<string>();
  private context: ProviderContext | null = null;

  private toProviderAgentId(numericId: number): string {
    const agent = this.agents.get(numericId);
    return agent ? `${PROVIDER_ID}:${agent.sessionFilePath}` : '';
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
    const sessionsDir = getCodexSessionsDir();
    if (!fs.existsSync(sessionsDir)) return;

    const postMessage = this.makePostMessage();

    const adoptFile = (filePath: string) => {
      if (this.knownFiles.has(filePath)) return;
      this.knownFiles.add(filePath);
      const numericId = this.nextNumericId++;
      const agent = createCodexAgentState(numericId, filePath);
      try {
        const stat = fs.statSync(filePath);
        agent.fileOffset = stat.size;
      } catch {
        /* ignore */
      }
      this.agents.set(numericId, agent);
      this._onAgentCreated.fire({
        id: `${PROVIDER_ID}:${filePath}`,
        providerId: PROVIDER_ID,
      });
      startFileWatching(numericId, filePath, this.agents, this.fileWatchers, this.pollingTimers, postMessage);
    };

    const scan = () => {
      const files = findRolloutJsonlFiles(sessionsDir, 4);
      for (const filePath of files) {
        adoptFile(path.resolve(filePath));
      }
    };

    scan();
    this.scanTimer = setInterval(scan, 5000);
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
    return true;
  }

  async launch(folderPath?: string): Promise<void> {
    const workspaceRoot = folderPath || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) return;

    const terminal = vscode.window.createTerminal({
      name: `${TERMINAL_NAME_PREFIX_CODEX}`,
      cwd: folderPath || workspaceRoot,
    });
    terminal.show();
    terminal.sendText('codex');
  }

  getActiveAgents(): NormalizedAgent[] {
    const result: NormalizedAgent[] = [];
    for (const agent of this.agents.values()) {
      result.push({
        id: `${PROVIDER_ID}:${agent.sessionFilePath}`,
        providerId: PROVIDER_ID,
      });
    }
    return result;
  }
}
