import * as path from 'path';
import type { ClineAgentState } from './state.js';
import { processAnthropicTranscriptLine } from '../shared/anthropicParser.js';
import type { PostMessage } from '../shared/timerManager.js';
import { BASH_COMMAND_DISPLAY_MAX_LENGTH } from '../../constants.js';

export const PERMISSION_EXEMPT_TOOLS = new Set<string>(['Task', 'AskUserQuestion']);

export function formatToolStatus(toolName: string, input: Record<string, unknown>): string {
  const base = (p: unknown) => (typeof p === 'string' ? path.basename(p) : '');
  switch (toolName) {
    case 'Read':
      return `Reading ${base(input.file_path)}`;
    case 'Edit':
      return `Editing ${base(input.file_path)}`;
    case 'Write':
      return `Writing ${base(input.file_path)}`;
    case 'Bash':
    case 'Shell': {
      const cmd = (input.command as string) || '';
      return `Running: ${cmd.length > BASH_COMMAND_DISPLAY_MAX_LENGTH ? cmd.slice(0, BASH_COMMAND_DISPLAY_MAX_LENGTH) + '\u2026' : cmd}`;
    }
    case 'Glob':
      return 'Searching files';
    case 'Grep':
      return 'Searching code';
    case 'Task':
      return 'Running subtask';
    default:
      return `Using ${toolName}`;
  }
}

/**
 * Process new messages from Cline's api_conversation_history.json (Anthropic message format).
 */
export function processNewMessages(
  agentId: number,
  messages: Array<{ role?: string; content?: unknown }>,
  agents: Map<number, ClineAgentState>,
  waitingTimers: Map<number, ReturnType<typeof setTimeout>>,
  permissionTimers: Map<number, ReturnType<typeof setTimeout>>,
  postMessage: PostMessage,
): void {
  const options = {
    formatToolStatus,
    permissionExemptTools: PERMISSION_EXEMPT_TOOLS,
    agents,
    waitingTimers,
    permissionTimers,
    postMessage,
  };
  for (const msg of messages) {
    const type = msg.role === 'assistant' ? 'assistant' : msg.role === 'user' ? 'user' : null;
    if (!type) continue;
    const line = JSON.stringify({ type, message: msg });
    processAnthropicTranscriptLine(agentId, line, options);
  }
}
