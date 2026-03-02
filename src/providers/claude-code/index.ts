import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import type { AgentProvider, ProviderContext, NormalizedAgent } from '../types.js';
import type { ClaudeAgentState, PersistedClaudeAgent } from './state.js';
import { startFileWatching, readNewLines, ensureProjectScan, reassignAgentToFile } from './fileWatcher.js';
import { stopJsonlFileWatching } from '../shared/fileWatcher.js';
import type { PostMessage } from '../shared/timerManager.js';
import { cancelWaitingTimer, cancelPermissionTimer } from '../shared/timerManager.js';
import { WORKSPACE_KEY_AGENTS } from '../../constants.js';
import { TERMINAL_NAME_PREFIX_CLAUDE } from '../../constants.js';
import { JSONL_POLL_INTERVAL_MS } from '../../constants.js';

const PROVIDER_ID = 'claude-code';
const DISPLAY_NAME = 'Claude Code';

function getProjectDirPath(workspacePath: string): string {
  const dirName = workspacePath.replace(/[^a-zA-Z0-9-]/g, '-');
  return path.join(os.homedir(), '.claude', 'projects', dirName);
}

export class ClaudeCodeProvider implements AgentProvider {
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

  private agents = new Map<number, ClaudeAgentState>();
  private nextAgentId = 1;
  private nextTerminalIndex = 1;
  private context: ProviderContext | null = null;

  private fileWatchers = new Map<number, fs.FSWatcher>();
  private pollingTimers = new Map<number, ReturnType<typeof setInterval>>();
  private waitingTimers = new Map<number, ReturnType<typeof setTimeout>>();
  private permissionTimers = new Map<number, ReturnType<typeof setTimeout>>();
  private jsonlPollTimers = new Map<number, ReturnType<typeof setInterval>>();
  private projectScanTimerRef = { current: null as ReturnType<typeof setInterval> | null };
  private activeAgentIdRef = { current: null as number | null };
  private nextAgentIdRef = { current: 1 };
  private knownJsonlFiles = new Set<string>();

  private toProviderAgentId(numericId: number): string {
    return `${PROVIDER_ID}:${numericId}`;
  }

  private makePostMessage(): PostMessage {
    return (msg: Record<string, unknown>) => {
      const id = msg.id as number;
      const agentId = this.toProviderAgentId(id);
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
    const postMessage = this.makePostMessage();

    const persisted = ctx.workspaceState.get<Array<PersistedClaudeAgent & { providerId?: string }>>(WORKSPACE_KEY_AGENTS, []);
    const claudeAgents = persisted.filter((p) => p.providerId === PROVIDER_ID || p.providerId === undefined) as PersistedClaudeAgent[];
    const liveTerminals = vscode.window.terminals;

    for (const p of claudeAgents) {
      const terminal = liveTerminals.find((t) => t.name === p.terminalName);
      if (!terminal) continue;

      const agent: ClaudeAgentState = {
        id: p.id,
        terminalRef: terminal,
        projectDir: p.projectDir,
        jsonlFile: p.jsonlFile,
        fileOffset: 0,
        lineBuffer: '',
        activeToolIds: new Set(),
        activeToolStatuses: new Map(),
        activeToolNames: new Map(),
        activeSubagentToolIds: new Map(),
        activeSubagentToolNames: new Map(),
        isWaiting: false,
        permissionSent: false,
        hadToolsInTurn: false,
        folderName: p.folderName,
      };
      this.agents.set(p.id, agent);
      this.knownJsonlFiles.add(p.jsonlFile);
      if (p.id >= this.nextAgentIdRef.current) this.nextAgentIdRef.current = p.id + 1;

      this._onAgentCreated.fire({
        id: this.toProviderAgentId(p.id),
        providerId: PROVIDER_ID,
        folderName: p.folderName,
      });

      try {
        if (fs.existsSync(p.jsonlFile)) {
          const stat = fs.statSync(p.jsonlFile);
          agent.fileOffset = stat.size;
          startFileWatching(p.id, p.jsonlFile, this.agents, this.fileWatchers, this.pollingTimers, this.waitingTimers, this.permissionTimers, postMessage);
        } else {
          const pollTimer = setInterval(() => {
            if (fs.existsSync(agent.jsonlFile)) {
              clearInterval(pollTimer);
              this.jsonlPollTimers.delete(p.id);
              const stat = fs.statSync(agent.jsonlFile);
              agent.fileOffset = stat.size;
              startFileWatching(p.id, agent.jsonlFile, this.agents, this.fileWatchers, this.pollingTimers, this.waitingTimers, this.permissionTimers, postMessage);
              readNewLines(p.id, this.agents, this.waitingTimers, this.permissionTimers, postMessage);
            }
          }, JSONL_POLL_INTERVAL_MS);
          this.jsonlPollTimers.set(p.id, pollTimer);
        }
      } catch {
        /* ignore */
      }
    }

    this.nextAgentIdRef.current = Math.max(this.nextAgentIdRef.current, this.nextAgentId);

    const projectDir = ctx.workspaceRoot ? getProjectDirPath(ctx.workspaceRoot) : null;
    if (projectDir) {
      ensureProjectScan(
        projectDir,
        this.knownJsonlFiles,
        this.projectScanTimerRef,
        this.activeAgentIdRef,
        this.nextAgentIdRef,
        this.agents,
        this.fileWatchers,
        this.pollingTimers,
        this.waitingTimers,
        this.permissionTimers,
        postMessage,
        (id, agent) => {
          this._onAgentCreated.fire({
            id: this.toProviderAgentId(id),
            providerId: PROVIDER_ID,
            folderName: agent.folderName,
          });
        },
        (agentId, newFilePath) => {
          reassignAgentToFile(agentId, newFilePath, this.agents, this.fileWatchers, this.pollingTimers, this.waitingTimers, this.permissionTimers, postMessage);
        },
      );
    }

    vscode.window.onDidChangeActiveTerminal((terminal) => {
      this.activeAgentIdRef.current = null;
      if (!terminal) return;
      for (const [id, agent] of this.agents) {
        if (agent.terminalRef === terminal) {
          this.activeAgentIdRef.current = id;
          break;
        }
      }
    });

    vscode.window.onDidCloseTerminal((closed) => {
      for (const [id, agent] of this.agents) {
        if (agent.terminalRef === closed) {
          if (this.activeAgentIdRef.current === id) this.activeAgentIdRef.current = null;
          this.removeAgent(id);
          this._onAgentClosed.fire({ agentId: this.toProviderAgentId(id) });
          break;
        }
      }
    });
  }

  deactivate(): void {
    if (this.projectScanTimerRef.current) {
      clearInterval(this.projectScanTimerRef.current);
      this.projectScanTimerRef.current = null;
    }
    for (const id of [...this.agents.keys()]) {
      this.removeAgent(id);
    }
    this.context = null;
  }

  private removeAgent(agentId: number): void {
    const jp = this.jsonlPollTimers.get(agentId);
    if (jp) {
      clearInterval(jp);
      this.jsonlPollTimers.delete(agentId);
    }
    const agent = this.agents.get(agentId);
    if (agent) {
      stopJsonlFileWatching(agentId, agent.jsonlFile, this.fileWatchers, this.pollingTimers);
    }
    cancelWaitingTimer(agentId, this.waitingTimers);
    cancelPermissionTimer(agentId, this.permissionTimers);
    this.agents.delete(agentId);
    this.persistAgents();
  }

  private persistAgents(): void {
    const ctx = this.context;
    if (!ctx) return;
    const all = ctx.workspaceState.get<Array<PersistedClaudeAgent & { providerId?: string }>>(WORKSPACE_KEY_AGENTS, []);
    const others = all.filter((a) => a.providerId !== undefined && a.providerId !== PROVIDER_ID);
    const ours: Array<PersistedClaudeAgent & { providerId: string }> = [];
    for (const agent of this.agents.values()) {
      ours.push({
        id: agent.id,
        terminalName: agent.terminalRef.name,
        jsonlFile: agent.jsonlFile,
        projectDir: agent.projectDir,
        folderName: agent.folderName,
        providerId: PROVIDER_ID,
      });
    }
    ctx.workspaceState.update(WORKSPACE_KEY_AGENTS, [...others, ...ours]);
  }

  canLaunch(): boolean {
    return true;
  }

  async launch(folderPath?: string): Promise<void> {
    const ctx = this.context;
    if (!ctx) return;
    const workspaceRoot = folderPath || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) return;

    const projectDir = getProjectDirPath(workspaceRoot);
    const idx = this.nextTerminalIndex++;
    const terminal = vscode.window.createTerminal({
      name: `${TERMINAL_NAME_PREFIX_CLAUDE} #${idx}`,
      cwd: folderPath || workspaceRoot,
    });
    terminal.show();

    const sessionId = crypto.randomUUID();
    terminal.sendText(`claude --session-id ${sessionId}`);

    const expectedFile = path.join(projectDir, `${sessionId}.jsonl`);
    this.knownJsonlFiles.add(expectedFile);

    const id = this.nextAgentId++;
    const isMultiRoot = (vscode.workspace.workspaceFolders?.length ?? 0) > 1;
    const folderName = isMultiRoot && folderPath ? path.basename(folderPath) : undefined;

    const agent: ClaudeAgentState = {
      id,
      terminalRef: terminal,
      projectDir,
      jsonlFile: expectedFile,
      fileOffset: 0,
      lineBuffer: '',
      activeToolIds: new Set(),
      activeToolStatuses: new Map(),
      activeToolNames: new Map(),
      activeSubagentToolIds: new Map(),
      activeSubagentToolNames: new Map(),
      isWaiting: false,
      permissionSent: false,
      hadToolsInTurn: false,
      folderName,
    };
    this.agents.set(id, agent);
    this.activeAgentIdRef.current = id;
    this.persistAgents();

    this._onAgentCreated.fire({
      id: this.toProviderAgentId(id),
      providerId: PROVIDER_ID,
      folderName,
    });

    const postMessage = this.makePostMessage();
    if (!this.projectScanTimerRef.current) {
      ensureProjectScan(
        projectDir,
        this.knownJsonlFiles,
        this.projectScanTimerRef,
        this.activeAgentIdRef,
        this.nextAgentIdRef,
        this.agents,
        this.fileWatchers,
        this.pollingTimers,
        this.waitingTimers,
        this.permissionTimers,
        postMessage,
        (newId, newAgent) => {
          this._onAgentCreated.fire({
            id: this.toProviderAgentId(newId),
            providerId: PROVIDER_ID,
            folderName: newAgent.folderName,
          });
        },
        (agentId, newFilePath) => {
          reassignAgentToFile(agentId, newFilePath, this.agents, this.fileWatchers, this.pollingTimers, this.waitingTimers, this.permissionTimers, postMessage);
        },
      );
    }

    const pollTimer = setInterval(() => {
      if (fs.existsSync(agent.jsonlFile)) {
        clearInterval(pollTimer);
        this.jsonlPollTimers.delete(id);
        startFileWatching(id, agent.jsonlFile, this.agents, this.fileWatchers, this.pollingTimers, this.waitingTimers, this.permissionTimers, postMessage);
        readNewLines(id, this.agents, this.waitingTimers, this.permissionTimers, postMessage);
      }
    }, JSONL_POLL_INTERVAL_MS);
    this.jsonlPollTimers.set(id, pollTimer);
  }

  focusAgent(providerAgentId: string): void {
    const match = providerAgentId.match(/^claude-code:(\d+)$/);
    if (!match) return;
    const id = parseInt(match[1], 10);
    const agent = this.agents.get(id);
    if (agent) agent.terminalRef.show();
  }

  closeAgent(providerAgentId: string): void {
    const match = providerAgentId.match(/^claude-code:(\d+)$/);
    if (!match) return;
    const id = parseInt(match[1], 10);
    const agent = this.agents.get(id);
    if (agent) {
      agent.terminalRef.dispose();
    }
  }

  getActiveAgents(): NormalizedAgent[] {
    const result: NormalizedAgent[] = [];
    for (const agent of this.agents.values()) {
      result.push({
        id: this.toProviderAgentId(agent.id),
        providerId: PROVIDER_ID,
        folderName: agent.folderName,
      });
    }
    return result;
  }
}
