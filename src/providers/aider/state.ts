export interface AiderAgentState {
  id: number;
  /** Path to .aider.chat.history.md */
  historyPath: string;
  lastSize: number;
  lastActiveAt: number;
  /** Whether we've fired "active" for current activity burst */
  activeSent: boolean;
}

export function createAiderAgentState(id: number, historyPath: string): AiderAgentState {
  return {
    id,
    historyPath,
    lastSize: 0,
    lastActiveAt: 0,
    activeSent: false,
  };
}
