import React from "react";

export type TabId = "overview" | "timeline" | "hierarchy" | "flow" | "tools";

export interface TabDefinition {
    id: TabId;
    label: string;
}

interface TabBarProps {
    tabs: TabDefinition[];
    activeTab: TabId;
    onChange(tab: TabId): void;
}

function TabBar({ tabs, activeTab, onChange }: TabBarProps) {
    return (
        <div className="tabs">
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    type="button"
                    className={`tab-button ${activeTab === tab.id ? "active" : ""}`}
                    onClick={() => onChange(tab.id)}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    );
}

export default TabBar;

