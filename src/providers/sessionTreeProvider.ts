import * as vscode from "vscode";
import { Session } from "../parsers/types";
import { TranscriptService } from "../services/transcriptService";

export class SessionTreeProvider implements vscode.TreeDataProvider<SessionTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<
        SessionTreeItem | undefined | null | void
    > = new vscode.EventEmitter<SessionTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<
        SessionTreeItem | undefined | null | void
    > = this._onDidChangeTreeData.event;

    constructor(private transcriptService: TranscriptService) { }

    refresh(): void {
        this.transcriptService.clearCache();
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: SessionTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: SessionTreeItem): SessionTreeItem[] {
        if (!element) {
            // Root level - show all sessions
            const sessions = this.transcriptService.getSessions();
            return sessions.map((session) => new SessionTreeItem(session, session));
        }

        if (element.contextValue === "session" && element.session.subagents.length > 0) {
            // Show subagents
            return element.session.subagents.map(
                (subagent) => new SessionTreeItem(subagent, subagent, true)
            );
        }

        return [];
    }
}

export class SessionTreeItem extends vscode.TreeItem {
    contextValue = "session";

    constructor(
        label: string | vscode.TreeItemLabel,
        public session: Session,
        isSubagent: boolean = false
    ) {
        const displayLabel = isSubagent
            ? `Subagent: ${session.firstUserMessage}`
            : session.firstUserMessage;

        super(displayLabel, vscode.TreeItemCollapsibleState.Collapsed);

        this.description = `${session.messages.length} messages, ${session.messages.reduce((sum, m) => sum + m.toolCalls.length, 0)} tool calls`;
        this.tooltip = `ID: ${session.id}\nFormat: ${session.format}\nFile: ${session.filePath}`;
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
