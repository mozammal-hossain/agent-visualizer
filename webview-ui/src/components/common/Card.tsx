import React, { ReactNode } from "react";

interface CardProps {
    title?: string;
    icon?: ReactNode;
    headerExtra?: ReactNode;
    className?: string;
    children: ReactNode;
}

function Card({ title, icon, headerExtra, className = "", children }: CardProps) {
    const hasHeader = title || icon || headerExtra;

    return (
        <div className={`av-card ${className}`}>
            {hasHeader && (
                <div className="av-card-header">
                    <div className="av-card-title">
                        {icon && <span className="av-card-icon">{icon}</span>}
                        {title && <span className="av-card-title-text">{title}</span>}
                    </div>
                    {headerExtra && <div className="av-card-header-extra">{headerExtra}</div>}
                </div>
            )}
            <div className="av-card-body">{children}</div>
        </div>
    );
}

export default Card;

