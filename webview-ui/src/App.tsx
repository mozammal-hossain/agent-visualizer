import React, { useState } from "react";
import { Session } from "./types";
import { SessionStatus } from "./utils/activityStatus";
import Timeline from "./components/Timeline";
import SessionHeader from "./components/SessionHeader";

interface AppProps {
    session: Session;
    statusOverride?: SessionStatus | null;
}

function getInitialTab(): string {
    const t = (window as any).__INITIAL_TAB__;
    if (t === "timeline" || t === "hierarchy" || t === "tools" || t === "flow") return t;
    return "timeline";
}

function App({ session, statusOverride }: AppProps) {
    const [activeTab, setActiveTab] = useState(getInitialTab);

    const setActiveTabAndPersist = (tab: string) => {
        setActiveTab(tab);
        const api = (window as any).__vscodeApi;
        if (api?.postMessage) {
            api.postMessage({ command: "setActiveTab", tab });
        }
    };

    return (
        <div className="app-container">
            <SessionHeader session={session} statusOverride={statusOverride} />

            <div className="tabs">
                <button
                    className={`tab-button ${activeTab === "timeline" ? "active" : ""}`}
                    onClick={() => setActiveTabAndPersist("timeline")}
                >
                    Timeline
                </button>
                <button
                    className={`tab-button ${activeTab === "hierarchy" ? "active" : ""}`}
                    onClick={() => setActiveTabAndPersist("hierarchy")}
                    disabled
                >
                    Agent Hierarchy (Coming soon)
                </button>
                <button
                    className={`tab-button ${activeTab === "tools" ? "active" : ""}`}
                    onClick={() => setActiveTabAndPersist("tools")}
                    disabled
                >
                    Tool Usage (Coming soon)
                </button>
                <button
                    className={`tab-button ${activeTab === "flow" ? "active" : ""}`}
                    onClick={() => setActiveTabAndPersist("flow")}
                    disabled
                >
                    Flow Diagram (Coming soon)
                </button>
            </div>

            <div className="tab-content">
                {activeTab === "timeline" && <Timeline session={session} />}
            </div>
        </div>
    );
}

export default App;
