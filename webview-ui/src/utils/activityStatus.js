/**
 * Derive activity status from session content:
 * - working: last message is assistant with tool calls that have no result yet
 * - waiting: last message is assistant with no pending tool calls (agent finished, waiting for user)
 * - idle: last message is user, or no messages
 */
export function deriveStatus(session) {
    const messages = session.messages;
    if (messages.length === 0) {
        return "idle";
    }
    const last = messages[messages.length - 1];
    if (last.role === "user") {
        return "idle";
    }
    // Last message is assistant
    const hasPendingToolCalls = last.toolCalls.some((tc) => !tc.hasResult);
    if (hasPendingToolCalls) {
        return "working";
    }
    return "waiting";
}
