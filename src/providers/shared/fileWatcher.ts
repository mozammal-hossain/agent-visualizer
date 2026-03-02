import * as fs from 'fs';
import type { BaseJsonlAgentState } from './state.js';
import { FILE_WATCHER_POLL_INTERVAL_MS } from '../../constants.js';

export type ProcessLineFn = (agentId: number, line: string) => void;

/** Callback invoked when the file may have new content; implementation should read and process new lines. */
export type OnReadNewLinesFn = () => void;

/**
 * Start watching a JSONL file for appends and invoke onRead when content may have changed.
 * Uses fs.watch, fs.watchFile, and polling fallback for reliability.
 */
export function startJsonlFileWatching<T extends BaseJsonlAgentState>(
  agentId: number,
  filePath: string,
  agents: Map<number, T>,
  fileWatchers: Map<number, fs.FSWatcher>,
  pollingTimers: Map<number, ReturnType<typeof setInterval>>,
  onRead: OnReadNewLinesFn,
): void {
  const readNewLines = () => {
    if (agents.has(agentId)) onRead();
  };

  try {
    const watcher = fs.watch(filePath, readNewLines);
    fileWatchers.set(agentId, watcher);
  } catch {
    /* ignore */
  }

  try {
    fs.watchFile(filePath, { interval: FILE_WATCHER_POLL_INTERVAL_MS }, readNewLines);
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
    onRead();
  }, FILE_WATCHER_POLL_INTERVAL_MS);
  pollingTimers.set(agentId, interval);
}

/**
 * Read new lines from an agent's JSONL file since last fileOffset, update state, return the new lines.
 * Caller can run pre-processing (e.g. cancel timers) before handling each line.
 */
export function getNewLinesAndUpdateOffset<T extends BaseJsonlAgentState>(
  agentId: number,
  agents: Map<number, T>,
): string[] {
  const agent = agents.get(agentId);
  if (!agent) return [];
  try {
    const stat = fs.statSync(agent.jsonlFile);
    if (stat.size <= agent.fileOffset) return [];

    const buf = Buffer.alloc(stat.size - agent.fileOffset);
    const fd = fs.openSync(agent.jsonlFile, 'r');
    fs.readSync(fd, buf, 0, buf.length, agent.fileOffset);
    fs.closeSync(fd);
    agent.fileOffset = stat.size;

    const text = agent.lineBuffer + buf.toString('utf-8');
    const lines = text.split('\n');
    agent.lineBuffer = lines.pop() || '';
    return lines.filter((l) => l.trim());
  } catch {
    return [];
  }
}

/**
 * Read new lines from an agent's JSONL file since last fileOffset, update state, and call processLine for each line.
 */
export function readNewLinesFromFile<T extends BaseJsonlAgentState>(
  agentId: number,
  agents: Map<number, T>,
  processLine: ProcessLineFn,
): void {
  const lines = getNewLinesAndUpdateOffset(agentId, agents);
  for (const line of lines) {
    processLine(agentId, line);
  }
}

/**
 * Stop watching a file and clear timers. Call before reassigning or removing an agent.
 */
export function stopJsonlFileWatching(
  agentId: number,
  filePath: string,
  fileWatchers: Map<number, fs.FSWatcher>,
  pollingTimers: Map<number, ReturnType<typeof setInterval>>,
): void {
  fileWatchers.get(agentId)?.close();
  fileWatchers.delete(agentId);
  const pt = pollingTimers.get(agentId);
  if (pt) clearInterval(pt);
  pollingTimers.delete(agentId);
  try {
    fs.unwatchFile(filePath);
  } catch {
    /* ignore */
  }
}
