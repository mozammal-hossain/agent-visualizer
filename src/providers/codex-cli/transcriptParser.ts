import * as path from 'path';
import type { CodexAgentState } from './state.js';
import type { PostMessage } from '../shared/timerManager.js';
import { BASH_COMMAND_DISPLAY_MAX_LENGTH } from '../../constants.js';

function formatToolStatus(toolType: string, item: Record<string, unknown>): string {
  switch (toolType) {
    case 'command_execution': {
      const cmd = (item.command as string) || '';
      return `Running: ${cmd.length > BASH_COMMAND_DISPLAY_MAX_LENGTH ? cmd.slice(0, BASH_COMMAND_DISPLAY_MAX_LENGTH) + '\u2026' : cmd}`;
    }
    case 'file_change': {
      const changes = (item.changes as Array<{ path?: string; kind?: string }>) || [];
      const first = changes[0];
      const name = first?.path ? path.basename(first.path) : 'file';
      return `Editing ${name}`;
    }
    case 'mcp_tool_call': {
      const tool = (item.tool as string) || 'tool';
      return `Using ${tool}`;
    }
    default:
      return `Using ${toolType}`;
  }
}

/**
 * Codex CLI JSONL: type (e.g. item.started, item.completed), item.id, item.type (command_execution, file_change, mcp_tool_call).
 */
export function processTranscriptLine(
  agentId: number,
  line: string,
  agents: Map<number, CodexAgentState>,
  postMessage: PostMessage,
): void {
  const agent = agents.get(agentId);
  if (!agent) return;
  try {
    const record = JSON.parse(line) as Record<string, unknown>;
    const type = record.type as string | undefined;
    const item = record.item as Record<string, unknown> | undefined;
    if (!type || !item) return;

    const itemId = (item.id as string) || (record.uuid as string);
    const itemType = item.type as string | undefined;
    if (!itemId || !itemType) return;

    if (type === 'item.started' || type === 'item.updated') {
      const status = item.status as string | undefined;
      if (status === 'in_progress' || type === 'item.started') {
        if (!agent.activeToolIds.has(itemId)) {
          agent.activeToolIds.add(itemId);
          const statusText = formatToolStatus(itemType, item);
          agent.activeToolStatuses.set(itemId, statusText);
          agent.activeToolNames.set(itemId, itemType);
          postMessage({ type: 'agentStatus', id: agentId, status: 'active' });
          postMessage({ type: 'agentToolStart', id: agentId, toolId: itemId, status: statusText });
        }
      }
    } else if (type === 'item.completed' || type === 'turn.completed') {
      if (type === 'item.completed' && agent.activeToolIds.has(itemId)) {
        agent.activeToolIds.delete(itemId);
        agent.activeToolStatuses.delete(itemId);
        agent.activeToolNames.delete(itemId);
        setTimeout(() => postMessage({ type: 'agentToolDone', id: agentId, toolId: itemId }), 300);
      }
      if (type === 'turn.completed') {
        agent.activeToolIds.clear();
        agent.activeToolStatuses.clear();
        agent.activeToolNames.clear();
        agent.isWaiting = true;
        postMessage({ type: 'agentToolsClear', id: agentId });
        postMessage({ type: 'agentStatus', id: agentId, status: 'waiting' });
      }
    }
  } catch {
    /* ignore malformed lines */
  }
}
