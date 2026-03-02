import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import type { ClaudeAgentState } from './state.js';
import {
  cancelWaitingTimer,
  cancelPermissionTimer,
  clearAgentActivity,
} from '../shared/timerManager.js';
import { processTranscriptLine } from './transcriptParser.js';
import type { PostMessage } from '../shared/timerManager.js';
import {
  startJsonlFileWatching,
  getNewLinesAndUpdateOffset,
  stopJsonlFileWatching,
} from '../shared/fileWatcher.js';
import { PROJECT_SCAN_INTERVAL_MS } from '../../constants.js';

export function startFileWatching(
  agentId: number,
  filePath: string,
  agents: Map<number, ClaudeAgentState>,
  fileWatchers: Map<number, fs.FSWatcher>,
  pollingTimers: Map<number, ReturnType<typeof setInterval>>,
  waitingTimers: Map<number, ReturnType<typeof setTimeout>>,
  permissionTimers: Map<number, ReturnType<typeof setTimeout>>,
  postMessage: PostMessage,
): void {
  const readNewLines = () => {
    const agent = agents.get(agentId);
    if (!agent) return;
    const lines = getNewLinesAndUpdateOffset(agentId, agents);
    const hasLines = lines.length > 0;
    if (hasLines) {
      cancelWaitingTimer(agentId, waitingTimers);
      cancelPermissionTimer(agentId, permissionTimers);
      if (agent.permissionSent) {
        agent.permissionSent = false;
        postMessage({ type: 'agentToolPermissionClear', id: agentId });
      }
    }
    for (const line of lines) {
      processTranscriptLine(agentId, line, agents, waitingTimers, permissionTimers, postMessage);
    }
  };
  startJsonlFileWatching(agentId, filePath, agents, fileWatchers, pollingTimers, readNewLines);
}

export function readNewLines(
  agentId: number,
  agents: Map<number, ClaudeAgentState>,
  waitingTimers: Map<number, ReturnType<typeof setTimeout>>,
  permissionTimers: Map<number, ReturnType<typeof setTimeout>>,
  postMessage: PostMessage,
): void {
  const lines = getNewLinesAndUpdateOffset(agentId, agents);
  const hasLines = lines.length > 0;
  if (hasLines) {
    cancelWaitingTimer(agentId, waitingTimers);
    cancelPermissionTimer(agentId, permissionTimers);
    const agent = agents.get(agentId);
    if (agent?.permissionSent) {
      agent.permissionSent = false;
      postMessage({ type: 'agentToolPermissionClear', id: agentId });
    }
  }
  for (const line of lines) {
    processTranscriptLine(agentId, line, agents, waitingTimers, permissionTimers, postMessage);
  }
}

export function ensureProjectScan(
  projectDir: string,
  knownJsonlFiles: Set<string>,
  projectScanTimerRef: { current: ReturnType<typeof setInterval> | null },
  activeAgentIdRef: { current: number | null },
  nextAgentIdRef: { current: number },
  agents: Map<number, ClaudeAgentState>,
  fileWatchers: Map<number, fs.FSWatcher>,
  pollingTimers: Map<number, ReturnType<typeof setInterval>>,
  waitingTimers: Map<number, ReturnType<typeof setTimeout>>,
  permissionTimers: Map<number, ReturnType<typeof setTimeout>>,
  postMessage: PostMessage,
  onAgentCreated: (id: number, agent: ClaudeAgentState) => void,
  onReassign: (agentId: number, newFilePath: string) => void,
): void {
  if (projectScanTimerRef.current) return;
  try {
    const files = fs
      .readdirSync(projectDir)
      .filter((f) => f.endsWith('.jsonl'))
      .map((f) => path.join(projectDir, f));
    for (const f of files) {
      knownJsonlFiles.add(f);
    }
  } catch {
    /* dir may not exist */
  }

  const scan = () => {
    let files: string[];
    try {
      files = fs
        .readdirSync(projectDir)
        .filter((f) => f.endsWith('.jsonl'))
        .map((f) => path.join(projectDir, f));
    } catch {
      return;
    }

    for (const file of files) {
      if (!knownJsonlFiles.has(file)) {
        knownJsonlFiles.add(file);
        if (activeAgentIdRef.current !== null) {
          onReassign(activeAgentIdRef.current, file);
        } else {
          const activeTerminal = vscode.window.activeTerminal;
          if (activeTerminal) {
            let owned = false;
            for (const agent of agents.values()) {
              if (agent.terminalRef === activeTerminal) {
                owned = true;
                break;
              }
            }
            if (!owned) {
              const id = nextAgentIdRef.current++;
              const isMultiRoot = (vscode.workspace.workspaceFolders?.length ?? 0) > 1;
              const folderName = isMultiRoot ? path.basename(projectDir) : undefined;
              const agent: ClaudeAgentState = {
                id,
                terminalRef: activeTerminal,
                projectDir,
                jsonlFile: file,
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
              agents.set(id, agent);
              activeAgentIdRef.current = id;
              onAgentCreated(id, agent);
              startFileWatching(id, file, agents, fileWatchers, pollingTimers, waitingTimers, permissionTimers, postMessage);
              readNewLines(id, agents, waitingTimers, permissionTimers, postMessage);
            }
          }
        }
      }
    }
  };

  projectScanTimerRef.current = setInterval(scan, PROJECT_SCAN_INTERVAL_MS);
}

export function reassignAgentToFile(
  agentId: number,
  newFilePath: string,
  agents: Map<number, ClaudeAgentState>,
  fileWatchers: Map<number, fs.FSWatcher>,
  pollingTimers: Map<number, ReturnType<typeof setInterval>>,
  waitingTimers: Map<number, ReturnType<typeof setTimeout>>,
  permissionTimers: Map<number, ReturnType<typeof setTimeout>>,
  postMessage: PostMessage,
): void {
  const agent = agents.get(agentId);
  if (!agent) return;

  stopJsonlFileWatching(agentId, agent.jsonlFile, fileWatchers, pollingTimers);
  cancelWaitingTimer(agentId, waitingTimers);
  cancelPermissionTimer(agentId, permissionTimers);
  clearAgentActivity(agent, agentId, permissionTimers, postMessage);

  agent.jsonlFile = newFilePath;
  agent.fileOffset = 0;
  agent.lineBuffer = '';

  startFileWatching(agentId, newFilePath, agents, fileWatchers, pollingTimers, waitingTimers, permissionTimers, postMessage);
  readNewLines(agentId, agents, waitingTimers, permissionTimers, postMessage);
}
