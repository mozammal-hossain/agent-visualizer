import { jsx as _jsx } from "react/jsx-runtime";
function TabBar({ tabs, activeTab, onChange }) {
    return (_jsx("div", { className: "tabs", children: tabs.map((tab) => (_jsx("button", { type: "button", className: `tab-button ${activeTab === tab.id ? "active" : ""}`, onClick: () => onChange(tab.id), children: tab.label }, tab.id))) }));
}
export default TabBar;
