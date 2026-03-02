import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import {
  WORKSPACE_KEY_AGENT_SEATS,
  GLOBAL_KEY_SOUND_ENABLED,
} from './constants.js';
import type { ProviderRegistry } from './providers/registry.js';
import {
  subscribeAgentManager,
  getExistingAgentIds,
  getAgentInfo,
  getProjectDirPath,
} from './agentManager.js';
import {
  loadFurnitureAssets,
  sendAssetsToWebview,
  loadFloorTiles,
  sendFloorTilesToWebview,
  loadWallTiles,
  sendWallTilesToWebview,
  loadCharacterSprites,
  sendCharacterSpritesToWebview,
  loadDefaultLayout,
} from './assetLoader.js';
import {
  writeLayoutToFile,
  readLayoutFromFile,
  watchLayoutFile,
  migrateAndLoadLayout,
} from './layoutPersistence.js';
import type { LayoutWatcher } from './layoutPersistence.js';

export class ViewProvider implements vscode.WebviewViewProvider {
  webviewView: vscode.WebviewView | undefined;
  defaultLayout: Record<string, unknown> | null = null;
  layoutWatcher: LayoutWatcher | null = null;
  private agentManagerDispose: (() => void) | null = null;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly registry: ProviderRegistry,
  ) {}

  private get extensionUri(): vscode.Uri {
    return this.context.extensionUri;
  }

  private get webview(): vscode.Webview | undefined {
    return this.webviewView?.webview;
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.webviewView = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = getWebviewContent(
      webviewView.webview,
      this.context.extensionUri,
    );

    // Subscribe agent manager so provider events are forwarded to webview
    this.agentManagerDispose = subscribeAgentManager(
      this.registry,
      (msg) => this.webview?.postMessage(msg),
    ).dispose;

    webviewView.webview.onDidReceiveMessage(async (message: { type: string; [k: string]: unknown }) => {
      if (message.type === 'launchAgent') {
        const providerId = message.providerId as string;
        const folderPath = message.folderPath as string | undefined;
        const provider = this.registry.get(providerId);
        if (provider?.launch) {
          await provider.launch(folderPath);
        }
      } else if (message.type === 'focusAgent') {
        const id = message.id as number;
        const info = getAgentInfo(id);
        if (info) {
          const provider = this.registry.get(info.providerId);
          provider?.focusAgent?.(info.providerAgentId);
        }
      } else if (message.type === 'closeAgent') {
        const id = message.id as number;
        const info = getAgentInfo(id);
        if (info) {
          const provider = this.registry.get(info.providerId);
          provider?.closeAgent?.(info.providerAgentId);
        }
      } else if (message.type === 'saveAgentSeats') {
        this.context.workspaceState.update(
          WORKSPACE_KEY_AGENT_SEATS,
          message.seats as Record<number, { palette?: number; hueShift?: number; seatId?: string }>,
        );
      } else if (message.type === 'saveLayout') {
        this.layoutWatcher?.markOwnWrite();
        writeLayoutToFile(message.layout as Record<string, unknown>);
      } else if (message.type === 'setSoundEnabled') {
        this.context.globalState.update(GLOBAL_KEY_SOUND_ENABLED, message.enabled as boolean);
      } else if (message.type === 'webviewReady') {
        const soundEnabled = this.context.globalState.get<boolean>(GLOBAL_KEY_SOUND_ENABLED, true);
        this.webview?.postMessage({ type: 'settingsLoaded', soundEnabled });

        const wsFolders = vscode.workspace.workspaceFolders;
        if (wsFolders && wsFolders.length > 1) {
          this.webview?.postMessage({
            type: 'workspaceFolders',
            folders: wsFolders.map((f) => ({ name: f.name, path: f.uri.fsPath })),
          });
        }

        const launchable = this.registry.getLaunchable();
        this.webview?.postMessage({
          type: 'availableProviders',
          providers: launchable.map((p) => ({ id: p.id, displayName: p.displayName })),
        });

        const { ids, meta } = getExistingAgentIds();
        const seatMeta = this.context.workspaceState.get<Record<number, { palette?: number; hueShift?: number; seatId?: string }>>(
          WORKSPACE_KEY_AGENT_SEATS,
          {},
        );
        const mergedMeta: Record<number, { palette?: number; hueShift?: number; seatId?: string; providerId?: string }> = {};
        for (const id of ids) {
          mergedMeta[id] = { ...seatMeta[id], ...meta[id] };
        }
        const folderNames: Record<number, string> = {};
        for (const id of ids) {
          if (meta[id]?.folderName) folderNames[id] = meta[id].folderName!;
        }
        this.webview?.postMessage({
          type: 'existingAgents',
          agents: ids,
          agentMeta: mergedMeta,
          folderNames,
        });

        const extensionPath = this.extensionUri.fsPath;
        const bundledAssetsDir = path.join(extensionPath, 'dist', 'assets');
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        let assetsRoot: string | null = null;
        if (fs.existsSync(bundledAssetsDir)) {
          assetsRoot = path.join(extensionPath, 'dist');
        } else if (workspaceRoot) {
          assetsRoot = workspaceRoot;
        }

        const loadAndSendAssets = async () => {
          if (!assetsRoot) {
            this.webview?.postMessage({
              type: 'layoutLoaded',
              layout: migrateAndLoadLayout(this.context, this.defaultLayout),
            });
            this.startLayoutWatcher();
            return;
          }
          this.defaultLayout = loadDefaultLayout(assetsRoot);
          try {
            const charSprites = await loadCharacterSprites(assetsRoot);
            if (charSprites && this.webview) sendCharacterSpritesToWebview(this.webview, charSprites);
            const floorTiles = await loadFloorTiles(assetsRoot);
            if (floorTiles && this.webview) sendFloorTilesToWebview(this.webview, floorTiles);
            const wallTiles = await loadWallTiles(assetsRoot);
            if (wallTiles && this.webview) sendWallTilesToWebview(this.webview, wallTiles);
            const assets = await loadFurnitureAssets(assetsRoot);
            if (assets && this.webview) sendAssetsToWebview(this.webview, assets);
          } catch (err) {
            console.error('[Agent Visualizer] Error loading assets:', err);
          }
          if (this.webview) {
            this.webview.postMessage({
              type: 'layoutLoaded',
              layout: migrateAndLoadLayout(this.context, this.defaultLayout),
            });
            this.startLayoutWatcher();
          }
        };

        if (!assetsRoot) {
          const ep = this.extensionUri.fsPath;
          const bundled = path.join(ep, 'dist', 'assets');
          if (fs.existsSync(bundled)) {
            assetsRoot = path.join(ep, 'dist');
            this.defaultLayout = loadDefaultLayout(assetsRoot);
          }
        }
        void loadAndSendAssets();
      } else if (message.type === 'openSessionsFolder') {
        const projectDir = getProjectDirPath();
        if (projectDir && fs.existsSync(projectDir)) {
          vscode.env.openExternal(vscode.Uri.file(projectDir));
        }
      } else if (message.type === 'exportLayout') {
        const layout = readLayoutFromFile();
        if (!layout) {
          vscode.window.showWarningMessage('Agent Visualizer: No saved layout to export.');
          return;
        }
        const uri = await vscode.window.showSaveDialog({
          filters: { 'JSON Files': ['json'] },
          defaultUri: vscode.Uri.file(path.join(os.homedir(), 'agent-visualizer-layout.json')),
        });
        if (uri) {
          fs.writeFileSync(uri.fsPath, JSON.stringify(layout, null, 2), 'utf-8');
          vscode.window.showInformationMessage('Agent Visualizer: Layout exported.');
        }
      } else if (message.type === 'importLayout') {
        const uris = await vscode.window.showOpenDialog({
          filters: { 'JSON Files': ['json'] },
          canSelectMany: false,
        });
        if (!uris || uris.length === 0) return;
        try {
          const raw = fs.readFileSync(uris[0].fsPath, 'utf-8');
          const imported = JSON.parse(raw) as Record<string, unknown>;
          if (imported.version !== 1 || !Array.isArray(imported.tiles)) {
            vscode.window.showErrorMessage('Agent Visualizer: Invalid layout file.');
            return;
          }
          this.layoutWatcher?.markOwnWrite();
          writeLayoutToFile(imported);
          this.webview?.postMessage({ type: 'layoutLoaded', layout: imported });
          vscode.window.showInformationMessage('Agent Visualizer: Layout imported.');
        } catch {
          vscode.window.showErrorMessage('Agent Visualizer: Failed to read or parse layout file.');
        }
      }
    });
  }

  exportDefaultLayout(): void {
    const layout = readLayoutFromFile();
    if (!layout) {
      vscode.window.showWarningMessage('Agent Visualizer: No saved layout found.');
      return;
    }
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      vscode.window.showErrorMessage('Agent Visualizer: No workspace folder found.');
      return;
    }
    const targetPath = path.join(
      workspaceRoot,
      'webview-ui',
      'public',
      'assets',
      'default-layout.json',
    );
    fs.writeFileSync(targetPath, JSON.stringify(layout, null, 2), 'utf-8');
    vscode.window.showInformationMessage(
      `Agent Visualizer: Default layout exported to ${targetPath}`,
    );
  }

  private startLayoutWatcher(): void {
    if (this.layoutWatcher) return;
    this.layoutWatcher = watchLayoutFile((layout) => {
      this.webview?.postMessage({ type: 'layoutLoaded', layout });
    });
  }

  dispose(): void {
    this.agentManagerDispose?.();
    this.agentManagerDispose = null;
    this.layoutWatcher?.dispose();
    this.layoutWatcher = null;
    this.webviewView = undefined;
  }
}

function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const distPath = vscode.Uri.joinPath(extensionUri, 'dist', 'webview');
  const indexPath = vscode.Uri.joinPath(distPath, 'index.html').fsPath;

  if (!fs.existsSync(indexPath)) {
    return `<!DOCTYPE html><html><body><p>Agent Office (run "npm run build" to load the panel)</p></body></html>`;
  }

  let html = fs.readFileSync(indexPath, 'utf-8');
  html = html.replace(/(href|src)="\.\/([^"]+)"/g, (_match, attr, filePath) => {
    const fileUri = vscode.Uri.joinPath(distPath, filePath);
    const webviewUri = webview.asWebviewUri(fileUri);
    return `${attr}="${webviewUri}"`;
  });
  return html;
}
