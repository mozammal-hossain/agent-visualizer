import React, { useState } from "react";
import { Session } from "./types";
import Timeline from "./components/Timeline";
import SessionHeader from "./components/SessionHeader";

interface AppProps {
    session: Session;
}

function App({ session }: AppProps) {
    const [activeTab, setActiveTab] = useState("timeline");

    return (
        <div className="app-container">
            <SessionHeader session={session} />

            <div className="tabs">
                <button
                    className={`tab-button ${activeTab === "timeline" ? "active" : ""}`}
                    onClick={() => setActiveTab("timeline")}
                >
                    Timeline
                </button>
                <button
                    className={`tab-button ${activeTab === "hierarchy" ? "active" : ""}`}
                    onClick={() => setActiveTab("hierarchy")}
                    disabled
                >
                    Agent Hierarchy (Coming soon)
                </button>
                <button
                    className={`tab-button ${activeTab === "tools" ? "active" : ""}`}
                    onClick={() => setActiveTab("tools")}
                    disabled
                >
                    Tool Usage (Coming soon)
                </button>
                <button
                    className={`tab-button ${activeTab === "flow" ? "active" : ""}`}
                    onClick={() => setActiveTab("flow")}
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
