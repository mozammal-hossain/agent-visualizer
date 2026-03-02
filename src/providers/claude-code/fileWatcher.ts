import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import type { ClaudeAgentState } from './state.js';
import {
  cancelWaitingTimer,
  cancelPermissionTimer,
  clearAgentActivity,
} from './timerManager.js';
import { processTranscriptLine } from './transcriptParser.js';
import type { PostMessage } from './timerManager.js';
import { FILE_WATCHER_POLL_INTERVAL_MS, PROJECT_SCAN_INTERVAL_MS } from '../../constants.js';

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
  try {
    const watcher = fs.watch(filePath, () => {
      readNewLines(agentId, agents, waitingTimers, permissionTimers, postMessage);
    });
    fileWatchers.set(agentId, watcher);
  } catch {
    /* ignore */
  }

  try {
    fs.watchFile(filePath, { interval: FILE_WATCHER_POLL_INTERVAL_MS }, () => {
      readNewLines(agentId, agents, waitingTimers, permissionTimers, postMessage);
    });
  } catch {
    /* ignore */
  }

  const interval = setInterval(() => {
    if (!agents.has(agentId)) {
      clearInterval(interval);
      try {
        fs.unwatchFile(filePath);
      } catch {
        /* ignore */
      }
      return;
    }
    readNewLines(agentId, agents, waitingTimers, permissionTimers, postMessage);
  }, FILE_WATCHER_POLL_INTERVAL_MS);
  pollingTimers.set(agentId, interval);
}

export function readNewLines(
  agentId: number,
  agents: Map<number, ClaudeAgentState>,
  waitingTimers: Map<number, ReturnType<typeof setTimeout>>,
  permissionTimers: Map<number, ReturnType<typeof setTimeout>>,
  postMessage: PostMessage,
): void {
  const agent = agents.get(agentId);
  if (!agent) return;
  try {
    const stat = fs.statSync(agent.jsonlFile);
    if (stat.size <= agent.fileOffset) return;

    const buf = Buffer.alloc(stat.size - agent.fileOffset);
    const fd = fs.openSync(agent.jsonlFile, 'r');
    fs.readSync(fd, buf, 0, buf.length, agent.fileOffset);
    fs.closeSync(fd);
    agent.fileOffset = stat.size;

    const text = agent.lineBuffer + buf.toString('utf-8');
    const lines = text.split('\n');
    agent.lineBuffer = lines.pop() || '';

    const hasLines = lines.some((l) => l.trim());
    if (hasLines) {
      cancelWaitingTimer(agentId, waitingTimers);
      cancelPermissionTimer(agentId, permissionTimers);
      if (agent.permissionSent) {
        agent.permissionSent = false;
        postMessage({ type: 'agentToolPermissionClear', id: agentId });
      }
    }

    for (const line of lines) {
      if (!line.trim()) continue;
      processTranscriptLine(agentId, line, agents, waitingTimers, permissionTimers, postMessage);
    }
  } catch {
    /* ignore read errors */
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

  fileWatchers.get(agentId)?.close();
  fileWatchers.delete(agentId);
  const pt = pollingTimers.get(agentId);
  if (pt) clearInterval(pt);
  pollingTimers.delete(agentId);
  try {
    fs.unwatchFile(agent.jsonlFile);
  } catch {
    /* ignore */
  }

  cancelWaitingTimer(agentId, waitingTimers);
  cancelPermissionTimer(agentId, permissionTimers);
  clearAgentActivity(agent, agentId, permissionTimers, postMessage);

  agent.jsonlFile = newFilePath;
  agent.fileOffset = 0;
  agent.lineBuffer = '';

  startFileWatching(agentId, newFilePath, agents, fileWatchers, pollingTimers, waitingTimers, permissionTimers, postMessage);
  readNewLines(agentId, agents, waitingTimers, permissionTimers, postMessage);
}
