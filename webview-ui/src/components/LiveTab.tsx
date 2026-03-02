import React, { useEffect, useRef, useState } from "react";
import { Session, Message } from "../types";

interface LiveTabProps {
    session: Session;
    /**
     * Optional handler to switch to the full history view (Timeline tab).
     */
    onViewHistory?: () => void;
}

function getLatestTurnMessages(session: Session): Message[] {
    const messages = session.messages;
    if (messages.length === 0) {
        return [];
    }

    let lastUserIndex = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === "user") {
            lastUserIndex = i;
            break;
        }
    }

    const startIndex = lastUserIndex === -1 ? 0 : lastUserIndex;
    return messages.slice(startIndex);
}

function LiveTab({ session, onViewHistory }: LiveTabProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [autoScroll, setAutoScroll] = useState(true);

    const latestTurnMessages = getLatestTurnMessages(session);
    const [latestUser, ...assistantMessages] = latestTurnMessages;

    useEffect(() => {
        if (!autoScroll) {
            return;
        }
        const el = containerRef.current;
        if (!el) {
            return;
        }
        el.scrollTop = el.scrollHeight;
    }, [session.messages.length, autoScroll]);

    const handleScroll = () => {
        const el = containerRef.current;
        if (!el) {
            return;
        }
        const distanceFromBottom = el.scrollHeight - el.clientHeight - el.scrollTop;
        const nearBottomThreshold = 40;
        setAutoScroll(distanceFromBottom <= nearBottomThreshold);
    };

    const handleJumpToBottom = () => {
        const el = containerRef.current;
        if (!el) {
            return;
        }
        el.scrollTop = el.scrollHeight;
        setAutoScroll(true);
    };

    if (!latestTurnMessages.length) {
        return (
            <div className="live-container">
                <div className="live-empty">
                    No messages yet. Send a prompt in Cursor to start a live session.
                </div>
            </div>
        );
    }

    return (
        <div className="live-container">
            <div className="live-header-row">
                <div className="live-header-main">
                    <h2 className="live-title">Live response</h2>
                    <p className="live-subtitle">
                        Showing only the latest turn. Use full history to explore previous steps.
                    </p>
                </div>
                {onViewHistory && (
                    <button
                        type="button"
                        className="live-history-link"
                        onClick={onViewHistory}
                    >
                        View full history
                    </button>
                )}
            </div>

            <div className="live-stream-wrapper">
                <div
                    ref={containerRef}
                    className="live-stream"
                    onScroll={handleScroll}
                >
                    {latestUser && (
                        <div className="live-message-row live-message-user">
                            <div className="message-bubble user">
                                <div className="message-role">👤 You</div>
                                <div className="message-text">{latestUser.text}</div>
                            </div>
                        </div>
                    )}

                    {assistantMessages.map((message, idx) => (
                        <div
                            key={idx}
                            className="live-message-row live-message-assistant"
                        >
                            <div className="message-bubble assistant">
                                <div className="message-role">🤖 Agent</div>
                                <div className="message-text">{message.text}</div>
                            </div>
                        </div>
                    ))}
                </div>

                {!autoScroll && (
                    <button
                        type="button"
                        className="live-jump-bottom"
                        onClick={handleJumpToBottom}
                    >
                        Jump to bottom
                    </button>
                )}
            </div>
        </div>
    );
}

export default LiveTab;

