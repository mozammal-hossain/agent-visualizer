import React from "react";
import { Session } from "../types";
import { deriveStatus, SessionStatus } from "../utils/activityStatus";
import StatusPill from "./common/StatusPill";

interface SessionHeaderProps {
    session: Session;
    statusOverride?: SessionStatus | null;
}

function SessionHeader({
    session,
    statusOverride,
}: SessionHeaderProps) {
    const status = statusOverride ?? deriveStatus(session);

    return (
        <div className="session-header">
            <div className="header-content">
                <div className="header-title-row">
                    <h1>{session.firstUserMessage}</h1>
                    <StatusPill status={status} />
                </div>
                <div className="header-meta">
                    <span className="meta-item">
                        <strong>ID:</strong> {session.id}
                    </span>
                    <span className="meta-item">
                        <strong>Format:</strong> {session.format}
                    </span>
                    <span className="meta-item">
                        <strong>Messages:</strong> {session.messages.length}
                    </span>
                    <span className="meta-item">
                        <strong>Tool Calls:</strong>{" "}
                        {session.messages.reduce((sum, m) => sum + (m.toolCalls?.length ?? 0), 0)}
                    </span>
                </div>
            </div>
        </div>
    );
}

export default SessionHeader;
