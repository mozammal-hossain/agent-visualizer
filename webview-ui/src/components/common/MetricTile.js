import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
function MetricTile({ label, value, description }) {
    return (_jsxs("div", { className: "av-metric-tile", children: [_jsx("div", { className: "av-metric-label", children: label }), _jsx("div", { className: "av-metric-value", children: value }), description && _jsx("div", { className: "av-metric-description", children: description })] }));
}
export default MetricTile;
