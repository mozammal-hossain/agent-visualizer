import type { BaseJsonlAgentState } from './state.js';
import {
  cancelWaitingTimer,
  startWaitingTimer,
  clearAgentActivity,
  startPermissionTimer,
  cancelPermissionTimer,
  type PostMessage,
} from './timerManager.js';
import { TOOL_DONE_DELAY_MS, TEXT_IDLE_DELAY_MS } from '../../constants.js';

export interface AnthropicParserOptions<T extends BaseJsonlAgentState> {
  formatToolStatus: (toolName: string, input: Record<string, unknown>) => string;
  permissionExemptTools: Set<string>;
  agents: Map<number, T>;
  waitingTimers: Map<number, ReturnType<typeof setTimeout>>;
  permissionTimers: Map<number, ReturnType<typeof setTimeout>>;
  postMessage: PostMessage;
}

/**
 * Process one line of Anthropic-format JSONL (assistant with tool_use, user with tool_result, system turn_duration).
 * Does not handle provider-specific record types (e.g. Claude's "progress" for subagents).
 */
export function processAnthropicTranscriptLine<T extends BaseJsonlAgentState>(
  agentId: number,
  line: string,
  options: AnthropicParserOptions<T>,
): void {
  const { formatToolStatus, permissionExemptTools, agents, waitingTimers, permissionTimers, postMessage } = options;
  const agent = agents.get(agentId);
  if (!agent) return;
  try {
    const record = JSON.parse(line) as Record<string, unknown> & {
      message?: { content?: unknown };
      subtype?: string;
    };

    if (record.type === 'assistant' && Array.isArray(record.message?.content)) {
      const blocks = record.message.content as Array<{
        type: string;
        id?: string;
        name?: string;
        input?: Record<string, unknown>;
      }>;
      const hasToolUse = blocks.some((b) => b.type === 'tool_use');

      if (hasToolUse) {
        cancelWaitingTimer(agentId, waitingTimers);
        agent.isWaiting = false;
        agent.hadToolsInTurn = true;
        postMessage({ type: 'agentStatus', id: agentId, status: 'active' });
        let hasNonExemptTool = false;
        for (const block of blocks) {
          if (block.type === 'tool_use' && block.id) {
            const toolName = block.name || '';
            const status = formatToolStatus(toolName, block.input || {});
            agent.activeToolIds.add(block.id);
            agent.activeToolStatuses.set(block.id, status);
            agent.activeToolNames.set(block.id, toolName);
            if (!permissionExemptTools.has(toolName)) {
              hasNonExemptTool = true;
            }
            postMessage({
              type: 'agentToolStart',
              id: agentId,
              toolId: block.id,
              status,
            });
          }
        }
        if (hasNonExemptTool) {
          startPermissionTimer(agentId, agents, permissionTimers, permissionExemptTools, postMessage);
        }
      } else if (blocks.some((b) => b.type === 'text') && !agent.hadToolsInTurn) {
        startWaitingTimer(agentId, TEXT_IDLE_DELAY_MS, agents, waitingTimers, postMessage);
      }
    } else if (record.type === 'user') {
      const content = (record.message as { content?: unknown } | undefined)?.content;
      if (Array.isArray(content)) {
        const blocks = content as Array<{ type: string; tool_use_id?: string }>;
        const hasToolResult = blocks.some((b) => b.type === 'tool_result');
        if (hasToolResult) {
          for (const block of blocks) {
            if (block.type === 'tool_result' && block.tool_use_id) {
              const completedToolId = block.tool_use_id;
              if (agent.activeToolNames.get(completedToolId) === 'Task') {
                agent.activeSubagentToolIds.delete(completedToolId);
                agent.activeSubagentToolNames.delete(completedToolId);
                postMessage({ type: 'subagentClear', id: agentId, parentToolId: completedToolId });
              }
              agent.activeToolIds.delete(completedToolId);
              agent.activeToolStatuses.delete(completedToolId);
              agent.activeToolNames.delete(completedToolId);
              const toolId = completedToolId;
              setTimeout(() => {
                postMessage({ type: 'agentToolDone', id: agentId, toolId });
              }, TOOL_DONE_DELAY_MS);
            }
          }
          if (agent.activeToolIds.size === 0) {
            agent.hadToolsInTurn = false;
          }
        } else {
          cancelWaitingTimer(agentId, waitingTimers);
          clearAgentActivity(agent, agentId, permissionTimers, postMessage);
          agent.hadToolsInTurn = false;
        }
      } else if (typeof content === 'string' && content.trim()) {
        cancelWaitingTimer(agentId, waitingTimers);
        clearAgentActivity(agent, agentId, permissionTimers, postMessage);
        agent.hadToolsInTurn = false;
      }
    } else if (record.type === 'system' && record.subtype === 'turn_duration') {
      cancelWaitingTimer(agentId, waitingTimers);
      cancelPermissionTimer(agentId, permissionTimers);

      if (agent.activeToolIds.size > 0) {
        agent.activeToolIds.clear();
        agent.activeToolStatuses.clear();
        agent.activeToolNames.clear();
        agent.activeSubagentToolIds.clear();
        agent.activeSubagentToolNames.clear();
        postMessage({ type: 'agentToolsClear', id: agentId });
      }

      agent.isWaiting = true;
      agent.permissionSent = false;
      agent.hadToolsInTurn = false;
      postMessage({ type: 'agentStatus', id: agentId, status: 'waiting' });
    }
  } catch {
    /* ignore malformed lines */
  }
}
