import React, { useState } from "react";
import { Session, ToolCall, Message } from "../types";
import { formatToolLabel } from "../utils/toolLabel";

interface TimelineProps {
    session: Session;
}

interface TimelineStep {
    id: string;
    userMessage: Message | null;
    assistantMessages: Message[];
    startIndex: number;
    endIndex: number;
    toolCallCount: number;
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
    const messages = session.messages ?? [];
    let taskCount = 0;
    for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        const toolCalls = msg.toolCalls ?? [];
        for (let j = 0; j < toolCalls.length; j++) {
            if (isTaskTool(toolCalls[j])) {
                if (i === msgIndex && j === toolIndex) {
                    return (session.subagents ?? [])[taskCount] ?? null;
                }
                taskCount++;
            }
        }
    }
    return null;
}

function buildSteps(session: Session): TimelineStep[] {
    const steps: TimelineStep[] = [];

    let currentUser: Message | null = null;
    let assistants: Message[] = [];
    let startIndex = 0;

    const flushStep = (endIndex: number) => {
        if (!currentUser && assistants.length === 0) {
            return;
        }
        const allMessages: Message[] = [];
        if (currentUser) {
            allMessages.push(currentUser);
        }
        allMessages.push(...assistants);

        const toolCallCount = allMessages.reduce(
            (sum, m) => sum + (m.toolCalls?.length ?? 0),
            0
        );

        const stepIndex = steps.length;
        steps.push({
            id: String(stepIndex),
            userMessage: currentUser,
            assistantMessages: assistants,
            startIndex,
            endIndex,
            toolCallCount,
        });
    };

    (session.messages ?? []).forEach((message, index) => {
        if (message.role === "user") {
            if (currentUser || assistants.length > 0) {
                flushStep(index - 1);
                assistants = [];
            }
            currentUser = message;
            startIndex = index;
        } else {
            if (!currentUser && steps.length === 0 && assistants.length === 0) {
                // Session starts with assistant messages – treat as their own step.
                currentUser = null;
                assistants = [message];
                startIndex = index;
            } else {
                assistants.push(message);
            }
        }
    });

    if (currentUser || assistants.length > 0) {
        flushStep((session.messages?.length ?? 1) - 1);
    }

    return steps;
}

function getStepTitle(step: TimelineStep, index: number): string {
    const base = `Step ${index + 1}`;
    const sourceText =
        step.userMessage?.text ??
        step.assistantMessages[0]?.text ??
        "";
    if (!sourceText) {
        return base;
    }
    const trimmed = sourceText.trim().replace(/\s+/g, " ");
    if (trimmed.length <= 80) {
        return `${base} – ${trimmed}`;
    }
    return `${base} – ${trimmed.slice(0, 77)}...`;
}

function Timeline({ session }: TimelineProps) {
    const steps = buildSteps(session);
    const [expandedSteps, setExpandedSteps] = useState<Set<string>>(
        () => new Set(steps.map((s) => s.id))
    );
    const [expandedToolCalls, setExpandedToolCalls] = useState<Set<string>>(
        new Set()
    );

    const openSubagent = (sessionId: string) => {
        const api = window.__vscodeApi;
        if (api) {
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

    const toggleStep = (id: string) => {
        const next = new Set(expandedSteps);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        setExpandedSteps(next);
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
            {steps.map((step, stepIndex) => {
                const isExpanded = expandedSteps.has(step.id);

                const messagesInStep: { message: Message; globalIndex: number }[] = [];
                let offset = 0;
                if (step.userMessage) {
                    messagesInStep.push({
                        message: step.userMessage,
                        globalIndex: step.startIndex,
                    });
                    offset = 1;
                }
                step.assistantMessages.forEach((m, idx) => {
                    messagesInStep.push({
                        message: m,
                        globalIndex: step.startIndex + offset + idx,
                    });
                });

                const panelId = `timeline-step-panel-${step.id}`;

                return (
                    <div key={step.id} className="timeline-step">
                        <button
                            type="button"
                            className="timeline-step-header"
                            onClick={() => toggleStep(step.id)}
                            aria-expanded={isExpanded}
                            aria-controls={panelId}
                        >
                            <div className="timeline-step-header-main">
                                <div className="timeline-step-title">
                                    {getStepTitle(step, stepIndex)}
                                </div>
                                <div className="timeline-step-meta">
                                    <span>
                                        {messagesInStep.length} message
                                        {messagesInStep.length === 1 ? "" : "s"}
                                    </span>
                                    <span>
                                        {step.toolCallCount} tool call
                                        {step.toolCallCount === 1 ? "" : "s"}
                                    </span>
                                </div>
                            </div>
                            <span className="timeline-step-expand-icon">
                                {isExpanded ? "▼" : "▶"}
                            </span>
                        </button>

                        {isExpanded && (
                            <div id={panelId} className="timeline-step-body">
                                {messagesInStep.map(({ message, globalIndex }) => (
                                    <div
                                        key={globalIndex}
                                        className={`timeline-message ${message.role}`}
                                    >
                                        <div className="timeline-marker"></div>
                                        <div className="timeline-content">
                                            <div className={`message-bubble ${message.role}`}>
                                                <div className="message-role">
                                                    {message.role === "user" ? "👤 You" : "🤖 Agent"}
                                                </div>
                                                <div className="message-text">{message.text}</div>
                                            </div>

                                            {(message.toolCalls?.length ?? 0) > 0 && (
                                                <div className="tool-calls-container">
                                                    {(message.toolCalls ?? []).map((toolCall, toolIndex) => {
                                                        const globalKey = `${globalIndex}-${toolIndex}`;
                                                        const isToolExpanded =
                                                            expandedToolCalls.has(globalKey);
                                                        const isSubagent = isTaskTool(toolCall);
                                                        const subagent = isSubagent
                                                            ? getSubagentForTaskCall(
                                                                  session,
                                                                  globalIndex,
                                                                  toolIndex
                                                              )
                                                            : null;

                                                        return (
                                                            <div
                                                                key={toolIndex}
                                                                className={`tool-call ${
                                                                    isSubagent
                                                                        ? "tool-call-subagent"
                                                                        : ""
                                                                }`}
                                                            >
                                                                <div
                                                                    className="tool-call-header"
                                                                    onClick={() =>
                                                                        toggleToolCall(globalKey)
                                                                    }
                                                                >
                                                                    <span className="tool-icon">
                                                                        {isSubagent
                                                                            ? "🔀"
                                                                            : getToolIcon(
                                                                                  toolCall.name
                                                                              )}
                                                                    </span>
                                                                    <span className="tool-name">
                                                                        {formatToolLabel(toolCall)}
                                                                    </span>
                                                                    {subagent && (
                                                                        <button
                                                                            type="button"
                                                                            className="open-subagent-btn"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                openSubagent(
                                                                                    subagent.id
                                                                                );
                                                                            }}
                                                                            title={`Open subagent: ${subagent.firstUserMessage}`}
                                                                        >
                                                                            Open subagent
                                                                        </button>
                                                                    )}
                                                                    {toolCall.hasResult && (
                                                                        <span className="result-badge">
                                                                            ✓ Has Result
                                                                        </span>
                                                                    )}
                                                                    <span className="expand-icon">
                                                                        {isToolExpanded
                                                                            ? "▼"
                                                                            : "▶"}
                                                                    </span>
                                                                </div>

                                                                {isToolExpanded && (
                                                                    <div className="tool-call-details">
                                                                        {subagent && (
                                                                            <div className="subagent-info">
                                                                                <div className="subagent-preview">
                                                                                    {
                                                                                        subagent.firstUserMessage
                                                                                    }
                                                                                </div>
                                                                                <button
                                                                                    type="button"
                                                                                    className="open-subagent-btn-inline"
                                                                                    onClick={() =>
                                                                                        openSubagent(
                                                                                            subagent.id
                                                                                        )
                                                                                    }
                                                                                >
                                                                                    Open subagent
                                                                                    session →
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                        <div className="params-section">
                                                                            <h4>Parameters:</h4>
                                                                            <div className="params-list">
                                                                                {Object.entries(
                                                                                    toolCall.parameters
                                                                                ).map(
                                                                                    ([
                                                                                        key,
                                                                                        value,
                                                                                    ]) => (
                                                                                        <div
                                                                                            key={key}
                                                                                            className="param-item"
                                                                                        >
                                                                                            <span className="param-key">
                                                                                                {key}:
                                                                                            </span>
                                                                                            <span className="param-value">
                                                                                                {
                                                                                                    value
                                                                                                }
                                                                                            </span>
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
                        )}
                    </div>
                );
            })}
        </div>
    );
}

export default Timeline;
