import React, { useState } from "react";
import { Session, ToolCall } from "../types";
import { formatToolLabel } from "../utils/toolLabel";

interface TimelineProps {
    session: Session;
}

function isTaskTool(toolCall: ToolCall): boolean {
    const n = toolCall.name.toLowerCase();
    return n.includes("task") || n === "mcp_task";
}

function getSubagentForTaskCall(
    session: Session,
    msgIndex: number,
    toolIndex: number
): Session | null {
    let taskCount = 0;
    for (let i = 0; i < session.messages.length; i++) {
        const msg = session.messages[i];
        for (let j = 0; j < msg.toolCalls.length; j++) {
            if (isTaskTool(msg.toolCalls[j])) {
                if (i === msgIndex && j === toolIndex) {
                    return session.subagents?.[taskCount] ?? null;
                }
                taskCount++;
            }
        }
    }
    return null;
}

function Timeline({ session }: TimelineProps) {
    const [expandedToolCalls, setExpandedToolCalls] = useState<Set<string>>(
        new Set()
    );

    const openSubagent = (sessionId: string) => {
        const api = (window as any).__vscodeApi;
        if (api?.postMessage) {
            api.postMessage({ command: "openSession", sessionId });
        }
    };

    const toggleToolCall = (key: string) => {
        const newSet = new Set(expandedToolCalls);
        if (newSet.has(key)) {
            newSet.delete(key);
        } else {
            newSet.add(key);
        }
        setExpandedToolCalls(newSet);
    };

    const getToolIcon = (toolName: string): string => {
        const name = toolName.toLowerCase();
        if (name.includes("read")) return "📖";
        if (name.includes("write") || name.includes("create") || name.includes("replace"))
            return "✏️";
        if (name.includes("shell") || name.includes("exec")) return "💻";
        if (name.includes("grep") || name.includes("search")) return "🔍";
        if (name.includes("find")) return "🔎";
        return "🔧";
    };

    return (
        <div className="timeline-container">
            {session.messages.map((message, msgIndex) => (
                <div key={msgIndex} className={`timeline-message ${message.role}`}>
                    <div className="timeline-marker"></div>
                    <div className="timeline-content">
                        <div className={`message-bubble ${message.role}`}>
                            <div className="message-role">
                                {message.role === "user" ? "👤 You" : "🤖 Agent"}
                            </div>
                            <div className="message-text">{message.text}</div>
                        </div>

                        {message.toolCalls.length > 0 && (
                            <div className="tool-calls-container">
                                {message.toolCalls.map((toolCall, toolIndex) => {
                                    const globalIndex = `${msgIndex}-${toolIndex}`;
                                    const isExpanded = expandedToolCalls.has(globalIndex);
                                    const isSubagent = isTaskTool(toolCall);
                                    const subagent = isSubagent
                                        ? getSubagentForTaskCall(session, msgIndex, toolIndex)
                                        : null;

                                    return (
                                        <div
                                            key={toolIndex}
                                            className={`tool-call ${isSubagent ? "tool-call-subagent" : ""}`}
                                        >
                                            <div
                                                className="tool-call-header"
                                                onClick={() =>
                                                    toggleToolCall(globalIndex)
                                                }
                                            >
                                                <span className="tool-icon">
                                                    {isSubagent ? "🔀" : getToolIcon(toolCall.name)}
                                                </span>
                                                <span className="tool-name">{formatToolLabel(toolCall)}</span>
                                                {subagent && (
                                                    <button
                                                        type="button"
                                                        className="open-subagent-btn"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            openSubagent(subagent.id);
                                                        }}
                                                        title={`Open subagent: ${subagent.firstUserMessage}`}
                                                    >
                                                        Open subagent
                                                    </button>
                                                )}
                                                {toolCall.hasResult && (
                                                    <span className="result-badge">✓ Has Result</span>
                                                )}
                                                <span className="expand-icon">
                                                    {isExpanded ? "▼" : "▶"}
                                                </span>
                                            </div>

                                            {isExpanded && (
                                                <div className="tool-call-details">
                                                    {subagent && (
                                                        <div className="subagent-info">
                                                            <div className="subagent-preview">
                                                                {subagent.firstUserMessage}
                                                            </div>
                                                            <button
                                                                type="button"
                                                                className="open-subagent-btn-inline"
                                                                onClick={() => openSubagent(subagent.id)}
                                                            >
                                                                Open subagent session →
                                                            </button>
                                                        </div>
                                                    )}
                                                    <div className="params-section">
                                                        <h4>Parameters:</h4>
                                                        <div className="params-list">
                                                            {Object.entries(toolCall.parameters).map(
                                                                ([key, value]) => (
                                                                    <div key={key} className="param-item">
                                                                        <span className="param-key">{key}:</span>
                                                                        <span className="param-value">{value}</span>
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}

export default Timeline;
