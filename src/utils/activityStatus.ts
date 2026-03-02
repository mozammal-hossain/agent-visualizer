import { Session } from "../parsers/types";

export type SessionStatus = "working" | "waiting" | "idle";

/**
 * Derive activity status from session content (used when sending sessionStatus to webview).
 */
export function deriveStatus(session: Session): SessionStatus {
    const messages = session.messages;
    if (messages.length === 0) {
        return "idle";
    }

    const last = messages[messages.length - 1];

    if (last.role === "user") {
        return "idle";
    }

    const hasPendingToolCalls = last.toolCalls.some((tc) => !tc.hasResult);
    if (hasPendingToolCalls) {
        return "working";
    }

    return "waiting";
}
