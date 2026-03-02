import React from "react";
import { Session } from "../types";
import Card from "./common/Card";
import { formatToolLabel } from "../utils/toolLabel";
import Chip from "./common/Chip";

interface ToolsTabProps {
    session: Session;
}

interface ToolSummary {
    name: string;
    count: number;
}

function getToolSummaries(session: Session): ToolSummary[] {
    const counts = new Map<string, number>();

    for (const message of session.messages) {
        for (const tc of message.toolCalls) {
            const label = formatToolLabel(tc);
            counts.set(label, (counts.get(label) ?? 0) + 1);
        }
    }

    return Array.from(counts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function ToolsTab({ session }: ToolsTabProps) {
    const summaries = getToolSummaries(session);

    if (summaries.length === 0) {
        return (
            <div className="tools-empty">
                This session did not use any tools.
            </div>
        );
    }

    return (
        <div className="tools-container">
            <Card title="Tool usage">
                <table className="tools-table">
                    <thead>
                        <tr>
                            <th>Tool</th>
                            <th className="tools-col-count">Count</th>
                        </tr>
                    </thead>
                    <tbody>
                        {summaries.map((s) => (
                            <tr key={s.name}>
                                <td>{s.name}</td>
                                <td className="tools-col-count">
                                    <Chip>{s.count}</Chip>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Card>
        </div>
    );
}

export default ToolsTab;

