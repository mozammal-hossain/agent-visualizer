import { useMemo, useEffect, useRef, useState } from "react";
import { Session } from "../types";
import Card from "./common/Card";
import Chip from "./common/Chip";
import MetricTile from "./common/MetricTile";
import * as d3 from "d3";

interface ToolsTabProps {
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

function getToolTypeCounts(session: Session): Map<string, number> {
    const counts = new Map<string, number>();
    for (const message of session.messages) {
        for (const tc of message.toolCalls) {
            const type = getToolType(tc.name);
            counts.set(type, (counts.get(type) ?? 0) + 1);
        }
    }
    return counts;
}

function getToolNameCounts(session: Session): { name: string; count: number }[] {
    const counts = new Map<string, number>();
    for (const message of session.messages) {
        for (const tc of message.toolCalls) {
            const name = tc.name;
            counts.set(name, (counts.get(name) ?? 0) + 1);
        }
    }
    return Array.from(counts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function getTopFiles(session: Session, n: number): { path: string; count: number }[] {
    const pathCounts = new Map<string, number>();
    for (const message of session.messages) {
        for (const tc of message.toolCalls) {
            const toolLower = tc.name.toLowerCase();
            if (!toolLower.includes("read") && !toolLower.includes("write") && !toolLower.includes("grep"))
                continue;
            const path = tc.parameters?.path ?? tc.parameters?.filePath;
            if (path) {
                pathCounts.set(path, (pathCounts.get(path) ?? 0) + 1);
            }
        }
    }
    return Array.from(pathCounts.entries())
        .map(([path, count]) => ({ path, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, n);
}

function countUniqueFiles(session: Session): number {
    const paths = new Set<string>();
    for (const message of session.messages) {
        for (const tc of message.toolCalls) {
            const toolLower = tc.name.toLowerCase();
            if (!toolLower.includes("read") && !toolLower.includes("write") && !toolLower.includes("grep"))
                continue;
            const path = tc.parameters?.path ?? tc.parameters?.filePath;
            if (path) paths.add(path);
        }
    }
    return paths.size;
}

const BAR_CHART_HEIGHT = 200;
const DONUT_SIZE = 160;
const MARGIN = { top: 8, right: 8, bottom: 8, left: 8 };

function ToolBarChart({
    data,
    width,
}: {
    data: { name: string; count: number }[];
    width: number;
}) {
    const svgRef = useRef<SVGSVGElement>(null);
    const maxCount = Math.max(1, ...data.map((d) => d.count));
    const barHeight = Math.max(14, (BAR_CHART_HEIGHT - MARGIN.top - MARGIN.bottom) / data.length - 4);

    useEffect(() => {
        if (!svgRef.current || data.length === 0) return;
        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();
        const g = svg.append("g").attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);
        const xScale = d3.scaleLinear().domain([0, maxCount]).range([0, width - MARGIN.left - MARGIN.right - 100]);
        g.selectAll(".bar")
            .data(data)
            .join("g")
            .attr("class", "tools-bar-row")
            .attr("transform", (_, i) => `translate(0,${i * (barHeight + 4)})`)
            .each(function (d) {
                const gBar = d3.select(this);
                gBar.append("text")
                    .attr("class", "tools-bar-label")
                    .attr("y", barHeight / 2 + 10)
                    .attr("font-size", "11px")
                    .attr("fill", "var(--color-text-primary)")
                    .text(d.name.length > 28 ? d.name.slice(0, 25) + "..." : d.name);
                gBar.append("rect")
                    .attr("class", "tools-bar-rect")
                    .attr("x", 100)
                    .attr("y", 2)
                    .attr("height", barHeight)
                    .attr("width", xScale(d.count))
                    .attr("fill", "var(--color-user-message)")
                    .attr("rx", 2);
                gBar.append("text")
                    .attr("class", "tools-bar-value")
                    .attr("x", 102 + xScale(d.count))
                    .attr("y", barHeight / 2 + 10)
                    .attr("dx", 6)
                    .attr("font-size", "11px")
                    .attr("fill", "var(--color-text-secondary)")
                    .text(d.count);
            });
    }, [data, width, maxCount, barHeight]);

    if (data.length === 0) return null;
    return (
        <svg
            ref={svgRef}
            width={width}
            height={BAR_CHART_HEIGHT}
            className="tools-bar-chart"
        />
    );
}

function ToolDonutChart({ data }: { data: { type: string; count: number }[] }) {
    const svgRef = useRef<SVGSVGElement>(null);
    const total = data.reduce((s, d) => s + d.count, 0);

    useEffect(() => {
        if (!svgRef.current || data.length === 0 || total === 0) return;
        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();
        const radius = Math.min(DONUT_SIZE, DONUT_SIZE) / 2 - 8;
        const innerRadius = radius * 0.5;
        const pie = d3.pie<{ type: string; count: number }>().value((d) => d.count)(data);
        const arc = d3
            .arc<d3.PieArcDatum<{ type: string; count: number }>>()
            .innerRadius(innerRadius)
            .outerRadius(radius);
        const g = svg
            .append("g")
            .attr("transform", `translate(${DONUT_SIZE / 2},${DONUT_SIZE / 2})`);
        g.selectAll(".arc")
            .data(pie)
            .join("path")
            .attr("class", "tools-donut-arc")
            .attr("d", arc)
            .attr("fill", (d) => TOOL_TYPE_COLORS[d.data.type] ?? TOOL_TYPE_COLORS.Other);
    }, [data, total]);

    if (data.length === 0 || total === 0) return null;
    return (
        <svg
            ref={svgRef}
            width={DONUT_SIZE}
            height={DONUT_SIZE}
            className="tools-donut-chart"
        />
    );
}

function ToolsTab({ session }: ToolsTabProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [chartWidth, setChartWidth] = useState(400);

    const totalMessages = session.messages.length;
    const totalToolCalls = useMemo(
        () =>
            session.messages.reduce(
                (sum, m) => sum + m.toolCalls.length,
                0
            ),
        [session]
    );
    const uniqueFiles = useMemo(() => countUniqueFiles(session), [session]);
    const toolNameCounts = useMemo(() => getToolNameCounts(session), [session]);
    const toolTypeCounts = useMemo(() => getToolTypeCounts(session), [session]);
    const topFiles = useMemo(() => getTopFiles(session, 20), [session]);

    const donutData = useMemo(() => {
        const order = ["Read", "Write", "Shell", "Grep", "Other"];
        return order
            .filter((type) => (toolTypeCounts.get(type) ?? 0) > 0)
            .map((type) => ({ type, count: toolTypeCounts.get(type) ?? 0 }));
    }, [toolTypeCounts]);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const onResize = () => setChartWidth(el.clientWidth || 400);
        onResize();
        const ro = new ResizeObserver(onResize);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    if (totalToolCalls === 0) {
        return (
            <div className="tools-empty">
                This session did not use any tools.
            </div>
        );
    }

    return (
        <div className="tools-container tools-dashboard" ref={containerRef}>
            <div className="tools-stats-row">
                <MetricTile
                    label="Messages"
                    value={totalMessages}
                    description="Total in this session"
                />
                <MetricTile
                    label="Tool calls"
                    value={totalToolCalls}
                    description="Total tool invocations"
                />
                <MetricTile
                    label="Unique files"
                    value={uniqueFiles}
                    description="Files read/written/searched"
                />
            </div>

            <div className="tools-charts-row">
                <Card title="Tool call frequency" className="tools-card-bar">
                    <ToolBarChart data={toolNameCounts} width={chartWidth} />
                </Card>
                <Card title="Tool type distribution" className="tools-card-donut">
                    <ToolDonutChart data={donutData} />
                </Card>
            </div>

            {topFiles.length > 0 && (
                <Card title="Most accessed files" className="tools-card-files">
                    <ul className="tools-file-list">
                        {topFiles.map(({ path, count }) => (
                            <li key={path} className="tools-file-item">
                                <span className="tools-file-path" title={path}>
                                    {path.length > 60 ? path.slice(0, 57) + "..." : path}
                                </span>
                                <Chip>{count}</Chip>
                            </li>
                        ))}
                    </ul>
                </Card>
            )}
        </div>
    );
}

export default ToolsTab;
