import * as vscode from "vscode";
import { SessionTreeProvider, SessionTreeItem } from "./providers/sessionTreeProvider";
import { VisualizerPanel } from "./panels/visualizerPanel";
import { TranscriptService, createTranscriptService } from "./services/transcriptService";
import { PathResolver } from "./services/pathResolver";

let transcriptService: TranscriptService;
let treeProvider: SessionTreeProvider;

export function activate(context: vscode.ExtensionContext) {
    console.log("Agent Visualizer extension activated");

    // Get workspace folder
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        console.warn("No workspace folder found");
        return;
    }

    const workspacePath = workspaceFolders[0].uri.fsPath;
    transcriptService = createTranscriptService(workspacePath);

    // Register tree data provider
    treeProvider = new SessionTreeProvider(transcriptService);
    const treeView = vscode.window.createTreeView("agentSessions", {
        treeDataProvider: treeProvider,
    });

    context.subscriptions.push(treeView);

    // Register commands
    const openSessionCommand = vscode.commands.registerCommand(
        "agent-visualizer.openSession",
        async (arg: string | SessionTreeItem) => {
            // Support being called with either a raw session ID (from tree item command/webview)
            // or a SessionTreeItem (from the view/item/context menu).
            let sessionId: string | undefined;

            if (typeof arg === "string") {
                sessionId = arg;
            } else if (arg && typeof arg === "object") {
                // Context menu on a tree item passes the item instance as the first argument.
                if (arg.session && typeof arg.session.id === "string") {
                    sessionId = arg.session.id;
                }
            }

            if (!sessionId) {
                vscode.window.showErrorMessage(
                    "Could not determine which session to open."
                );
                return;
            }

            const session = transcriptService.getSession(sessionId);
            if (!session) {
                vscode.window.showErrorMessage(`Session ${sessionId} not found`);
                return;
            }
            VisualizerPanel.createOrShow(
                context.extensionUri,
                session,
                transcriptService,
                context.workspaceState
            );
        }
    );

    const refreshCommand = vscode.commands.registerCommand(
        "agent-visualizer.refresh",
        () => {
            treeProvider.refresh();
        }
    );

    const copySessionIdCommand = vscode.commands.registerCommand(
        "agent-visualizer.copySessionId",
        async (treeItem: SessionTreeItem) => {
            await vscode.env.clipboard.writeText(treeItem.session.id);
            vscode.window.showInformationMessage(
                `Copied session ID: ${treeItem.session.id}`
            );
        }
    );

    const filterSessionsCommand = vscode.commands.registerCommand(
        "agent-visualizer.filterSessions",
        async () => {
            const current = treeProvider.getFilterPattern();
            const value = await vscode.window.showInputBox({
                prompt: "Filter sessions by title or session ID (case-insensitive)",
                value: current,
                placeHolder: "e.g. fix bug",
            });
            if (value !== undefined) {
                treeProvider.setFilter(value);
            }
        }
    );

    const clearFilterCommand = vscode.commands.registerCommand(
        "agent-visualizer.clearFilter",
        () => {
            treeProvider.setFilter("");
        }
    );

    context.subscriptions.push(openSessionCommand);
    context.subscriptions.push(refreshCommand);
    context.subscriptions.push(copySessionIdCommand);
    context.subscriptions.push(filterSessionsCommand);
    context.subscriptions.push(clearFilterCommand);

    // Watch for transcript folder changes
    if (workspaceFolders.length > 0) {
        const transcriptDir = PathResolver.getTranscriptFolderForWorkspace(
            workspacePath
        );

        try {
            const watcher = vscode.workspace.createFileSystemWatcher(transcriptDir);

            const handleFsChange = () => {
                treeProvider.refresh();
                try {
                    const session =
                        transcriptService.getMostRecentlyActiveSession();
                    if (session) {
                        VisualizerPanel.followActiveSession(
                            context.extensionUri,
                            session,
                            transcriptService,
                            context.workspaceState
                        );
                    }
                } catch (e) {
                    console.error("Error auto-opening active session:", e);
                }
            };

            watcher.onDidCreate(() => handleFsChange());
            watcher.onDidChange(() => handleFsChange());
            watcher.onDidDelete(() => treeProvider.refresh());
            context.subscriptions.push(watcher);
        } catch (e) {
            console.error("Error watching transcript folder:", e);
        }
    }
}

export function deactivate() {
    console.log("Agent Visualizer extension deactivated");
}
