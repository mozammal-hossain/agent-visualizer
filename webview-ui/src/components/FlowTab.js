import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Card from "./common/Card";
import { formatToolLabel } from "../utils/toolLabel";
function FlowTab({ session }) {
    const steps = session.messages.map((message, index) => {
        const label = message.role === "user"
            ? `User message ${index + 1}`
            : `Agent response ${index + 1}`;
        const primaryTool = message.toolCalls.length > 0 ? formatToolLabel(message.toolCalls[0]) : null;
        return {
            id: `${index}`,
            label,
            primaryTool,
        };
    });
    return (_jsx("div", { className: "flow-container", children: _jsx(Card, { title: "Session flow", children: _jsx("div", { className: "flow-steps", children: steps.map((step, idx) => (_jsxs("div", { className: "flow-step-row", children: [_jsxs("div", { className: "flow-step-node", children: [_jsx("div", { className: "flow-step-index", children: idx + 1 }), _jsxs("div", { className: "flow-step-content", children: [_jsx("div", { className: "flow-step-label", children: step.label }), step.primaryTool && (_jsxs("div", { className: "flow-step-secondary", children: ["Primary tool: ", step.primaryTool] }))] })] }), idx < steps.length - 1 && (_jsx("div", { className: "flow-step-connector", "aria-hidden": "true", children: _jsx("span", { className: "flow-step-line" }) }))] }, step.id))) }) }) }));
}
export default FlowTab;
