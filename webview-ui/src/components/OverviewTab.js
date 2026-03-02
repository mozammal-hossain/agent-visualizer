import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Card from "./common/Card";
import MetricTile from "./common/MetricTile";
function OverviewTab({ session }) {
    const totalMessages = session.messages.length;
    const totalToolCalls = session.messages.reduce((sum, m) => sum + m.toolCalls.length, 0);
    const userMessages = session.messages.filter((m) => m.role === "user").length;
    const assistantMessages = totalMessages - userMessages;
    const subagentCount = session.subagents?.length ?? 0;
    return (_jsxs("div", { className: "overview-layout", children: [_jsxs("div", { className: "overview-metrics", children: [_jsx(MetricTile, { label: "Messages", value: totalMessages, description: `${userMessages} user / ${assistantMessages} assistant` }), _jsx(MetricTile, { label: "Tool calls", value: totalToolCalls, description: totalToolCalls > 0 ? "Tools used in this run" : "No tools used" }), _jsx(MetricTile, { label: "Subagents", value: subagentCount, description: subagentCount > 0 ? "Background agents launched" : "No subagents launched" })] }), _jsxs("div", { className: "overview-main", children: [_jsx(Card, { title: "Session summary", children: _jsxs("div", { className: "overview-summary-text", children: [_jsx("div", { className: "overview-summary-label", children: "First instruction" }), _jsx("div", { className: "overview-summary-message", children: session.firstUserMessage })] }) }), totalToolCalls > 0 && (_jsx(Card, { title: "Notable details", children: _jsxs("ul", { className: "overview-list", children: [_jsxs("li", { children: ["This run includes ", totalToolCalls, " tool", totalToolCalls === 1 ? "" : "s", " across ", assistantMessages, " agent message", assistantMessages === 1 ? "" : "s", "."] }), subagentCount > 0 && (_jsxs("li", { children: [subagentCount, " subagent session(s) were spawned."] }))] }) }))] })] }));
}
export default OverviewTab;
