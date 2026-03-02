import React from "react";
import { Session } from "../types";
import Card from "./common/Card";

interface HierarchyTabProps {
    session: Session;
}

interface TreeNodeProps {
    session: Session;
    depth: number;
}

function TreeNode({ session, depth }: TreeNodeProps) {
    const paddingLeft = depth * 16;
    const subagents = session.subagents ?? [];

    const openSession = () => {
        const api = window.__vscodeApi;
        if (api) {
            api.postMessage({ command: "openSession", sessionId: session.id });
        }
    };

    return (
        <div className="hierarchy-node" style={{ paddingLeft }}>
            <Card
                className="hierarchy-card"
                headerExtra={
                    <button
                        type="button"
                        className="hierarchy-open-btn"
                        onClick={openSession}
                    >
                        Open
                    </button>
                }
            >
                <div className="hierarchy-node-title">{session.firstUserMessage}</div>
                <div className="hierarchy-node-meta">
                    <span className="hierarchy-meta-item">
                        ID: <code>{session.id}</code>
                    </span>
                    {subagents.length > 0 && (
                        <span className="hierarchy-meta-item">
                            Subagents: {subagents.length}
                        </span>
                    )}
                </div>
            </Card>
            {subagents.map((child) => (
                <TreeNode key={child.id} session={child} depth={depth + 1} />
            ))}
        </div>
    );
}

function HierarchyTab({ session }: HierarchyTabProps) {
    const hasSubagents = (session.subagents?.length ?? 0) > 0;

    if (!hasSubagents) {
        return (
            <div className="hierarchy-empty">
                This session does not have any subagents.
            </div>
        );
    }

    return (
        <div className="hierarchy-container">
            <TreeNode session={session} depth={0} />
        </div>
    );
}

export default HierarchyTab;

