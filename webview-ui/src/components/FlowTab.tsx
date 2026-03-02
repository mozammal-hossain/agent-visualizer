import React from "react";
import { Session } from "../types";
import Card from "./common/Card";
import { formatToolLabel } from "../utils/toolLabel";

interface FlowTabProps {
    session: Session;
}

function FlowTab({ session }: FlowTabProps) {
    const steps = session.messages.map((message, index) => {
        const label =
            message.role === "user"
                ? `User message ${index + 1}`
                : `Agent response ${index + 1}`;
        const primaryTool =
            message.toolCalls.length > 0 ? formatToolLabel(message.toolCalls[0]) : null;

        return {
            id: `${index}`,
            label,
            primaryTool,
        };
    });

    return (
        <div className="flow-container">
            <Card title="Session flow">
                <div className="flow-steps">
                    {steps.map((step, idx) => (
                        <div key={step.id} className="flow-step-row">
                            <div className="flow-step-node">
                                <div className="flow-step-index">{idx + 1}</div>
                                <div className="flow-step-content">
                                    <div className="flow-step-label">{step.label}</div>
                                    {step.primaryTool && (
                                        <div className="flow-step-secondary">
                                            Primary tool: {step.primaryTool}
                                        </div>
                                    )}
                                </div>
                            </div>
                            {idx < steps.length - 1 && (
                                <div className="flow-step-connector" aria-hidden="true">
                                    <span className="flow-step-line" />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    );
}

export default FlowTab;

