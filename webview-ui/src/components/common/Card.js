import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
function Card({ title, icon, headerExtra, className = "", children }) {
    const hasHeader = title || icon || headerExtra;
    return (_jsxs("div", { className: `av-card ${className}`, children: [hasHeader && (_jsxs("div", { className: "av-card-header", children: [_jsxs("div", { className: "av-card-title", children: [icon && _jsx("span", { className: "av-card-icon", children: icon }), title && _jsx("span", { className: "av-card-title-text", children: title })] }), headerExtra && _jsx("div", { className: "av-card-header-extra", children: headerExtra })] })), _jsx("div", { className: "av-card-body", children: children })] }));
}
export default Card;
