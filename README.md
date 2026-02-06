# Excalidraw MCP Server

[![npm version](https://img.shields.io/npm/v/@scofieldfree/excalidraw-mcp.svg)](https://www.npmjs.com/package/@scofieldfree/excalidraw-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An MCP (Model Context Protocol) server that empowers AI agents (like **Claude**, **Cursor**, **Windsurf**) to create, edit, and manage **Excalidraw** diagrams directly within your conversation.

> **Why this exists**: Draw.io is great, but Excalidraw's hand-drawn aesthetic and JSON-based format are perfect for rapid, programmable diagramming. This server bridges standard MCP clients with a local Excalidraw instance.

## ✨ Features

- **Real-time Preview**: Changes appear instantly in a local browser window via WebSocket.
- **Smart Layout**: Automatically calculates text width and binds labels to containers.
- **Multi-Session**: Switch between different diagrams (architecture, data-flow) seamlessly.
- **Standard Toolset**: `add_elements`, `update_element`, `export_diagram` (PNG/JSON).

## 🚀 Quick Start (For Users)

You don't need to clone this repo. Just use `npx`:

### 1. Claude Desktop

Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "excalidraw": {
      "command": "npx",
      "args": ["-y", "@scofieldfree/excalidraw-mcp"]
    }
  }
}
```

### 2. Cursor / Windsurf

Go to **Settings > MCP**, click **Add New MCP Server**:

- **Name**: `excalidraw`
- **Type**: `command`
- **Command**: `npx -y @scofieldfree/excalidraw-mcp`

---

## 🛠 Development (For Contributors)

If you want to modify the code or contribute:

1. **Clone the repo**

   ```bash
   git clone https://github.com/Scofieldfree/excalidraw-mcp.git
   cd excalidraw-mcp
   ```

2. **Install dependencies** (using pnpm)

   ```bash
   pnpm install
   ```

3. **Start Development Server**

   ```bash
   pnpm dev
   ```

   This will start both the MCP backend (watching changes) and the Vite frontend server.

4. **Build**
   ```bash
   pnpm build
   ```

## 📦 Project Structure

- `packages/mcp-server`: The core MCP server logic (Node.js) + Excalidraw Frontend (React/Vite).

## 📜 License

MIT © [Scofieldfree](https://github.com/Scofieldfree)
