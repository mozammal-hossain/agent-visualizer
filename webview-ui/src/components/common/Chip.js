import { jsx as _jsx } from "react/jsx-runtime";
function Chip({ tone = "default", children }) {
    const toneClass = tone === "success" ? "av-chip-success" : tone === "warning" ? "av-chip-warning" : "";
    return _jsx("span", { className: `av-chip ${toneClass}`, children: children });
}
export default Chip;
