import React, { useState } from "react";
import { Session } from "./types";
import { SessionStatus } from "./utils/activityStatus";
import Timeline from "./components/Timeline";
import SessionHeader from "./components/SessionHeader";
import OverviewTab from "./components/OverviewTab";
import HierarchyTab from "./components/HierarchyTab";
import FlowTab from "./components/FlowTab";
import ToolsTab from "./components/ToolsTab";
import TabBar, { TabId, TabDefinition } from "./components/common/TabBar";
import { ThemeMode, ResolvedTheme } from "./theme";

interface AppProps {
    session: Session;
    statusOverride?: SessionStatus | null;
    themeMode: ThemeMode;
    resolvedTheme: ResolvedTheme;
    onThemeModeChange?: (mode: ThemeMode) => void;
}

function getInitialTab(): TabId {
    const t = window.__INITIAL_TAB__;
    if (t === "overview" || t === "timeline" || t === "hierarchy" || t === "tools" || t === "flow") {
        return t;
    }
    return "overview";
}

function App({
    session,
    statusOverride,
    themeMode,
    resolvedTheme,
    onThemeModeChange,
}: AppProps) {
    const [activeTab, setActiveTab] = useState<TabId>(getInitialTab);

    const setActiveTabAndPersist = (tab: TabId) => {
        setActiveTab(tab);
        const api = window.__vscodeApi;
        if (api) {
            api.postMessage({ command: "setActiveTab", tab });
        }
    };

    const tabs: TabDefinition[] = [
        { id: "overview", label: "Overview" },
        { id: "timeline", label: "Timeline" },
        { id: "hierarchy", label: "Hierarchy" },
        { id: "flow", label: "Flow" },
        { id: "tools", label: "Tools" },
    ];

    return (
        <div className={`app-container theme-${resolvedTheme}`}>
            <SessionHeader
                session={session}
                statusOverride={statusOverride}
                themeMode={themeMode}
                onThemeModeChange={onThemeModeChange}
            />

            <TabBar tabs={tabs} activeTab={activeTab} onChange={setActiveTabAndPersist} />

            <div className="tab-content">
                {activeTab === "overview" && <OverviewTab session={session} />}
                {activeTab === "timeline" && <Timeline session={session} />}
                {activeTab === "hierarchy" && <HierarchyTab session={session} />}
                {activeTab === "flow" && <FlowTab session={session} />}
                {activeTab === "tools" && <ToolsTab session={session} />}
            </div>
        </div>
    );
}

export default App;
