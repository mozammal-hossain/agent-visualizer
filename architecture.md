# Agent Visualizer — Architecture

## Overview

**Agent Visualizer** is a VS Code / Cursor IDE extension that reads Cursor AI agent transcript files and renders them as interactive visual diagrams inside the editor. It is structured as two cooperating runtimes separated by the VS Code webview security boundary:

- **Extension Host** — Node.js / TypeScript process that owns file I/O, path resolution, and VS Code API integration.
- **Webview UI** — Isolated browser sandbox that renders the React + D3 visualizations.

---

## Repository Layout

```
agent-visualizer/
├── src/                        # Extension host (Node.js / TypeScript)
│   ├── extension.ts            # Activation entry point, command & watcher registration
│   ├── parsers/
│   │   ├── types.ts            # Shared data models (Session, Message, ToolCall)
│   │   ├── txtParser.ts        # Parser for legacy .txt transcript format
│   │   └── jsonlParser.ts      # Parser for .jsonl transcript format (subagent support)
│   ├── services/
│   │   ├── pathResolver.ts     # Derives ~/.cursor/projects/<slug>/agent-transcripts/ path
│   │   └── transcriptService.ts# Discovers, parses, and caches all transcript files
│   ├── providers/
│   │   └── sessionTreeProvider.ts  # VS Code TreeDataProvider for the sidebar
│   └── panels/
│       └── visualizerPanel.ts  # Webview lifecycle and extension ↔ webview message bridge
│
├── webview-ui/                 # Webview UI (React / TypeScript / Vite)
│   ├── src/
│   │   ├── index.tsx           # React entry point; listens for messages from extension host
│   │   ├── App.tsx             # Root component; tab navigation (Timeline / future views)
│   │   ├── types.ts            # Type definitions mirrored from extension parsers/types.ts
│   │   ├── style.css           # VS Code dark-theme CSS
│   │   └── components/
│   │       ├── Timeline.tsx    # Phase 1: vertical conversation timeline
│   │       └── SessionHeader.tsx  # Session metadata (ID, format, message/tool counts)
│   ├── package.json            # React 18, D3 7, Vite dependencies
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── resources/
│   └── icon.svg                # Activity bar icon
│
├── esbuild.js                  # Extension bundler configuration (esbuild)
├── package.json                # Extension manifest, VS Code contributes, npm scripts
├── tsconfig.json               # TypeScript config for extension host
└── .vscodeignore               # Excludes node_modules, dist, etc. from .vsix package
```

---

## Technology Stack

| Layer | Technology | Role |
|---|---|---|
| Extension Host | Node.js 18 + TypeScript 5.3 | VS Code extension runtime |
| Extension Bundler | esbuild 0.19 | Bundles `src/` → `dist/extension.js` |
| Webview UI | React 18 + TypeScript 5.3 | Interactive visualization interface |
| Webview Bundler | Vite 5 | Bundles `webview-ui/src/` → `webview-ui/dist/` |
| Visualization | D3.js 7.8 | Graph and chart rendering (Phase 2/3) |
| Linting | ESLint + TypeScript-ESLint | Code quality checks |

---

## Core Data Models

Defined in `src/parsers/types.ts` and mirrored in `webview-ui/src/types.ts`:

```
Session
├── id            : string        — unique identifier (usually the filename stem)
├── format        : "txt"|"jsonl" — transcript format
├── filePath      : string        — absolute path to the transcript file
├── firstUserMessage : string     — preview text used as display title
├── messages      : Message[]     — ordered conversation turns
└── subagents     : Session[]     — nested child agent sessions (.jsonl only)

Message
├── role          : "user"|"assistant"
├── text          : string
└── toolCalls     : ToolCall[]

ToolCall
├── name          : string        — tool identifier (e.g. "read_file", "run_terminal_cmd")
├── parameters    : Record<string, string>
└── hasResult     : boolean
```

---

## Components and Responsibilities

### Extension Host

#### `extension.ts` — Activation & Wiring
- Called by VS Code on `onStartupFinished`.
- Reads the first workspace folder path and passes it to `createTranscriptService()`.
- Registers the sidebar tree view (`agentSessions`) backed by `SessionTreeProvider`.
- Registers three commands:
  - `agent-visualizer.openSession` — opens a `VisualizerPanel` for a session.
  - `agent-visualizer.refresh` — refreshes the sidebar tree.
  - `agent-visualizer.copySessionId` — copies a session's ID to the clipboard.
- Creates a `FileSystemWatcher` on the transcript directory to auto-refresh the sidebar when files are created, changed, or deleted.

#### `PathResolver` — Transcript Path Derivation
- Converts a workspace path to a Cursor project slug by joining path segments with `-`.
- Returns the full path: `~/.cursor/projects/<slug>/agent-transcripts/`.

#### `TranscriptService` — Session Discovery and Cache
- Scans the transcript directory for `.txt` and `.jsonl` files.
- Dispatches to `TxtParser` or `JsonlParser` depending on file extension.
- Caches parsed `Session` objects in a `Map<string, Session>` for fast lookup.
- Returns sessions sorted by file modification time (newest first).

#### `TxtParser` / `JsonlParser` — Format Parsers
- `TxtParser`: parses the plain-text format that uses special markers for turns and tool calls.
- `JsonlParser`: parses JSON Lines format; additionally discovers subagent sessions referenced within the same directory.

#### `SessionTreeProvider` — Sidebar Tree
- Implements `vscode.TreeDataProvider<SessionTreeItem>`.
- Populates the "Sessions" tree with sessions and their subagents.
- Shows message and tool-call counts in tree item descriptions.
- Fires `onDidChangeTreeData` to trigger a sidebar refresh.

#### `VisualizerPanel` — Webview Bridge
- Manages a single `vscode.WebviewPanel` (singleton via `currentPanel`).
- On creation, generates the webview HTML with the React bundle injected via `<script>` and inlines the initial session as `window.__INITIAL_SESSION__`.
- On session switch, sends a `{ type: "sessionData", data: session }` message to the webview.
- Handles `openSession` messages sent back from the webview.

---

### Webview UI

#### `index.tsx` — Root Component
- Reads `window.__INITIAL_SESSION__` to hydrate initial state.
- Attaches a `message` event listener to receive `sessionData` updates from the extension host.
- Renders `<App session={session} />` once data is available.

#### `App.tsx` — Tab Shell
- Maintains `activeTab` state (`"timeline"` | `"hierarchy"` | `"tools"` | `"flow"`).
- Renders tab buttons; only **Timeline** is currently enabled. Others are placeholders for Phase 2 and Phase 3 features.
- Renders the active tab's content below the navigation bar.

#### `Timeline.tsx` — Conversation Timeline (Phase 1)
- Maps `session.messages` to alternating left/right chat bubbles.
- User messages rendered in blue; assistant messages in gray.
- Tool calls rendered as expandable cards with an icon for each tool type (read, write, shell, grep, etc.).

#### `SessionHeader.tsx` — Metadata Header
- Displays the session's first user message as its title.
- Shows session ID, file format, total message count, and total tool-call count.

---

## Data Flow

```
Cursor Agent Transcripts
(~/.cursor/projects/<slug>/agent-transcripts/*.txt | *.jsonl)
         │
         ▼
  PathResolver.getTranscriptFolderForWorkspace(workspacePath)
         │
         ▼
  TranscriptService.getSessions()
    ├── TxtParser.parse(filePath)   → Session
    └── JsonlParser.parse(filePath) → Session (with subagents)
         │
         ├──▶ SessionTreeProvider  →  VS Code Sidebar Tree
         │         │
         │    User clicks tree item
         │         │
         ▼         ▼
  VisualizerPanel.createOrShow(extensionUri, session, transcriptService)
         │
         │  window.__INITIAL_SESSION__ (initial load)
         │  postMessage({ type: "sessionData" }) (subsequent switches)
         │
         ▼
  Webview (React)
    Root (index.tsx) → App.tsx → Timeline.tsx
```

---

## Extension ↔ Webview Communication

The VS Code webview security boundary requires message passing for all data exchange.

| Direction | Mechanism | Payload |
|---|---|---|
| Extension → Webview (initial) | `window.__INITIAL_SESSION__` global injected in HTML | `Session` object |
| Extension → Webview (update) | `panel.webview.postMessage()` | `{ type: "sessionData", data: Session }` |
| Webview → Extension | `vscode.postMessage()` | `{ command: "openSession", sessionId: string }` |

---

## Build System

### Extension Host

```bash
npm run build:ext
# esbuild src/extension.ts --bundle --outfile=dist/extension.js \
#   --external:vscode --platform=node --target=node18
```

### Webview UI

```bash
npm run build:webview
# cd webview-ui && vite build
# Output: webview-ui/dist/index.html, index.js, style.css
```

### Full Build

```bash
npm run build          # build:ext && build:webview
npm run watch          # watch:ext & watch:webview (parallel)
npm run vscode:prepublish  # alias for npm run build
```

---

## VS Code Extension Manifest Highlights (`package.json`)

| Contributes | Value |
|---|---|
| Activity bar container | `agent-visualizer` with `resources/icon.svg` |
| Tree view | `agentSessions` ("Sessions") inside the container |
| Commands | `openSession`, `refresh`, `copySessionId` |
| Activation event | `onStartupFinished` |
| Extension entry point | `dist/extension.js` |
| Minimum VS Code version | 1.85.0 |

---

## Planned Phases

| Phase | Feature | Status |
|---|---|---|
| 1 | Conversation Timeline | ✅ Complete |
| 2 | Agent Hierarchy Tree (D3) | 🔲 Planned |
| 2 | Tool Usage Analytics | 🔲 Planned |
| 3 | Reasoning Flow Diagram (D3 directed graph) | 🔲 Planned |
