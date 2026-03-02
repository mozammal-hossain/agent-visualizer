# Phase 1 MVP Implementation Guide

## Overview

Phase 1 (MVP) of the Agent Visualizer extension has been implemented. This guide covers setup, building, testing, and next steps.

## Project Structure

```
agent-visualizer/
  package.json              # Extension manifest and scripts
  tsconfig.json            # TypeScript config for extension
  esbuild.js               # Build script for extension host
  .vscodeignore            # Files to exclude from package
  .gitignore              # Git ignore rules
  
  src/                    # Extension host code (Node.js)
    extension.ts          # Main extension entry point
    parsers/
      types.ts            # Shared TypeScript types
      txtParser.ts        # Parse .txt transcript format
      jsonlParser.ts      # Parse .jsonl transcript format
    services/
      pathResolver.ts     # Derive transcript folder from workspace path
      transcriptService.ts # Discover + parse all transcripts, cache results
    providers/
      sessionTreeProvider.ts # TreeDataProvider for sidebar view
    panels/
      visualizerPanel.ts  # Manage webview lifecycle, message passing
  
  webview-ui/             # React webview application
    package.json          # Dependencies: React, D3, Vite
    tsconfig.json        # TypeScript config for webview
    vite.config.ts       # Vite build configuration
    index.html           # Webview HTML template
    
    src/
      index.tsx          # React entry point
      App.tsx            # Tab navigation between views
      types.ts           # Shared types (mirrored from extension)
      style.css          # Global styles
      components/
        Timeline.tsx     # Vertical timeline of conversation + tool calls
        SessionHeader.tsx # Session metadata display
  
  resources/
    icon.svg             # Extension icon for activity bar
```

## Setup Instructions

### 1. Install Dependencies

```bash
cd /Users/bs1101/Personal/1.projects/agent-visualizer

# Install extension dependencies
npm install

# Install webview dependencies
cd webview-ui
npm install
cd ..
```

### 2. Build the Extension

```bash
# Build both extension host and webview
npm run build

# Or build individually:
npm run build:ext      # Build extension code
npm run build:webview  # Build React webview
```

### 3. Watch Mode (Development)

For active development with automatic rebuilds:

```bash
npm run watch
# Or in VS Code: Terminal > Run Build Task > watch
```

### 4. Test the Extension

1. Open the project in VS Code
2. Press `F5` or go to **Run > Start Debugging**
3. A new VS Code window will open with the extension activated
4. In the new window, open a folder that has Cursor agent transcripts at `~/.cursor/projects/<slug>/agent-transcripts/`
5. Look for "Agent Visualizer" in the activity bar (left sidebar)
6. Click to see the sessions tree
7. Click a session to open the webview panel

## How It Works

### Transcript Discovery

The extension:
1. Gets the workspace folder path
2. Converts it to a slug (e.g., `/Users/bs1101/Personal/1.projects/foo` → `Users-bs1101-Personal-1-projects-foo`)
3. Looks for transcripts at `~/.cursor/projects/<slug>/agent-transcripts/`
4. Discovers both `.txt` and `.jsonl` format files
5. Parses them and caches the results

### Tree View

- Shows a hierarchical view of all sessions
- Each session displays:
  - First user message (as display label)
  - Message count
  - Tool call count
  - Subagents (if any)
- Click a session to open it in the webview

### Timeline View (WebView)

The webview displays a vertical timeline with:
- **User Messages**: Blue bubbles with the query text
- **Assistant Messages**: Gray bubbles with the response
- **Tool Calls**: Collapsible cards showing:
  - Tool name with icon
  - Parameters (expandable)
  - Result status badge

Tool icons are color-coded:
- 📖 Read operations
- ✏️ Write operations  
- 💻 Shell commands
- 🔍 Grep/Search operations
- 🔧 Other tools

## Available Commands

In VS Code Command Palette (Cmd+Shift+P):

- **Agent Visualizer: Open Session** - Open a session in the webview
- **Agent Visualizer: Refresh Sessions** - Reload the sessions list
- **Agent Visualizer: Copy Session ID** - Copy session ID to clipboard

## Key Implementation Details

### TxtParser
- Splits content by `user:` and `assistant:` markers
- Extracts `[Tool call]` blocks with indented parameters
- Tracks `[Tool result]` markers
- Handles `<user_query>` tags for display titles

### JsonlParser
- Reads line-by-line JSON objects
- Extracts role and message content
- Recursively discovers subagents in `subagents/` directory

### PathResolver
- Converts workspace paths to Cursor project slugs
- Handles platform-specific path separators

### TranscriptService
- Discovers and caches sessions
- Sorts by modification time (newest first)
- Provides session lookup by ID

### SessionTreeProvider
- Implements VS Code TreeDataProvider interface
- Watches for changes in transcript folder
- Auto-refreshes when files are created/deleted

### VisualizerPanel
- Manages webview panel lifecycle
- Handles message passing between extension and webview
- Updates when a new session is selected

### React Components
- **App**: Tab navigation (only Timeline active in MVP)
- **Timeline**: Expandable tool call visualization
- **SessionHeader**: Displays session metadata

## What's Included in MVP (Phase 1)

✅ Extension scaffold with manifest and build configuration  
✅ Both .txt and .jsonl format parsers  
✅ Path resolution for Cursor project structure  
✅ Sidebar tree view with session browsing  
✅ Webview panel with Timeline view  
✅ Tool call visualization with parameters  
✅ Real-time file watching for updates  

## What's Coming in Phase 2

- Agent Hierarchy view (D3 tree showing parent/subagent relationships)
- Tool Usage Dashboard (charts and file statistics)
- Enhanced tree view with statistics

## What's Coming in Phase 3

- Flow Diagram view (directed graph of reasoning path)
- Search/filter in sidebar
- Dark/light theme support
- Error handling and edge cases
- Marketplace polish

## Building for Distribution

To create a `.vsix` package for distribution:

```bash
# Install vsce (VS Code Extension Manager)
npm install -g vsce

# Package the extension
vsce package

# This creates agent-visualizer-0.1.0.vsix
```

## Troubleshooting

### "No sessions found" in tree view

1. Verify you have a workspace folder open
2. Check that the workspace path is correct
3. Ensure transcript files exist at `~/.cursor/projects/<slug>/agent-transcripts/`
4. Run "Agent Visualizer: Refresh Sessions" command

### Build errors

1. Ensure all dependencies are installed: `npm install && cd webview-ui && npm install`
2. Clear build artifacts: `rm -rf dist webview-ui/dist`
3. Rebuild: `npm run build`

### Extension not activating

- The extension activates on `onStartupFinished` event
- Check the Debug Console (Ctrl+Shift+U) for errors
- Look for logs starting with "Agent Visualizer extension"

## Next Steps

1. Install dependencies: `npm install && cd webview-ui && npm install`
2. Build: `npm run build`
3. Test in VS Code (F5 to debug)
4. Once Phase 1 is validated, proceed to Phase 2 features

## Code Architecture

The extension follows a clean architecture:

- **Types** (`parsers/types.ts`): Shared data models
- **Parsers**: Input adapters for different transcript formats
- **Services**: Business logic (discovery, path resolution, caching)
- **Providers**: VS Code UI providers (tree view)
- **Panels**: Webview management
- **Components**: React UI components

This separation makes it easy to:
- Add new transcript formats (new parser)
- Change caching strategy (modify TranscriptService)
- Add new UI views (new component)
- Support additional workspace types (modify PathResolver)
