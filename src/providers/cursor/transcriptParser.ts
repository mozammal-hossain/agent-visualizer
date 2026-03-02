import * as path from 'path';
import type { CursorAgentState } from './state.js';
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
    case 'Shell':
    case 'Bash': {
      const cmd = (input.command as string) || (input.command_line as string) || '';
      return `Running: ${cmd.length > BASH_COMMAND_DISPLAY_MAX_LENGTH ? cmd.slice(0, BASH_COMMAND_DISPLAY_MAX_LENGTH) + '\u2026' : cmd}`;
    }
    case 'Glob':
      return 'Searching files';
    case 'Grep':
      return 'Searching code';
    case 'WebFetch':
      return 'Fetching web content';
    case 'WebSearch':
      return 'Searching the web';
    case 'Task': {
      const desc = typeof input.description === 'string' ? input.description : '';
      return desc ? `Subtask: ${desc.slice(0, 40)}${desc.length > 40 ? '\u2026' : ''}` : 'Running subtask';
    }
    case 'AskUserQuestion':
      return 'Waiting for your answer';
    default:
      return `Using ${toolName}`;
  }
}

export function processTranscriptLine(
  agentId: number,
  line: string,
  agents: Map<number, CursorAgentState>,
  waitingTimers: Map<number, ReturnType<typeof setTimeout>>,
  permissionTimers: Map<number, ReturnType<typeof setTimeout>>,
  postMessage: PostMessage,
): void {
  processAnthropicTranscriptLine(agentId, line, {
    formatToolStatus,
    permissionExemptTools: PERMISSION_EXEMPT_TOOLS,
    agents,
    waitingTimers,
    permissionTimers,
    postMessage,
  });
}
