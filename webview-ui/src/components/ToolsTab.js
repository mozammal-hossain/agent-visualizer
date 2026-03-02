import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Card from "./common/Card";
import { formatToolLabel } from "../utils/toolLabel";
import Chip from "./common/Chip";
function getToolSummaries(session) {
    const counts = new Map();
    for (const message of session.messages) {
        for (const tc of message.toolCalls) {
            const label = formatToolLabel(tc);
            counts.set(label, (counts.get(label) ?? 0) + 1);
        }
    }
    return Array.from(counts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
function ToolsTab({ session }) {
    const summaries = getToolSummaries(session);
    if (summaries.length === 0) {
        return (_jsx("div", { className: "tools-empty", children: "This session did not use any tools." }));
    }
    return (_jsx("div", { className: "tools-container", children: _jsx(Card, { title: "Tool usage", children: _jsxs("table", { className: "tools-table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Tool" }), _jsx("th", { className: "tools-col-count", children: "Count" })] }) }), _jsx("tbody", { children: summaries.map((s) => (_jsxs("tr", { children: [_jsx("td", { children: s.name }), _jsx("td", { className: "tools-col-count", children: _jsx(Chip, { children: s.count }) })] }, s.name))) })] }) }) }));
}
export default ToolsTab;
