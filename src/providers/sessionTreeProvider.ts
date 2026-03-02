import * as vscode from "vscode";
import { Session } from "../parsers/types.js";
import { TranscriptService } from "../services/transcriptService.js";

export class SessionTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<
        vscode.TreeItem | undefined | null | void
    > = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<
        vscode.TreeItem | undefined | null | void
    > = this._onDidChangeTreeData.event;

    private _filterPattern: string = "";

    constructor(private transcriptService: TranscriptService) {}

    setFilter(pattern: string): void {
        this._filterPattern = (pattern ?? "").trim();
        this._onDidChangeTreeData.fire();
    }

    getFilterPattern(): string {
        return this._filterPattern;
    }

    refresh(): void {
        this.transcriptService.clearCache();
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
        if (!element) {
            // Root level - show sessions (filtered if pattern set) or a helpful message
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
            let filtered = sessions;
            if (this._filterPattern) {
                const lower = this._filterPattern.toLowerCase();
                filtered = sessions.filter(
                    (s) =>
                        (s.firstUserMessage ?? "")
                            .toLowerCase()
                            .includes(lower) ||
                        (s.id ?? "")
                            .toLowerCase()
                            .includes(lower)
                );
            }
            if (filtered.length === 0) {
                const item = new vscode.TreeItem(
                    "No matching sessions",
                    vscode.TreeItemCollapsibleState.None
                );
                item.description = `Filter: "${this._filterPattern}"`;
                item.tooltip = "Use 'Clear Filter' or change the search text.";
                item.iconPath = new vscode.ThemeIcon("search");
                return [item];
            }
            return filtered.map((session) => new SessionTreeItem(session));
        }

        if (element instanceof SessionTreeItem && (element.session.subagents?.length ?? 0) > 0) {
            return (element.session.subagents ?? []).map(
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
