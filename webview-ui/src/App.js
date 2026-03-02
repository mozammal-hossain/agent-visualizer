import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import Timeline from "./components/Timeline";
import SessionHeader from "./components/SessionHeader";
import OverviewTab from "./components/OverviewTab";
import HierarchyTab from "./components/HierarchyTab";
import FlowTab from "./components/FlowTab";
import ToolsTab from "./components/ToolsTab";
import TabBar from "./components/common/TabBar";
function getInitialTab() {
    const t = window.__INITIAL_TAB__;
    if (t === "overview" || t === "timeline" || t === "hierarchy" || t === "tools" || t === "flow") {
        return t;
    }
    return "overview";
}
function App({ session, statusOverride, themeMode, resolvedTheme, onThemeModeChange, }) {
    const [activeTab, setActiveTab] = useState(getInitialTab);
    const setActiveTabAndPersist = (tab) => {
        setActiveTab(tab);
        const api = window.__vscodeApi;
        if (api) {
            api.postMessage({ command: "setActiveTab", tab });
        }
    };
    const tabs = [
        { id: "overview", label: "Overview" },
        { id: "timeline", label: "Timeline" },
        { id: "hierarchy", label: "Hierarchy" },
        { id: "flow", label: "Flow" },
        { id: "tools", label: "Tools" },
    ];
    return (_jsxs("div", { className: `app-container theme-${resolvedTheme}`, children: [_jsx(SessionHeader, { session: session, statusOverride: statusOverride, themeMode: themeMode, onThemeModeChange: onThemeModeChange }), _jsx(TabBar, { tabs: tabs, activeTab: activeTab, onChange: setActiveTabAndPersist }), _jsxs("div", { className: "tab-content", children: [activeTab === "overview" && _jsx(OverviewTab, { session: session }), activeTab === "timeline" && _jsx(Timeline, { session: session }), activeTab === "hierarchy" && _jsx(HierarchyTab, { session: session }), activeTab === "flow" && _jsx(FlowTab, { session: session }), activeTab === "tools" && _jsx(ToolsTab, { session: session })] })] }));
}
export default App;
