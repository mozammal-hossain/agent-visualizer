import React, { ReactNode } from "react";

type ChipTone = "default" | "success" | "warning";

interface ChipProps {
    tone?: ChipTone;
    children: ReactNode;
}

function Chip({ tone = "default", children }: ChipProps) {
    const toneClass =
        tone === "success" ? "av-chip-success" : tone === "warning" ? "av-chip-warning" : "";
    return <span className={`av-chip ${toneClass}`}>{children}</span>;
}

export default Chip;

