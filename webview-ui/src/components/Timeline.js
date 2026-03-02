import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { formatToolLabel } from "../utils/toolLabel";
function isTaskTool(toolCall) {
    const n = toolCall.name.toLowerCase();
    return n.includes("task") || n === "mcp_task";
}
function getSubagentForTaskCall(session, msgIndex, toolIndex) {
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
function buildSteps(session) {
    const steps = [];
    let currentUser = null;
    let assistants = [];
    let startIndex = 0;
    const flushStep = (endIndex) => {
        if (!currentUser && assistants.length === 0) {
            return;
        }
        const allMessages = [];
        if (currentUser) {
            allMessages.push(currentUser);
        }
        allMessages.push(...assistants);
        const toolCallCount = allMessages.reduce((sum, m) => sum + m.toolCalls.length, 0);
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
    session.messages.forEach((message, index) => {
        if (message.role === "user") {
            if (currentUser || assistants.length > 0) {
                flushStep(index - 1);
                assistants = [];
            }
            currentUser = message;
            startIndex = index;
        }
        else {
            if (!currentUser && steps.length === 0 && assistants.length === 0) {
                // Session starts with assistant messages – treat as their own step.
                currentUser = null;
                assistants = [message];
                startIndex = index;
            }
            else {
                assistants.push(message);
            }
        }
    });
    if (currentUser || assistants.length > 0) {
        flushStep(session.messages.length - 1);
    }
    return steps;
}
function getStepTitle(step, index) {
    const base = `Step ${index + 1}`;
    const sourceText = step.userMessage?.text ??
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
function Timeline({ session }) {
    const steps = buildSteps(session);
    const [expandedSteps, setExpandedSteps] = useState(() => new Set(steps.map((s) => s.id)));
    const [expandedToolCalls, setExpandedToolCalls] = useState(new Set());
    const openSubagent = (sessionId) => {
        const api = window.__vscodeApi;
        if (api) {
            api.postMessage({ command: "openSession", sessionId });
        }
    };
    const toggleToolCall = (key) => {
        const newSet = new Set(expandedToolCalls);
        if (newSet.has(key)) {
            newSet.delete(key);
        }
        else {
            newSet.add(key);
        }
        setExpandedToolCalls(newSet);
    };
    const toggleStep = (id) => {
        const next = new Set(expandedSteps);
        if (next.has(id)) {
            next.delete(id);
        }
        else {
            next.add(id);
        }
        setExpandedSteps(next);
    };
    const getToolIcon = (toolName) => {
        const name = toolName.toLowerCase();
        if (name.includes("read"))
            return "📖";
        if (name.includes("write") || name.includes("create") || name.includes("replace"))
            return "✏️";
        if (name.includes("shell") || name.includes("exec"))
            return "💻";
        if (name.includes("grep") || name.includes("search"))
            return "🔍";
        if (name.includes("find"))
            return "🔎";
        return "🔧";
    };
    return (_jsx("div", { className: "timeline-container", children: steps.map((step, stepIndex) => {
            const isExpanded = expandedSteps.has(step.id);
            const messagesInStep = [];
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
            return (_jsxs("div", { className: "timeline-step", children: [_jsxs("button", { type: "button", className: "timeline-step-header", onClick: () => toggleStep(step.id), "aria-expanded": isExpanded, "aria-controls": panelId, children: [_jsxs("div", { className: "timeline-step-header-main", children: [_jsx("div", { className: "timeline-step-title", children: getStepTitle(step, stepIndex) }), _jsxs("div", { className: "timeline-step-meta", children: [_jsxs("span", { children: [messagesInStep.length, " message", messagesInStep.length === 1 ? "" : "s"] }), _jsxs("span", { children: [step.toolCallCount, " tool call", step.toolCallCount === 1 ? "" : "s"] })] })] }), _jsx("span", { className: "timeline-step-expand-icon", children: isExpanded ? "▼" : "▶" })] }), isExpanded && (_jsx("div", { id: panelId, className: "timeline-step-body", children: messagesInStep.map(({ message, globalIndex }) => (_jsxs("div", { className: `timeline-message ${message.role}`, children: [_jsx("div", { className: "timeline-marker" }), _jsxs("div", { className: "timeline-content", children: [_jsxs("div", { className: `message-bubble ${message.role}`, children: [_jsx("div", { className: "message-role", children: message.role === "user" ? "👤 You" : "🤖 Agent" }), _jsx("div", { className: "message-text", children: message.text })] }), message.toolCalls.length > 0 && (_jsx("div", { className: "tool-calls-container", children: message.toolCalls.map((toolCall, toolIndex) => {
                                                const globalKey = `${globalIndex}-${toolIndex}`;
                                                const isToolExpanded = expandedToolCalls.has(globalKey);
                                                const isSubagent = isTaskTool(toolCall);
                                                const subagent = isSubagent
                                                    ? getSubagentForTaskCall(session, globalIndex, toolIndex)
                                                    : null;
                                                return (_jsxs("div", { className: `tool-call ${isSubagent
                                                        ? "tool-call-subagent"
                                                        : ""}`, children: [_jsxs("div", { className: "tool-call-header", onClick: () => toggleToolCall(globalKey), children: [_jsx("span", { className: "tool-icon", children: isSubagent
                                                                        ? "🔀"
                                                                        : getToolIcon(toolCall.name) }), _jsx("span", { className: "tool-name", children: formatToolLabel(toolCall) }), subagent && (_jsx("button", { type: "button", className: "open-subagent-btn", onClick: (e) => {
                                                                        e.stopPropagation();
                                                                        openSubagent(subagent.id);
                                                                    }, title: `Open subagent: ${subagent.firstUserMessage}`, children: "Open subagent" })), toolCall.hasResult && (_jsx("span", { className: "result-badge", children: "\u2713 Has Result" })), _jsx("span", { className: "expand-icon", children: isToolExpanded
                                                                        ? "▼"
                                                                        : "▶" })] }), isToolExpanded && (_jsxs("div", { className: "tool-call-details", children: [subagent && (_jsxs("div", { className: "subagent-info", children: [_jsx("div", { className: "subagent-preview", children: subagent.firstUserMessage }), _jsx("button", { type: "button", className: "open-subagent-btn-inline", onClick: () => openSubagent(subagent.id), children: "Open subagent session \u2192" })] })), _jsxs("div", { className: "params-section", children: [_jsx("h4", { children: "Parameters:" }), _jsx("div", { className: "params-list", children: Object.entries(toolCall.parameters).map(([key, value,]) => (_jsxs("div", { className: "param-item", children: [_jsxs("span", { className: "param-key", children: [key, ":"] }), _jsx("span", { className: "param-value", children: value })] }, key))) })] })] }))] }, toolIndex));
                                            }) }))] })] }, globalIndex))) }))] }, step.id));
        }) }));
}
export default Timeline;
