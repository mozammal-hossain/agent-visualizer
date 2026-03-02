import * as vscode from "vscode";
import * as path from "path";
import { Session } from "../parsers/types";
import { TranscriptService } from "../services/transcriptService";

export class VisualizerPanel {
    public static currentPanel: VisualizerPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private transcriptService: TranscriptService;

    public static createOrShow(
        extensionUri: vscode.Uri,
        session: Session,
        transcriptService: TranscriptService
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
            `Session: ${session.firstUserMessage}`,
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                enableForms: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, "webview-ui", "dist"),
                ],
            }
        );

        VisualizerPanel.currentPanel = new VisualizerPanel(
            panel,
            extensionUri,
            session,
            transcriptService
        );
    }

    private constructor(
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        session: Session,
        transcriptService: TranscriptService
    ) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this.transcriptService = transcriptService;

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.onDidReceiveMessage(
            (e) => this._onMessage(e),
            null,
            this._disposables
        );

        this._panel.webview.html = this._getWebviewContent(session);
    }

    private setSession(session: Session): void {
        this._panel.title = `Session: ${session.firstUserMessage}`;
        this._panel.webview.postMessage({
            type: "sessionData",
            data: session,
        });
    }

    private _onMessage(message: any) {
        switch (message.command) {
            case "openSession":
                const sessionId = message.sessionId;
                const session = this.transcriptService.getSession(sessionId);
                if (session) {
                    this.setSession(session);
                }
                break;
        }
    }

    private _getWebviewContent(session: Session): string {
        const webviewUri = this._panel.webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, "webview-ui", "dist", "index.html")
        );

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
                "style.css"
            )
        );

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Agent Visualizer</title>
    <link rel="stylesheet" href="${styleUri}">
</head>
<body>
    <div id="root"></div>
    <script>
      window.__INITIAL_SESSION__ = ${JSON.stringify(session)};
    </script>
    <script src="${scriptUri}"></script>
</body>
</html>`;
    }

    public dispose() {
        VisualizerPanel.currentPanel = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
}
