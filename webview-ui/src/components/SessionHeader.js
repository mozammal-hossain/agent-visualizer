import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { deriveStatus } from "../utils/activityStatus";
import StatusPill from "./common/StatusPill";
function SessionHeader({ session, statusOverride, themeMode = "auto", onThemeModeChange, }) {
    const status = statusOverride ?? deriveStatus(session);
    const handleThemeClick = (mode) => {
        if (onThemeModeChange) {
            onThemeModeChange(mode);
        }
    };
    return (_jsx("div", { className: "session-header", children: _jsxs("div", { className: "header-content", children: [_jsxs("div", { className: "header-title-row", children: [_jsx("h1", { children: session.firstUserMessage }), _jsx(StatusPill, { status: status }), _jsxs("div", { className: "theme-toggle", "aria-label": "Theme", children: [_jsx("button", { type: "button", className: `theme-toggle-btn ${themeMode === "auto" ? "active" : ""}`, onClick: () => handleThemeClick("auto"), children: "Auto" }), _jsx("button", { type: "button", className: `theme-toggle-btn ${themeMode === "light" ? "active" : ""}`, onClick: () => handleThemeClick("light"), children: "Light" }), _jsx("button", { type: "button", className: `theme-toggle-btn ${themeMode === "dark" ? "active" : ""}`, onClick: () => handleThemeClick("dark"), children: "Dark" })] })] }), _jsxs("div", { className: "header-meta", children: [_jsxs("span", { className: "meta-item", children: [_jsx("strong", { children: "ID:" }), " ", session.id] }), _jsxs("span", { className: "meta-item", children: [_jsx("strong", { children: "Format:" }), " ", session.format] }), _jsxs("span", { className: "meta-item", children: [_jsx("strong", { children: "Messages:" }), " ", session.messages.length] }), _jsxs("span", { className: "meta-item", children: [_jsx("strong", { children: "Tool Calls:" }), " ", session.messages.reduce((sum, m) => sum + m.toolCalls.length, 0)] })] })] }) }));
}
export default SessionHeader;
