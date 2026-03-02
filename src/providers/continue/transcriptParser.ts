import type { ContinueAgentState } from './state.js';
import type { PostMessage } from '../shared/timerManager.js';

/**
 * Continue.dev session format is not fully documented. Try to detect tool-like activity
 * from common patterns (type, name, function_call, tool_use, etc.).
 */
export function processTranscriptLine(
  agentId: number,
  line: string,
  agents: Map<number, ContinueAgentState>,
  postMessage: PostMessage,
): void {
  const agent = agents.get(agentId);
  if (!agent) return;
  try {
    const record = JSON.parse(line) as Record<string, unknown>;
    const type = record.type as string | undefined;

    if (type === 'assistant' || type === 'message') {
      const content = record.content ?? record.message ?? record.payload;
      const arr = Array.isArray(content) ? content : [];
      for (const block of arr) {
        const blockType = (block as Record<string, unknown>).type as string | undefined;
        const name = (block as Record<string, unknown>).name as string | undefined;
        const id = ((block as Record<string, unknown>).id ?? (block as Record<string, unknown>).tool_use_id) as string | undefined;
        if ((blockType === 'tool_use' || blockType === 'function_call') && id) {
          const toolName = name || blockType;
          const status = `Using ${toolName}`;
          if (!agent.activeToolIds.has(id)) {
            agent.activeToolIds.add(id);
            agent.activeToolStatuses.set(id, status);
            agent.activeToolNames.set(id, toolName);
            postMessage({ type: 'agentStatus', id: agentId, status: 'active' });
            postMessage({ type: 'agentToolStart', id: agentId, toolId: id, status });
          }
        }
      }
    }

    const toolResultId = (record.tool_use_id ?? (record as Record<string, unknown>).tool_use_id) as string | undefined;
    if (toolResultId && agent.activeToolIds.has(toolResultId)) {
      agent.activeToolIds.delete(toolResultId);
      agent.activeToolStatuses.delete(toolResultId);
      agent.activeToolNames.delete(toolResultId);
      setTimeout(() => postMessage({ type: 'agentToolDone', id: agentId, toolId: toolResultId }), 300);
    }

    if (type === 'turn_completed' || type === 'turn_done') {
      agent.activeToolIds.clear();
      agent.activeToolStatuses.clear();
      agent.activeToolNames.clear();
      agent.isWaiting = true;
      postMessage({ type: 'agentToolsClear', id: agentId });
      postMessage({ type: 'agentStatus', id: agentId, status: 'waiting' });
    }
  } catch {
    /* ignore */
  }
}
