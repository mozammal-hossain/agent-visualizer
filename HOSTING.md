# How to Host / Distribute the Agent Visualizer Extension

You can use the extension in two ways: **install it locally** (no second window) or **publish it** so others can install from the marketplace.

---

## Option 1: Install locally (use in every Cursor/VS Code window)

This installs the extension like any other extension so you don’t need “Run Extension” or a second window.

### 1. Package the extension as a `.vsix` file

From the project root:

```bash
npm install
npm run package
```

This runs `npm run build` and then creates `agent-visualizer-0.1.0.vsix` in the project root.

### 2. Install the `.vsix` in Cursor/VS Code

- Open **Extensions** (Cmd+Shift+X).
- Click the **"..."** menu at the top of the Extensions panel.
- Choose **"Install from VSIX..."**.
- Select `agent-visualizer-0.1.0.vsix` (in your agent-visualizer folder).
- Reload the window if prompted.

The extension is now installed. Open any folder and use **View → Open View → "Agent Visualizer Sessions"** (or the Agent Visualizer icon in the activity bar).

---

## Option 2: Publish to the VS Code Marketplace (public)

So others can search “Agent Visualizer” and install it from the Extensions panel.

### 1. Create a publisher account

- Go to [https://marketplace.visualstudio.com](https://marketplace.visualstudio.com).
- Sign in with your Microsoft account.
- Click **Publish extension** and create a **publisher** (e.g. your username or org name).

### 2. Set the publisher in `package.json`

Edit `package.json` and set `publisher` to your marketplace publisher id:

```json
"publisher": "your-publisher-id",
```

### 3. Install the packaging tool and log in

```bash
npm install -g @vscode/vsce
vsce login your-publisher-id
```

Use the Personal Access Token from the marketplace site when prompted.

### 4. Package and publish

```bash
npm run build
vsce package
vsce publish
```

Or use the same `npm run package` and then `vsce publish` to publish the generated `.vsix`.

- **First time:** `vsce publish` will publish the extension to the marketplace.
- **Updates:** Bump `version` in `package.json`, then run `npm run package` and `vsce publish` again.

---

## Summary

| Goal                         | Command / step                                              |
|-----------------------------|-------------------------------------------------------------|
| Use extension locally       | `npm run package` → Install from VSIX → open the .vsix file |
| Publish for everyone        | Create publisher → set `publisher` in package.json → `vsce login` → `vsce publish` |

After **Option 1**, you can close the “Run Extension” workflow and use Agent Visualizer in your normal Cursor window like any other extension.
