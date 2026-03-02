import { useEffect, useRef, useMemo, useState } from "react";
import * as d3 from "d3";
import { Session } from "../types";
import { Message } from "../types";
import { ToolCall } from "../types";
import { formatToolLabel } from "../utils/toolLabel";

interface FlowTabProps {
    session: Session;
}

const TOOL_TYPE_COLORS: Record<string, string> = {
    Read: "#4ec9b0",
    Write: "#ce9178",
    Shell: "#c586c0",
    Grep: "#569cd6",
    Other: "#858585",
};

function getToolType(name: string): string {
    const n = name.toLowerCase();
    if (n.includes("read")) return "Read";
    if (n.includes("write") || n.includes("create") || n.includes("replace"))
        return "Write";
    if (n.includes("shell") || n.includes("exec")) return "Shell";
    if (n.includes("grep") || n.includes("search")) return "Grep";
    return "Other";
}

const LABEL_MAX_LEN = 24;

function truncateLabel(text: string): string {
    if (!text || text.length <= LABEL_MAX_LEN) return text || "";
    return text.slice(0, LABEL_MAX_LEN - 3) + "...";
}

interface FlowNode {
    id: string;
    type: "user" | "assistant" | "tool";
    label: string;
    toolType?: string;
    messageIndex?: number;
    toolIndex?: number;
    toolCall?: ToolCall;
    message?: Message;
}

interface FlowLink {
    source: string;
    target: string;
}

function buildGraph(session: Session): { nodes: FlowNode[]; links: FlowLink[] } {
    const nodes: FlowNode[] = [];
    const links: FlowLink[] = [];
    const messages = session.messages ?? [];

    for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        const msgId = `msg-${i}`;
        const role = msg.role as "user" | "assistant";

        const label =
            role === "user"
                ? `User ${i + 1}`
                : `Agent ${i + 1}`;
        nodes.push({
            id: msgId,
            type: role,
            label,
            messageIndex: i,
            message: msg,
        });

        if (i > 0) {
            const prevMsg = messages[i - 1];
            const prevHasTools = prevMsg.toolCalls?.length > 0;
            const prevId = prevHasTools
                ? `tool-${i - 1}-${prevMsg.toolCalls.length - 1}`
                : `msg-${i - 1}`;
            links.push({ source: prevId, target: msgId });
        }

        if (role === "assistant" && msg.toolCalls?.length > 0) {
            const toolCalls = msg.toolCalls;
            for (let t = 0; t < toolCalls.length; t++) {
                const tc = toolCalls[t];
                const toolId = `tool-${i}-${t}`;
                const toolType = getToolType(tc.name);
                nodes.push({
                    id: toolId,
                    type: "tool",
                    label: truncateLabel(formatToolLabel(tc)),
                    toolType,
                    messageIndex: i,
                    toolIndex: t,
                    toolCall: tc,
                });
                links.push({ source: msgId, target: toolId });
                if (t > 0) {
                    links.push({
                        source: `tool-${i}-${t - 1}`,
                        target: toolId,
                    });
                }
            }
        }
    }

    return { nodes, links };
}

const NODE_R = 20;
const MARGIN = 40;

function FlowTab({ session }: FlowTabProps) {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 600, height: 400 });

    const graph = useMemo(() => buildGraph(session), [session]);
    const { nodes: graphNodes, links: graphLinks } = graph;

    const hasMessages = (session.messages?.length ?? 0) > 0;

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const onResize = () => {
            setDimensions({
                width: Math.max(el.clientWidth, 400),
                height: Math.max(el.clientHeight, 300),
            });
        };
        onResize();
        const ro = new ResizeObserver(onResize);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    useEffect(() => {
        if (!hasMessages || graphNodes.length === 0 || !svgRef.current || !containerRef.current) return;

        const width = dimensions.width;
        const height = dimensions.height;

        const nodes = graphNodes.map((d) => ({ ...d }));
        const links = graphLinks.map((d) => ({
            ...d,
            source: d.source,
            target: d.target,
        }));

        const nodeById = new Map(nodes.map((n) => [n.id, n]));

        const d3Links = links.map((l) => ({
            source: nodeById.get(l.source)!,
            target: nodeById.get(l.target)!,
        })).filter((l) => l.source && l.target);

        const simulation = d3
            .forceSimulation(nodes)
            .force(
                "link",
                d3
                    .forceLink(d3Links)
                    .id((d: FlowNode) => d.id)
                    .distance(80)
            )
            .force("charge", d3.forceManyBody().strength(-200))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("x", d3.forceX(width / 2).strength(0.05))
            .force("y", d3.forceY(height / 2).strength(0.05));

        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();

        svg.append("defs")
            .append("marker")
            .attr("id", "flow-arrow")
            .attr("viewBox", "0 -5 10 10")
            .attr("refX", 22)
            .attr("refY", 0)
            .attr("markerWidth", 6)
            .attr("markerHeight", 6)
            .attr("orient", "auto")
            .append("path")
            .attr("d", "M0,-5L10,0L0,5")
            .attr("fill", "var(--color-border)");

        const g = svg
            .attr("width", width)
            .attr("height", height)
            .append("g")
            .attr("class", "flow-d3-zoom-group");

        const zoom = d3
            .zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.3, 3])
            .on("zoom", (event) => {
                g.attr("transform", event.transform);
            });
        svg.call(zoom);

        const linkGroup = g.append("g").attr("class", "flow-d3-links");
        const nodeGroup = g.append("g").attr("class", "flow-d3-nodes");

        const linkPath = linkGroup
            .selectAll(".flow-link")
            .data(d3Links)
            .join("path")
            .attr("class", "flow-link")
            .attr("stroke", "var(--color-border)")
            .attr("stroke-width", 1.5)
            .attr("fill", "none")
            .attr("marker-end", "url(#flow-arrow)");

        function ticked() {
            linkPath.attr("d", (link: { source: FlowNode; target: FlowNode }) => {
                const sx = link.source.x ?? 0;
                const sy = link.source.y ?? 0;
                const tx = link.target.x ?? 0;
                const ty = link.target.y ?? 0;
                const dx = tx - sx;
                const dy = ty - sy;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const offset = Math.min(NODE_R * 2, dist / 2);
                const ex = tx - (dx / dist) * (NODE_R + offset);
                const ey = ty - (dy / dist) * (NODE_R + offset);
                return `M${sx},${sy} L${ex},${ey}`;
            });
            nodeGroup.selectAll("g").attr("transform", (d: FlowNode) => {
                const x = d.x ?? 0;
                const y = d.y ?? 0;
                return `translate(${x},${y})`;
            });
        }

        simulation.on("tick", ticked);

        const nodeEnter = nodeGroup
            .selectAll("g")
            .data(nodes)
            .join("g")
            .attr("class", "flow-d3-node")
            .attr("transform", (d: FlowNode) => `translate(${d.x ?? 0},${d.y ?? 0})`)
            .style("cursor", "default");

        nodeEnter.each(function (d: FlowNode) {
            const el = d3.select(this);
            let fill = "var(--color-assistant-message)";
            if (d.type === "user") fill = "var(--color-user-message)";
            else if (d.type === "tool" && d.toolType)
                fill = TOOL_TYPE_COLORS[d.toolType] ?? TOOL_TYPE_COLORS.Other;

            el.append("circle")
                .attr("r", NODE_R)
                .attr("fill", fill)
                .attr("stroke", "var(--color-border)")
                .attr("stroke-width", 1.5);

            el.append("text")
                .attr("text-anchor", "middle")
                .attr("dy", 4)
                .attr("font-size", "10px")
                .attr("fill", "var(--color-text-primary)")
                .attr("class", "flow-node-label")
                .text(d.label)
                .style("pointer-events", "none")
                .each(function () {
                    const self = d3.select(this);
                    const text = self.text();
                    if (text.length > 12) self.text(text.slice(0, 10) + "..");
                });

            let tooltip = d.label;
            if (d.type === "user" && d.message?.text) {
                const preview = d.message.text.slice(0, 80);
                tooltip = preview + (d.message.text.length > 80 ? "..." : "");
            } else if (d.type === "assistant" && d.message?.text) {
                const preview = d.message.text.slice(0, 80);
                tooltip = preview + (d.message.text.length > 80 ? "..." : "");
            } else if (d.type === "tool" && d.toolCall?.parameters) {
                const params = JSON.stringify(d.toolCall.parameters);
                tooltip = params.length > 100 ? params.slice(0, 97) + "..." : params;
            }

            el.append("title").text(tooltip);
        });

        simulation.alpha(0.8).restart();

        return () => {
            simulation.stop();
        };
    }, [session, graphNodes, graphLinks, hasMessages, dimensions]);

    if (!hasMessages) {
        return (
            <div className="flow-empty">
                This session has no messages to display in the flow diagram.
            </div>
        );
    }

    return (
        <div className="flow-container flow-d3-container" ref={containerRef}>
            <svg ref={svgRef} className="flow-d3-svg" />
        </div>
    );
}

export default FlowTab;
