# Inspiration from Pixel Agents

This document captures ideas from [pixel-agents](https://github.com/pablodelucca/pixel-agents) (VS Code extension that turns Claude Code agents into animated pixel-art characters in a virtual office) and how they can inspire **Agent Visualizer**.

---

## What Pixel Agents Does

- **One agent → one character** in a 2D office; characters walk, sit at desks, and animate by activity.
- **Live activity from transcripts**: watches JSONL transcript files and maps tool use to character state (typing, reading, waiting).
- **Human-readable tool status**: e.g. "Reading foo.dart", "Running: npm test", "Subtask: explore project".
- **Sub-agent visualization**: Task-tool sub-agents appear as separate characters linked to the parent.
- **Status signals**: "waiting" (needs user input), "active" (using tools), permission-needed (with timers/heuristics).
- **Optional sound**: chime when an agent finishes its turn.
- **Layout editor**: floors, walls, furniture; export/import; persistent state.
- **Tech**: React + Vite in webview, Canvas 2D game loop, BFS pathfinding, state machine (idle → walk → type/read).

---

## Ideas We Can Adopt (aligned with Agent Visualizer)

### 1. **Live / streaming transcript updates**

Pixel Agents uses **incremental file reading** (track `fileOffset`, read only new bytes, split by newlines) and **multiple watch strategies** (e.g. `fs.watch` + `fs.watchFile` + polling) for reliability across platforms.

**For us:**  
- Keep using `FileSystemWatcher` for “session list” changes.  
- Add **tail-style reading** for the **currently open session**: when the user has a session open and its transcript file grows (e.g. active Cursor chat), stream new messages/tool calls into the webview instead of only refreshing on full re-parse.  
- Optionally use a small poll interval for the open file (like Pixel Agents) to avoid missing events on macOS.

### 2. **Activity / status derived from transcript content**

Pixel Agents infers:

- **Active**: assistant message contains `tool_use` blocks.
- **Waiting**: `system` + `turn_duration` or text-idle timer after no tool use.
- **Permission**: non-exempt tools started but no result yet (with timer).

They also map **tool name + input** to short status strings (e.g. "Reading X", "Running: cmd").

**For us:**  
- Add an **activity/status** notion to our data model or view state: e.g. `idle | thinking | tool_busy | waiting_for_user`, derived from last message and pending tool calls.  
- Reuse or adapt **human-readable tool status** (e.g. "Reading path/to/file", "Running: npm test") in the Timeline and future Flow view.  
- For **live session** only: optional simple heuristics (e.g. “no new content for N seconds” → “waiting”) to show a “Waiting for your input” indicator, with the caveat that Cursor’s transcript format may not have explicit turn-end events.

### 3. **Sub-agent = first-class entity**

Pixel Agents treats Task sub-agents as separate characters with their own state and link to parent.

**For us:**  
- We already have **subagents** in `Session`.  
- Expose them clearly in the **Agent Hierarchy** view and in the **Flow Diagram** (subagent as a node, edge from parent tool call to subagent).  
- In Timeline, consider a compact “Subagent: &lt;description&gt;” block that links to the subagent’s timeline (navigation to that session).

### 4. **Optional sound on “turn complete”**

Pixel Agents plays a chime when the agent finishes a turn (turn_duration / heuristics).

**For us:**  
- Optional **sound notification** when the **currently viewed session** gets new content that looks like “assistant finished a turn” (e.g. new user message or heuristic).  
- Make it a **setting** (on/off, maybe volume) and use Web Audio or a small asset; respect “quiet” or “focus” modes if we add them later.

### 5. **Stable, user-friendly labels**

Pixel Agents uses short, deterministic labels (e.g. file basename for Read/Write, truncated command for Bash).

**For us:**  
- In Timeline and Tool Usage, prefer **short labels** (e.g. "Read lib/foo.dart", "StrReplace in bar.ts") instead of raw tool names only.  
- Reuse the same formatting in Tool Usage dashboard and Flow node labels so the product feels consistent.

### 6. **Persistent UI state**

Pixel Agents persists office layout and which terminal is tied to which agent.

**For us:**  
- We already have “open session” in the panel.  
- Add **persistence** for: last selected session, open tab (Timeline vs Hierarchy vs Tools vs Flow), and optionally sidebar expansion state, so the panel doesn’t reset on reload.

### 7. **Clear extension ↔ webview contract**

Pixel Agents sends structured messages: `agentStatus`, `agentToolStart`, `agentToolDone`, `subagentToolStart`, `subagentToolDone`, `agentCreated`, etc.

**For us:**  
- Keep a small **message protocol** doc (or comments in the panel code): e.g. `sessionData`, `openSession`, and any future `liveUpdate`, `agentStatus`, `playSound`.  
- When we add live updates, use **discrete message types** (e.g. `sessionData` for full replace, `sessionAppend` for new messages) so the webview can optimize (e.g. append to timeline instead of full re-render).

### 8. **What we’re not copying (and why)**

- **Pixel-art office / game loop**: Agent Visualizer is about **analytics and diagrams**, not a 2D game. We can still use “status” and “activity” in our existing views (e.g. a small “Live” badge or “Waiting for input” in the header).  
- **Terminal–agent binding**: We’re tied to **transcript files**, not terminals; we don’t need to adopt their terminal logic.  
- **Layout editor**: Out of scope for our MVP; we could later consider “customize dashboard layout” (e.g. which charts to show) as a lighter-weight analogue.

---

## Suggested next steps (priority order)

1. **Tool status formatting**  
   Add a small helper (extension or webview) that, given `ToolCall`, returns a short label (e.g. "Read foo.dart", "StrReplace in bar.ts") and use it in Timeline and, later, Tool Usage and Flow.

2. **Live/tail for open session**  
   When a session is open, watch its transcript file for appends; on change, re-parse (or incremental parse if we add it) and send `sessionData` or `sessionAppend` to the webview so the Timeline updates without the user refreshing.

3. **Activity/waiting indicator**  
   For the open session, derive a simple status (e.g. last message is user → “Waiting for agent”; last is assistant with pending tool calls → “Working”; else “Idle”) and show it in the SessionHeader or a small badge.

4. **Optional sound**  
   Add a setting “Play sound when agent responds” and trigger a short chime when we detect new assistant content for the open session (with simple debounce/heuristic to avoid spam).

5. **Persist panel state**  
   Save last session id and active tab (e.g. in workspace or global state) and restore on panel open.

6. **Subagent prominence**  
   When implementing Agent Hierarchy and Flow Diagram, treat subagents as first-class: separate nodes, clear parent link, and one-click navigation to subagent session.

---

## References

- Repo: [github.com/pablodelucca/pixel-agents](https://github.com/pablodelucca/pixel-agents)
- Key extension files: `transcriptParser.ts` (tool status, activity, subagent handling), `fileWatcher.ts` (incremental read, polling), `types.ts` (AgentState)
- Webview: React app with office canvas, message hooks for `agentStatus`, `agentToolStart` / `agentToolDone`, subagent messages
