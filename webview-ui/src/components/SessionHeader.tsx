import React from "react";
import { Session } from "../types";

interface SessionHeaderProps {
    session: Session;
}

function SessionHeader({ session }: SessionHeaderProps) {
    return (
        <div className="session-header">
            <div className="header-content">
                <h1>{session.firstUserMessage}</h1>
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
                        {session.messages.reduce((sum, m) => sum + m.toolCalls.length, 0)}
                    </span>
                </div>
            </div>
        </div>
    );
}

export default SessionHeader;
