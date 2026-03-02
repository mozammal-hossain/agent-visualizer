import * as vscode from "vscode";
import { ViewProvider } from "./ViewProvider.js";
import { ProviderRegistry } from "./providers/registry.js";
import { ClaudeCodeProvider } from "./providers/claude-code/index.js";
import { CursorProvider } from "./providers/cursor/index.js";
import { CodexCLIProvider } from "./providers/codex-cli/index.js";
import { AiderProvider } from "./providers/aider/index.js";
import { ClineProvider } from "./providers/cline/index.js";
import { ContinueProvider } from "./providers/continue/index.js";
import { CopilotProvider } from "./providers/copilot/index.js";
import { VIEW_ID, COMMAND_SHOW_PANEL, COMMAND_EXPORT_DEFAULT_LAYOUT } from "./constants.js";
import { SessionTreeProvider, SessionTreeItem } from "./providers/sessionTreeProvider";
import { VisualizerPanel } from "./panels/visualizerPanel";
import { TranscriptService, createTranscriptService } from "./services/transcriptService";
import { PathResolver } from "./services/pathResolver";

let transcriptService: TranscriptService;
let treeProvider: SessionTreeProvider;
let viewProviderInstance: ViewProvider | undefined;
let providerRegistryInstance: ProviderRegistry | undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log("Agent Visualizer extension activated");

    // Agent Office panel (pixel art visualization)
    const providerRegistry = new ProviderRegistry();
    const config = vscode.workspace.getConfiguration("agent-visualizer");
    if (config.get<boolean>("providers.claudeCode.enabled", true)) providerRegistry.register(new ClaudeCodeProvider());
    if (config.get<boolean>("providers.cursor.enabled", true)) providerRegistry.register(new CursorProvider());
    if (config.get<boolean>("providers.codexCli.enabled", true)) providerRegistry.register(new CodexCLIProvider());
    if (config.get<boolean>("providers.aider.enabled", true)) providerRegistry.register(new AiderProvider());
    if (config.get<boolean>("providers.cline.enabled", true)) providerRegistry.register(new ClineProvider());
    if (config.get<boolean>("providers.continue.enabled", true)) providerRegistry.register(new ContinueProvider());
    if (config.get<boolean>("providers.copilot.enabled", true)) providerRegistry.register(new CopilotProvider());
    const providerContext = {
        extensionPath: context.extensionUri.fsPath,
        workspaceRoot: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
        globalState: context.globalState,
        workspaceState: context.workspaceState,
    };
    void providerRegistry.activateAll(providerContext);
    providerRegistryInstance = providerRegistry;
    const viewProvider = new ViewProvider(context, providerRegistry);
    viewProviderInstance = viewProvider;
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(VIEW_ID, viewProvider)
    );
    context.subscriptions.push(
        vscode.commands.registerCommand(COMMAND_SHOW_PANEL, () => {
            vscode.commands.executeCommand(`${VIEW_ID}.focus`);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand(COMMAND_EXPORT_DEFAULT_LAYOUT, () => {
            viewProvider.exportDefaultLayout();
        })
    );

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
    providerRegistryInstance?.deactivateAll();
    providerRegistryInstance = undefined;
    viewProviderInstance?.dispose();
    viewProviderInstance = undefined;
    console.log("Agent Visualizer extension deactivated");
}
