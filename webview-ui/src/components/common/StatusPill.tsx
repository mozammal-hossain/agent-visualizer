import React from "react";
import { SessionStatus } from "../../utils/activityStatus";

interface StatusPillProps {
    status: SessionStatus;
}

const STATUS_CONFIG: Record<
    SessionStatus,
    {
        label: string;
        className: string;
    }
> = {
    working: { label: "Working...", className: "status-working" },
    waiting: { label: "Waiting for input", className: "status-waiting" },
    idle: { label: "Idle", className: "status-idle" },
};

function StatusPill({ status }: StatusPillProps) {
    const { label, className } = STATUS_CONFIG[status];
    return (
        <span className={`status-badge ${className}`} title={label}>
            <span className="status-dot" />
            {label}
        </span>
    );
}

export default StatusPill;

