import * as vscode from "vscode";
import { SessionTreeProvider, SessionTreeItem } from "./providers/sessionTreeProvider";
import { VisualizerPanel } from "./panels/visualizerPanel";
import { createTranscriptService } from "./services/transcriptService";
import { PathResolver } from "./services/pathResolver";

let transcriptService: any;
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
        async (sessionId: string) => {
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

    context.subscriptions.push(openSessionCommand);
    context.subscriptions.push(refreshCommand);
    context.subscriptions.push(copySessionIdCommand);

    // Watch for transcript folder changes
    if (workspaceFolders.length > 0) {
        const transcriptDir = PathResolver.getTranscriptFolderForWorkspace(
            workspacePath
        );

        try {
            const watcher = vscode.workspace.createFileSystemWatcher(transcriptDir);
            watcher.onDidCreate(() => treeProvider.refresh());
            watcher.onDidChange(() => treeProvider.refresh());
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
