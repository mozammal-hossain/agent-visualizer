import React, { useState } from "react";
import { Session, ToolCall } from "../types";

interface TimelineProps {
    session: Session;
}

function Timeline({ session }: TimelineProps) {
    const [expandedToolCalls, setExpandedToolCalls] = useState<Set<number>>(
        new Set()
    );

    const toggleToolCall = (index: number) => {
        const newSet = new Set(expandedToolCalls);
        if (newSet.has(index)) {
            newSet.delete(index);
        } else {
            newSet.add(index);
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
                                    const isExpanded = expandedToolCalls.has(globalIndex as any);

                                    return (
                                        <div key={toolIndex} className="tool-call">
                                            <div
                                                className="tool-call-header"
                                                onClick={() =>
                                                    toggleToolCall(globalIndex as any)
                                                }
                                            >
                                                <span className="tool-icon">
                                                    {getToolIcon(toolCall.name)}
                                                </span>
                                                <span className="tool-name">{toolCall.name}</span>
                                                {toolCall.hasResult && (
                                                    <span className="result-badge">✓ Has Result</span>
                                                )}
                                                <span className="expand-icon">
                                                    {isExpanded ? "▼" : "▶"}
                                                </span>
                                            </div>

                                            {isExpanded && (
                                                <div className="tool-call-details">
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
