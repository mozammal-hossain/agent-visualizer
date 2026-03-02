import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";
import { Session } from "../parsers/types";
import { TranscriptService } from "../services/transcriptService";
import { deriveStatus } from "../utils/activityStatus";

const VALID_TABS = new Set(["overview", "timeline", "hierarchy", "flow", "tools"]);
const SESSION_ID_PATTERN = /^[0-9a-f-]{8,36}$/i;

/** Escape JSON for safe inline <script> embedding, preventing </script> injection. */
function safeJsonInScript(value: unknown): string {
    return JSON.stringify(value)
        .replace(/</g, "\\u003c")
        .replace(/>/g, "\\u003e")
        .replace(/&/g, "\\u0026");
}

/** Strip absolute file paths from a session before it is sent to the webview. */
function stripSessionFilePaths(session: Session): Record<string, unknown> {
    const { filePath: _omit, subagents, ...rest } = session;
    return { ...rest, subagents: subagents.map(stripSessionFilePaths) };
}

const WATCH_POLL_INTERVAL_MS = 1000;
const STATE_KEY_LAST_SESSION_ID = "agentVisualizer.lastSessionId";
const STATE_KEY_LAST_ACTIVE_TAB = "agentVisualizer.lastActiveTab";

export class VisualizerPanel {
    public static currentPanel: VisualizerPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private readonly _workspaceState: vscode.Memento;
    private _disposables: vscode.Disposable[] = [];
    private _pinned: boolean = false;
    private transcriptService: TranscriptService;
    private _currentSession: Session | null = null;
    private _watchingFilePath: string | null = null;

    public static createOrShow(
        extensionUri: vscode.Uri,
        session: Session,
        transcriptService: TranscriptService,
        workspaceState: vscode.Memento
    ) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (VisualizerPanel.currentPanel) {
            VisualizerPanel.currentPanel._panel.reveal(column);
            VisualizerPanel.currentPanel.setSession(session);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            "agentVisualizer",
            `Session: ${session.firstUserMessage.substring(0, 60)}`,
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, "webview-ui", "dist"),
                ],
            }
        );

        VisualizerPanel.currentPanel = new VisualizerPanel(
            panel,
            extensionUri,
            session,
            transcriptService,
            workspaceState
        );
    }

    /**
     * Follow the currently active session, unless the panel has been pinned
     * by the user. If no panel exists yet, this will create one.
     */
    public static followActiveSession(
        extensionUri: vscode.Uri,
        session: Session,
        transcriptService: TranscriptService,
        workspaceState: vscode.Memento
    ) {
        const current = VisualizerPanel.currentPanel;
        if (current) {
            if (current._pinned) {
                return;
            }
            current.setSession(session);
            current._panel.reveal();
            return;
        }

        VisualizerPanel.createOrShow(
            extensionUri,
            session,
            transcriptService,
            workspaceState
        );
    }

    private constructor(
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        session: Session,
        transcriptService: TranscriptService,
        workspaceState: vscode.Memento
    ) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._workspaceState = workspaceState;
        this.transcriptService = transcriptService;

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.onDidReceiveMessage(
            (e: unknown) => this._onMessage(e),
            null,
            this._disposables
        );

        this._panel.webview.html = this._getWebviewContent(session);
        this.setSession(session);
    }

    private setSession(session: Session): void {
        if (this._currentSession?.filePath !== session.filePath) {
            this._stopWatching();
        }
        this._currentSession = session;
        this._workspaceState.update(STATE_KEY_LAST_SESSION_ID, session.id);
        const titleText = session.firstUserMessage.substring(0, 60);
        this._panel.title = `Session: ${titleText}`;
        this._panel.webview.postMessage({
            type: "sessionData",
            data: stripSessionFilePaths(session),
        });
        this._panel.webview.postMessage({
            type: "sessionStatus",
            status: deriveStatus(session),
        });
        this._startWatching(session);
    }

    private _startWatching(session: Session): void {
        if (this._watchingFilePath === session.filePath) {
            return;
        }
        this._stopWatching();
        if (!session.filePath || !fs.existsSync(session.filePath)) {
            return;
        }
        this._watchingFilePath = session.filePath;
        fs.watchFile(
            session.filePath,
            { interval: WATCH_POLL_INTERVAL_MS },
            (curr, prev) => {
                if (curr.mtimeMs <= prev.mtimeMs) {
                    return;
                }
                const updated = this.transcriptService.parseSessionFile(
                    session.filePath,
                    session.format
                );
                if (updated && this._currentSession?.filePath === session.filePath) {
                    this._currentSession = updated;
                    this._panel.webview.postMessage({
                        type: "sessionData",
                        data: stripSessionFilePaths(updated),
                    });
                    this._panel.webview.postMessage({
                        type: "sessionStatus",
                        status: deriveStatus(updated),
                    });
                }
            }
        );
    }

    private _stopWatching(): void {
        if (this._watchingFilePath) {
            try {
                fs.unwatchFile(this._watchingFilePath);
            } catch {
                // ignore
            }
            this._watchingFilePath = null;
        }
    }

    private _onMessage(message: unknown) {
        if (
            typeof message !== "object" ||
            message === null ||
            !("command" in message)
        ) {
            return;
        }
        const { command, sessionId, tab } = message as {
            command: string;
            sessionId?: string;
            tab?: string;
        };
        switch (command) {
            case "openSession":
                if (
                    typeof sessionId === "string" &&
                    SESSION_ID_PATTERN.test(sessionId)
                ) {
                    const session = this.transcriptService.getSession(sessionId);
                    if (session) {
                        this.setSession(session);
                    }
                }
                break;
            case "setActiveTab":
                if (typeof tab === "string" && VALID_TABS.has(tab)) {
                    this._workspaceState.update(STATE_KEY_LAST_ACTIVE_TAB, tab);
                }
                break;
        }
    }

    private _getWebviewContent(session: Session): string {
        const scriptUri = this._panel.webview.asWebviewUri(
            vscode.Uri.joinPath(
                this._extensionUri,
                "webview-ui",
                "dist",
                "index.js"
            )
        );

        const styleUri = this._panel.webview.asWebviewUri(
            vscode.Uri.joinPath(
                this._extensionUri,
                "webview-ui",
                "dist",
                "index.css"
            )
        );

        const config = vscode.workspace.getConfiguration("agent-visualizer");
        const playSound = config.get<boolean>("playSound", false);
        const lastActiveTab =
            this._workspaceState.get<string>(STATE_KEY_LAST_ACTIVE_TAB) ?? "overview";

        const themeKind = vscode.window.activeColorTheme.kind;
        const initialTheme =
            themeKind === vscode.ColorThemeKind.Light ||
            themeKind === vscode.ColorThemeKind.HighContrastLight
                ? "light"
                : "dark";

        const nonce = crypto.randomBytes(16).toString("base64");
        const cspSource = this._panel.webview.cspSource;
        const safeSession = stripSessionFilePaths(session);

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}' ${cspSource}; style-src ${cspSource}; img-src ${cspSource} data:; font-src ${cspSource}; connect-src 'none';">
    <title>Agent Visualizer</title>
    <link rel="stylesheet" href="${styleUri}">
</head>
<body>
    <div id="root"></div>
    <script nonce="${nonce}">
      window.__INITIAL_SESSION__ = ${safeJsonInScript(safeSession)};
      window.__PLAY_SOUND_ENABLED__ = ${safeJsonInScript(playSound)};
      window.__INITIAL_TAB__ = ${safeJsonInScript(lastActiveTab)};
      window.__INITIAL_THEME__ = ${safeJsonInScript(initialTheme)};
    </script>
    <script nonce="${nonce}" type="module" src="${scriptUri}"></script>
</body>
</html>`;
    }

    public dispose() {
        VisualizerPanel.currentPanel = undefined;
        this._stopWatching();
        this._currentSession = null;

        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
}
