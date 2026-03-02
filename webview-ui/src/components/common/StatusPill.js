import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const STATUS_CONFIG = {
    working: { label: "Working...", className: "status-working" },
    waiting: { label: "Waiting for input", className: "status-waiting" },
    idle: { label: "Idle", className: "status-idle" },
};
function StatusPill({ status }) {
    const { label, className } = STATUS_CONFIG[status];
    return (_jsxs("span", { className: `status-badge ${className}`, title: label, children: [_jsx("span", { className: "status-dot" }), label] }));
}
export default StatusPill;
