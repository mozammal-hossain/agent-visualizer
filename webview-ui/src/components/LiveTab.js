import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
function getLatestTurnMessages(session) {
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
function LiveTab({ session, onViewHistory }) {
    const containerRef = useRef(null);
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
        return (_jsx("div", { className: "live-container", children: _jsx("div", { className: "live-empty", children: "No messages yet. Send a prompt in Cursor to start a live session." }) }));
    }
    return (_jsxs("div", { className: "live-container", children: [_jsxs("div", { className: "live-header-row", children: [_jsxs("div", { className: "live-header-main", children: [_jsx("h2", { className: "live-title", children: "Live response" }), _jsx("p", { className: "live-subtitle", children: "Showing only the latest turn. Use full history to explore previous steps." })] }), onViewHistory && (_jsx("button", { type: "button", className: "live-history-link", onClick: onViewHistory, children: "View full history" }))] }), _jsxs("div", { className: "live-stream-wrapper", children: [_jsxs("div", { ref: containerRef, className: "live-stream", onScroll: handleScroll, children: [latestUser && (_jsx("div", { className: "live-message-row live-message-user", children: _jsxs("div", { className: "message-bubble user", children: [_jsx("div", { className: "message-role", children: "\uD83D\uDC64 You" }), _jsx("div", { className: "message-text", children: latestUser.text })] }) })), assistantMessages.map((message, idx) => (_jsx("div", { className: "live-message-row live-message-assistant", children: _jsxs("div", { className: "message-bubble assistant", children: [_jsx("div", { className: "message-role", children: "\uD83E\uDD16 Agent" }), _jsx("div", { className: "message-text", children: message.text })] }) }, idx)))] }), !autoScroll && (_jsx("button", { type: "button", className: "live-jump-bottom", onClick: handleJumpToBottom, children: "Jump to bottom" }))] })] }));
}
export default LiveTab;
