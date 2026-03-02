import React from "react";

interface MetricTileProps {
    label: string;
    value: string | number;
    description?: string;
}

function MetricTile({ label, value, description }: MetricTileProps) {
    return (
        <div className="av-metric-tile">
            <div className="av-metric-label">{label}</div>
            <div className="av-metric-value">{value}</div>
            {description && <div className="av-metric-description">{description}</div>}
        </div>
    );
}

export default MetricTile;

