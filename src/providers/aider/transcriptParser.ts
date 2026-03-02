import type { AiderAgentState } from './state.js';
import type { PostMessage } from '../shared/timerManager.js';

const AIDER_IDLE_MS = 8000;

/**
 * Heuristic: if file content has recent SEARCH/REPLACE or code blocks, consider agent "active".
 */
export function detectActivityFromContent(content: string): boolean {
  if (/^```[\s\S]*?^```/m.test(content)) return true;
  if (/SEARCH\/REPLACE|search_replace|```\w*\n[\s\S]*?^```/m.test(content)) return true;
  return false;
}

export function processHistoryFile(
  agentId: number,
  content: string,
  agent: AiderAgentState,
  postMessage: PostMessage,
): void {
  const now = Date.now();
  const active = detectActivityFromContent(content);
  if (active) {
    agent.lastActiveAt = now;
    if (!agent.activeSent) {
      agent.activeSent = true;
      postMessage({ type: 'agentStatus', id: agentId, status: 'active' });
      postMessage({
        type: 'agentToolStart',
        id: agentId,
        toolId: 'aider-edit',
        status: 'Editing with Aider',
      });
    }
  } else if (agent.activeSent && now - agent.lastActiveAt > AIDER_IDLE_MS) {
    agent.activeSent = false;
    postMessage({ type: 'agentToolDone', id: agentId, toolId: 'aider-edit' });
    postMessage({ type: 'agentToolsClear', id: agentId });
    postMessage({ type: 'agentStatus', id: agentId, status: 'waiting' });
  }
}
