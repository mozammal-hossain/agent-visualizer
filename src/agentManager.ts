/**
 * AgentManager - Aggregates events from all providers into unified agent state
 * and forwards normalized messages to the webview (numeric agent ids).
 */

import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import type { ProviderRegistry } from './providers/registry.js';
import type { NormalizedAgent, ProviderContext } from './providers/types.js';

export type PostMessage = (message: Record<string, unknown>) => void;

/** Maps provider agent id (e.g. "claude:1") to numeric id for webview */
const agentIdToNumeric = new Map<string, number>();
/** Maps numeric id to provider agent id */
const numericToAgentId = new Map<number, string>();
/** Next numeric id to assign */
let nextNumericId = 1;

/** Per-agent meta for webview (palette, seatId, providerId for badge) */
const agentMeta = new Map<number, { providerId: string; folderName?: string }>();

export function getProjectDirPath(cwd?: string): string | null {
  const workspacePath = cwd || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspacePath) return null;
  const dirName = workspacePath.replace(/[^a-zA-Z0-9-]/g, '-');
  return path.join(os.homedir(), '.cursor', 'projects', dirName);
}

function toNumericId(providerAgentId: string): number {
  let num = agentIdToNumeric.get(providerAgentId);
  if (num === undefined) {
    num = nextNumericId++;
    agentIdToNumeric.set(providerAgentId, num);
    numericToAgentId.set(num, providerAgentId);
  }
  return num;
}

function fromNumericId(num: number): string | undefined {
  return numericToAgentId.get(num);
}

/**
 * Subscribe the given postMessage to all events from the provider registry.
 * Returns a dispose function to unsubscribe.
 */
export function subscribeAgentManager(
  registry: ProviderRegistry,
  postMessage: PostMessage,
): { dispose: () => void } {
  const disposables: vscode.Disposable[] = [];

  for (const provider of registry.getAll()) {
    disposables.push(
      provider.onAgentCreated((agent: NormalizedAgent) => {
        const id = toNumericId(agent.id);
        agentMeta.set(id, { providerId: provider.id, folderName: agent.folderName });
        postMessage({
          type: 'agentCreated',
          id,
          folderName: agent.folderName,
          providerId: provider.id,
        });
      }),
    );

    disposables.push(
      provider.onAgentClosed(({ agentId }) => {
        const num = agentIdToNumeric.get(agentId);
        if (num !== undefined) {
          agentIdToNumeric.delete(agentId);
          numericToAgentId.delete(num);
          agentMeta.delete(num);
          postMessage({ type: 'agentClosed', id: num });
        }
      }),
    );

    disposables.push(
      provider.onToolStart(({ agentId, toolId, toolName }) => {
        const num = agentIdToNumeric.get(agentId);
        if (num !== undefined) {
          postMessage({
            type: 'agentToolStart',
            id: num,
            toolId,
            status: toolName,
          });
        }
      }),
    );

    disposables.push(
      provider.onToolDone(({ agentId, toolId }) => {
        const num = agentIdToNumeric.get(agentId);
        if (num !== undefined) {
          postMessage({ type: 'agentToolDone', id: num, toolId });
        }
      }),
    );

    disposables.push(
      provider.onStatusChange(({ agentId, status }) => {
        const num = agentIdToNumeric.get(agentId);
        if (num !== undefined) {
          postMessage({ type: 'agentStatus', id: num, status });
          if (status === 'waiting') {
            postMessage({ type: 'agentToolsClear', id: num });
          }
        }
      }),
    );

    disposables.push(
      provider.onPermission(({ agentId, needed }) => {
        const num = agentIdToNumeric.get(agentId);
        if (num !== undefined) {
          postMessage({
            type: needed ? 'agentToolPermission' : 'agentToolPermissionClear',
            id: num,
          });
        }
      }),
    );

    disposables.push(
      provider.onSubagentEvent((ev) => {
        const num = agentIdToNumeric.get(ev.agentId);
        if (num === undefined) return;
        if (ev.kind === 'start' && ev.toolId != null && ev.toolName != null) {
          postMessage({
            type: 'subagentToolStart',
            id: num,
            parentToolId: ev.parentToolId,
            toolId: ev.toolId,
            status: ev.toolName,
          });
        } else if (ev.kind === 'done' && ev.toolId != null) {
          postMessage({
            type: 'subagentToolDone',
            id: num,
            parentToolId: ev.parentToolId,
            toolId: ev.toolId,
          });
        } else if (ev.kind === 'permission') {
          postMessage({
            type: 'subagentToolPermission',
            id: num,
            parentToolId: ev.parentToolId,
          });
        } else if (ev.kind === 'clear') {
          postMessage({
            type: 'subagentClear',
            id: num,
            parentToolId: ev.parentToolId,
          });
        }
      }),
    );
  }

  return {
    dispose() {
      for (const d of disposables) {
        d.dispose();
      }
    },
  };
}

/**
 * Get current list of numeric agent ids and their meta (for existingAgents message).
 */
export function getExistingAgentIds(): { ids: number[]; meta: Record<number, { providerId: string; folderName?: string }> } {
  const ids = Array.from(numericToAgentId.keys()).sort((a, b) => a - b);
  const meta: Record<number, { providerId: string; folderName?: string }> = {};
  for (const [num, m] of agentMeta) {
    meta[num] = m;
  }
  return { ids, meta };
}

/**
 * Resolve numeric id to provider agent id (for focus/close when webview sends id).
 */
export function getProviderAgentId(numericId: number): string | undefined {
  return fromNumericId(numericId);
}

/**
 * Get provider id and provider agent id for a numeric id (for focus/close).
 */
export function getAgentInfo(numericId: number): { providerId: string; providerAgentId: string } | undefined {
  const providerAgentId = fromNumericId(numericId);
  const meta = agentMeta.get(numericId);
  if (!providerAgentId || !meta) return undefined;
  return { providerId: meta.providerId, providerAgentId };
}
