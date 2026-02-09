# Excalidraw MCP Server

[![npm version](https://img.shields.io/npm/v/@scofieldfree/excalidraw-mcp.svg)](https://www.npmjs.com/package/@scofieldfree/excalidraw-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An MCP (Model Context Protocol) server that empowers AI agents (like **Claude**, **Cursor**, **Windsurf**) to create, edit, and manage **Excalidraw** diagrams directly within your conversation.

> **Why Excalidraw?** Its hand-drawn aesthetic and JSON-based format are perfect for rapid, programmable diagramming. This server bridges standard MCP clients with a local Excalidraw instance, enabling AI-powered visual thinking.

<p align="center">
  <img src="/images/excalidraw-mcp-architechture.png" alt="Excalidraw MCP Demo" width="700">
</p>

## ✨ Features

| Feature                  | Description                                                        |
| ------------------------ | ------------------------------------------------------------------ |
| 🎨 **Real-time Preview** | Changes appear instantly in a local browser window via WebSocket   |
| 📐 **Smart Layout**      | Automatically calculates text width and binds labels to containers |
| 🔄 **Multi-Session**     | Switch between different diagrams seamlessly                       |
| 🧜 **Mermaid Support**   | Convert Mermaid syntax to Excalidraw diagrams instantly            |
| 📦 **Export Options**    | Export to PNG, SVG, or JSON formats                                |
| 🏗️ **Templates**         | Built-in architecture diagram templates                            |

---

## 🚀 Quick Start

You don't need to clone this repo. Just configure your MCP client:

### Claude Code (cc)

```bash
claude mcp add excalidraw -- npx -y @scofieldfree/excalidraw-mcp
```

### Codex CLI

```bash
codex mcp add excalidraw -- npx -y @scofieldfree/excalidraw-mcp
```

### Cursor / Windsurf

Go to **Settings > MCP** → **Add New MCP Server**:

| Field   | Value                                 |
| ------- | ------------------------------------- |
| Name    | `excalidraw`                          |
| Type    | `command`                             |
| Command | `npx -y @scofieldfree/excalidraw-mcp` |

### Cline (VS Code Extension)

Open Cline settings and add to MCP Servers:

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

### GitHub Copilot

Use the Copilot CLI to interactively add:

```bash
/mcp add
```

Alternatively, create or edit `~/.copilot/mcp-config.json`:

```json
{
  "mcpServers": {
    "excalidraw": {
      "type": "local",
      "command": "npx",
      "tools": ["*"],
      "args": ["-y", "@scofieldfree/excalidraw-mcp"]
    }
  }
}
```

### Kiro

Follow the [MCP Servers documentation](https://kiro.dev/docs/mcp). Add to `.kiro/settings/mcp.json`:

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

### opencode

```bash
opencode mcp add excalidraw -- npx -y @scofieldfree/excalidraw-mcp
```

### VS Code

**One-click install:**

[<img src="https://img.shields.io/badge/Install_Server-VS_Code-blue?logo=visualstudiocode" alt="Install in VS Code">](https://insiders.vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%7B%22name%22%3A%22excalidraw%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22%40scofieldfree%2Fexcalidraw-mcp%22%5D%7D)
[<img src="https://img.shields.io/badge/Install_Server-VS_Code_Insiders-green?logo=visualstudiocode" alt="Install in VS Code Insiders">](https://insiders.vscode.dev/redirect?url=vscode-insiders%3Amcp%2Finstall%3F%7B%22name%22%3A%22excalidraw%22%2C%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22%40scofieldfree%2Fexcalidraw-mcp%22%5D%7D)

**Or install via CLI:**

```bash
# For VS Code
code --add-mcp '{"name":"excalidraw","command":"npx","args":["-y","@scofieldfree/excalidraw-mcp"]}'

# For VS Code Insiders
code-insiders --add-mcp '{"name":"excalidraw","command":"npx","args":["-y","@scofieldfree/excalidraw-mcp"]}'
```

### Claude Desktop

Add to your `claude_desktop_config.json`:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

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

---

## 🛠️ Available Tools

| Tool                        | Description                                      |
| --------------------------- | ------------------------------------------------ |
| `start_session`             | Start browser preview and open Excalidraw editor |
| `add_elements`              | Add shapes, text, arrows to the canvas           |
| `update_element`            | Modify existing element properties               |
| `delete_element`            | Remove elements from canvas                      |
| `get_scene`                 | Retrieve current diagram state                   |
| `create_from_mermaid`       | Convert Mermaid syntax to Excalidraw             |
| `add_template_architecture` | Add a pre-built architecture diagram template    |
| `create_diagram`            | Create a new diagram or clear existing           |
| `export_diagram`            | Export diagram to PNG, SVG, or JSON              |
| `list_sessions`             | List all active diagram sessions                 |
| `delete_diagram`            | Delete a diagram session                         |

---

## 💬 Usage Examples

### Example 1: Create a Simple Diagram

**You say:**

> "Draw a flowchart with three boxes: Input → Process → Output"

**AI uses:**

```
start_session → add_elements (3 rectangles + 2 arrows)
```

### Example 2: Convert Mermaid to Excalidraw

**You say:**

> "Convert this Mermaid diagram to Excalidraw:
> `graph LR: A[User] --> B[API Gateway] --> C[Service] --> D[(Database)]`"

**AI uses:**

```
start_session → create_from_mermaid
```

### Example 3: Architecture Diagram

**You say:**

> "Create an architecture diagram for a microservices system"

**AI uses:**

```
start_session → add_template_architecture (or) add_elements with custom layout
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     AI Agent (Claude/Cursor)                │
└─────────────────────────┬───────────────────────────────────┘
                          │ MCP Protocol (JSON-RPC over stdio)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   Excalidraw MCP Server                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Tool Router │──│ State Store │──│ WebSocket Broadcast │  │
│  └─────────────┘  └─────────────┘  └──────────┬──────────┘  │
└────────────────────────────────────────────────┼────────────┘
                                                 │ WebSocket
                                                 ▼
                          ┌───────────────────────────────────┐
                          │     Browser (Excalidraw Editor)   │
                          └───────────────────────────────────┘
```

---

## 🔧 Development

### Prerequisites

- Node.js >= 18
- pnpm >= 9

### Setup

```bash
# Clone the repository
git clone https://github.com/Scofieldfree/excalidraw-mcp.git
cd excalidraw-mcp

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

### Scripts

| Command          | Description                           |
| ---------------- | ------------------------------------- |
| `pnpm dev`       | Start dev server (backend + frontend) |
| `pnpm build`     | Build for production                  |
| `pnpm typecheck` | Run TypeScript type checking          |
| `pnpm lint`      | Run ESLint                            |
| `pnpm release`   | Create a new release version          |

---

## 📦 Project Structure

```
excalidraw-mcp/
├── packages/
│   └── mcp-server/          # Core MCP server + Excalidraw frontend
│       ├── src/
│       │   ├── index.ts     # Entry point
│       │   ├── state.ts     # Session state management
│       │   ├── http-server.ts
│       │   └── tools/       # MCP tool implementations
│       └── web/             # Excalidraw React frontend
├── docs/                    # Documentation
└── package.json             # Workspace configuration
```

---

## 🐛 Troubleshooting

### Port Already in Use

The server automatically finds an available port starting from 3100. If you need a specific port, set the `PORT` environment variable.

### Browser Doesn't Open

Ensure you have a default browser configured. The server uses the `open` package to launch the browser.

### WebSocket Connection Failed

Check if any firewall or antivirus is blocking WebSocket connections on localhost.

---

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](docs/CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📜 License

MIT © [Scofieldfree](https://github.com/Scofieldfree)

---

## 🔗 Links

- [npm Package](https://www.npmjs.com/package/@scofieldfree/excalidraw-mcp)
- [GitHub Repository](https://github.com/Scofieldfree/excalidraw-mcp)
- [Excalidraw](https://excalidraw.com/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
