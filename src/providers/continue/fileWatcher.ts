import * as fs from 'fs';
import * as path from 'path';
import type { ContinueAgentState } from './state.js';
import { processTranscriptLine } from './transcriptParser.js';
import type { PostMessage } from '../shared/timerManager.js';
import {
  startJsonlFileWatching,
  getNewLinesAndUpdateOffset,
  stopJsonlFileWatching,
} from '../shared/fileWatcher.js';

export function startFileWatching(
  agentId: number,
  filePath: string,
  agents: Map<number, ContinueAgentState>,
  fileWatchers: Map<number, fs.FSWatcher>,
  pollingTimers: Map<number, ReturnType<typeof setInterval>>,
  postMessage: PostMessage,
): void {
  const readNewLines = () => {
    const lines = getNewLinesAndUpdateOffset(agentId, agents);
    for (const line of lines) {
      processTranscriptLine(agentId, line, agents, postMessage);
    }
  };
  startJsonlFileWatching(agentId, filePath, agents, fileWatchers, pollingTimers, readNewLines);
}

export { stopJsonlFileWatching };

/**
 * Find session files under ~/.continue/sessions (and optional projects subdir).
 */
export function findContinueSessionFiles(sessionsDir: string, maxDepth: number): string[] {
  const results: string[] = [];
  function walk(currentDir: string, depth: number) {
    if (depth > maxDepth) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(currentDir, e.name);
      if (e.isDirectory()) {
        walk(full, depth + 1);
      } else if (e.isFile() && (e.name.endsWith('.jsonl') || (e.name.endsWith('.json') && e.name.length > 10))) {
        results.push(full);
      }
    }
  }
  walk(sessionsDir, 0);
  return results;
}
