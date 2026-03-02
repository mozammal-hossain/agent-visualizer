import React from "react";
import { Session } from "../types";
import { deriveStatus, SessionStatus } from "../utils/activityStatus";
import { ThemeMode } from "../theme";
import StatusPill from "./common/StatusPill";

interface SessionHeaderProps {
    session: Session;
    statusOverride?: SessionStatus | null;
    themeMode?: ThemeMode;
    onThemeModeChange?: (mode: ThemeMode) => void;
}

function SessionHeader({
    session,
    statusOverride,
    themeMode = "auto",
    onThemeModeChange,
}: SessionHeaderProps) {
    const status = statusOverride ?? deriveStatus(session);

    const handleThemeClick = (mode: ThemeMode) => {
        if (onThemeModeChange) {
            onThemeModeChange(mode);
        }
    };

    return (
        <div className="session-header">
            <div className="header-content">
                <div className="header-title-row">
                    <h1>{session.firstUserMessage}</h1>
                    <StatusPill status={status} />
                    <div className="theme-toggle" aria-label="Theme">
                        <button
                            type="button"
                            className={`theme-toggle-btn ${
                                themeMode === "auto" ? "active" : ""
                            }`}
                            onClick={() => handleThemeClick("auto")}
                        >
                            Auto
                        </button>
                        <button
                            type="button"
                            className={`theme-toggle-btn ${
                                themeMode === "light" ? "active" : ""
                            }`}
                            onClick={() => handleThemeClick("light")}
                        >
                            Light
                        </button>
                        <button
                            type="button"
                            className={`theme-toggle-btn ${
                                themeMode === "dark" ? "active" : ""
                            }`}
                            onClick={() => handleThemeClick("dark")}
                        >
                            Dark
                        </button>
                    </div>
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
                        {session.messages.reduce((sum, m) => sum + m.toolCalls.length, 0)}
                    </span>
                </div>
            </div>
        </div>
    );
}

export default SessionHeader;
