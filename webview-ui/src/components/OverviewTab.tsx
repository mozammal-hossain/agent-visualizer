import React from "react";
import { Session } from "../types";
import Card from "./common/Card";
import MetricTile from "./common/MetricTile";

interface OverviewTabProps {
    session: Session;
}

function OverviewTab({ session }: OverviewTabProps) {
    const messages = session.messages ?? [];
    const totalMessages = messages.length;
    const totalToolCalls = messages.reduce(
        (sum, m) => sum + (m.toolCalls?.length ?? 0),
        0
    );
    const userMessages = messages.filter((m) => m.role === "user").length;
    const assistantMessages = totalMessages - userMessages;
    const subagentCount = session.subagents?.length ?? 0;

    return (
        <div className="overview-layout">
            <div className="overview-metrics">
                <MetricTile
                    label="Messages"
                    value={totalMessages}
                    description={`${userMessages} user / ${assistantMessages} assistant`}
                />
                <MetricTile
                    label="Tool calls"
                    value={totalToolCalls}
                    description={totalToolCalls > 0 ? "Tools used in this run" : "No tools used"}
                />
                <MetricTile
                    label="Subagents"
                    value={subagentCount}
                    description={
                        subagentCount > 0 ? "Background agents launched" : "No subagents launched"
                    }
                />
            </div>

            <div className="overview-main">
                <Card title="Session summary">
                    <div className="overview-summary-text">
                        <div className="overview-summary-label">First instruction</div>
                        <div className="overview-summary-message">
                            {session.firstUserMessage}
                        </div>
                    </div>
                </Card>

                {totalToolCalls > 0 && (
                    <Card title="Notable details">
                        <ul className="overview-list">
                            <li>
                                This run includes {totalToolCalls} tool
                                {totalToolCalls === 1 ? "" : "s"} across {assistantMessages} agent
                                message{assistantMessages === 1 ? "" : "s"}.
                            </li>
                            {subagentCount > 0 && (
                                <li>{subagentCount} subagent session(s) were spawned.</li>
                            )}
                        </ul>
                    </Card>
                )}
            </div>
        </div>
    );
}

export default OverviewTab;

