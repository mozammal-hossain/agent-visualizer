import * as vscode from "vscode";
import { Session } from "../parsers/types";
import { TranscriptService } from "../services/transcriptService";
import { formatLastToolLabels } from "../utils/toolLabel";

export class SessionTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<
        vscode.TreeItem | undefined | null | void
    > = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<
        vscode.TreeItem | undefined | null | void
    > = this._onDidChangeTreeData.event;

    constructor(private transcriptService: TranscriptService) { }

    refresh(): void {
        this.transcriptService.clearCache();
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
        if (!element) {
            // Root level - show all sessions or a helpful message
            const sessions = this.transcriptService.getSessions();
            if (sessions.length === 0) {
                const dir = this.transcriptService.getTranscriptDir();
                const item = new vscode.TreeItem(
                    "No sessions found",
                    vscode.TreeItemCollapsibleState.None
                );
                item.description = "Click Refresh or check path below";
                item.tooltip = `Transcripts are read from:\n${dir}\n\n• Open a folder where you've used Cursor chat.\n• Use "Refresh Sessions" (↻) to rescan.`;
                item.iconPath = new vscode.ThemeIcon("info");
                return [item];
            }
            return sessions.map((session) => new SessionTreeItem(session));
        }

        if (element instanceof SessionTreeItem && element.session.subagents.length > 0) {
            // Show subagents
            return element.session.subagents.map(
                (subagent) => new SessionTreeItem(subagent, true)
            );
        }

        return [];
    }
}

export class SessionTreeItem extends vscode.TreeItem {
    contextValue = "session";

    constructor(
        public session: Session,
        isSubagent: boolean = false
    ) {
        const displayLabel = isSubagent
            ? `Subagent: ${session.firstUserMessage}`
            : session.firstUserMessage;

        super(displayLabel, vscode.TreeItemCollapsibleState.Collapsed);

        const msgCount = session.messages.length;
        const toolCount = session.messages.reduce((sum, m) => sum + m.toolCalls.length, 0);
        const subagentCount = session.subagents?.length ?? 0;
        this.description = `${msgCount} msgs · ${toolCount} tools · ${subagentCount} subagents`;
        this.tooltip = [
            `Session ID: ${session.id}`,
            `Messages: ${msgCount}`,
            `Tool calls: ${toolCount}`,
            `Subagents: ${subagentCount}`,
            session.filePath ? `File: ${session.filePath}` : null,
        ]
            .filter(Boolean)
            .join("\n");
        this.command = {
            title: "Open Session",
            command: "agent-visualizer.openSession",
            arguments: [session.id],
        };

        if (isSubagent) {
            this.label = `Subagent: ${session.firstUserMessage}`;
        }
    }
}
