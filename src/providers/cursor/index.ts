import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import type { AgentProvider, ProviderContext, NormalizedAgent } from '../types.js';

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

  private knownSessions = new Set<string>();
  private watcher: fs.FSWatcher | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private context: ProviderContext | null = null;

  async activate(ctx: ProviderContext): Promise<void> {
    this.context = ctx;
    const workspaceRoot = ctx.workspaceRoot;
    if (!workspaceRoot) return;

    const transcriptsDir = getCursorTranscriptsDir(workspaceRoot);
    if (!fs.existsSync(transcriptsDir)) return;

    const scan = () => {
      try {
        const dirs = fs.readdirSync(transcriptsDir, { withFileTypes: true });
        for (const d of dirs) {
          if (!d.isDirectory()) continue;
          const sessionId = d.name;
          const jsonlPath = path.join(transcriptsDir, sessionId, `${sessionId}.jsonl`);
          if (fs.existsSync(jsonlPath) && !this.knownSessions.has(sessionId)) {
            this.knownSessions.add(sessionId);
            const agentId = `${PROVIDER_ID}:${sessionId}`;
            this._onAgentCreated.fire({
              id: agentId,
              providerId: PROVIDER_ID,
            });
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
    this.knownSessions.clear();
    this.context = null;
  }

  canLaunch(): boolean {
    return false;
  }

  getActiveAgents(): NormalizedAgent[] {
    return [...this.knownSessions].map((sessionId) => ({
      id: `${PROVIDER_ID}:${sessionId}`,
      providerId: PROVIDER_ID,
    }));
  }
}
