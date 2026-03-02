import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useRef, useMemo } from "react";
import * as d3 from "d3";
function sessionToNode(session) {
    return {
        session,
        children: session.subagents?.length > 0
            ? session.subagents.map(sessionToNode)
            : undefined,
    };
}
const LABEL_MAX_LEN = 40;
function truncateLabel(text) {
    if (text.length <= LABEL_MAX_LEN)
        return text;
    return text.slice(0, LABEL_MAX_LEN - 3) + "...";
}
function getNodeRadius(messageCount) {
    const r = 3 + Math.sqrt(Math.min(messageCount, 100)) * 2;
    return Math.min(r, 24);
}
const MARGIN = { top: 40, right: 120, bottom: 40, left: 120 };
const NODE_SPACING_X = 180;
const NODE_SPACING_Y = 80;
function HierarchyTab({ session }) {
    const svgRef = useRef(null);
    const containerRef = useRef(null);
    const hasSubagents = (session.subagents?.length ?? 0) > 0;
    const root = useMemo(() => {
        if (!hasSubagents)
            return null;
        const data = sessionToNode(session);
        return d3.hierarchy(data, (d) => d.children ?? []);
    }, [session, hasSubagents]);
    useEffect(() => {
        if (!root || !svgRef.current || !containerRef.current)
            return;
        const container = containerRef.current;
        const width = Math.max(container.clientWidth, 400);
        const height = Math.max(container.clientHeight, 300);
        const treeLayout = d3
            .tree()
            .size([width - MARGIN.left - MARGIN.right, height - MARGIN.top - MARGIN.bottom])
            .separation((a, b) => (a.parent === b.parent ? 1.2 : 1.4));
        treeLayout(root);
        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();
        const g = svg
            .attr("width", width)
            .attr("height", height)
            .append("g")
            .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);
        const nodes = root.descendants();
        const links = root.links();
        g.selectAll(".link")
            .data(links)
            .join("path")
            .attr("class", "hierarchy-link")
            .attr("d", d3
            .linkVertical()
            .x((d) => d.x)
            .y((d) => d.y))
            .attr("fill", "none")
            .attr("stroke", "var(--color-border)")
            .attr("stroke-width", 1.5);
        const nodeGroup = g
            .selectAll(".node")
            .data(nodes)
            .join("g")
            .attr("class", "hierarchy-d3-node")
            .attr("transform", (d) => `translate(${d.x},${d.y})`);
        nodeGroup.each(function (d) {
            const el = d3.select(this);
            const s = d.data.session;
            const msgCount = s.messages.length;
            const r = getNodeRadius(msgCount);
            el.append("circle")
                .attr("r", r)
                .attr("fill", "var(--color-user-message)")
                .attr("stroke", "var(--color-border)")
                .attr("stroke-width", 1.5);
            el.append("text")
                .attr("dy", r + 14)
                .attr("text-anchor", "middle")
                .attr("fill", "var(--color-text-primary)")
                .attr("font-size", "11px")
                .attr("class", "hierarchy-node-label")
                .text(truncateLabel(s.firstUserMessage || s.id))
                .style("pointer-events", "none")
                .clone(true)
                .lower()
                .attr("fill", "var(--color-bg-primary)")
                .attr("stroke", "var(--color-bg-primary)")
                .attr("stroke-width", 3);
            el.style("cursor", "pointer").on("click", () => {
                const api = window.__vscodeApi;
                if (api) {
                    api.postMessage({ command: "openSession", sessionId: s.id });
                }
            });
        });
    }, [root, hasSubagents]);
    if (!hasSubagents) {
        return (_jsx("div", { className: "hierarchy-empty", children: "This session does not have any subagents." }));
    }
    return (_jsx("div", { className: "hierarchy-container hierarchy-d3-container", ref: containerRef, children: _jsx("svg", { ref: svgRef, className: "hierarchy-d3-svg" }) }));
}
export default HierarchyTab;
