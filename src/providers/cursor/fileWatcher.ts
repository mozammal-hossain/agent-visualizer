import * as fs from 'fs';
import type { CursorAgentState } from './state.js';
import {
  cancelWaitingTimer,
  cancelPermissionTimer,
} from '../shared/timerManager.js';
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
  agents: Map<number, CursorAgentState>,
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

export { stopJsonlFileWatching };
